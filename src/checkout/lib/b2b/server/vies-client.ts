import "server-only";

import type { B2bVatVerificationStatus } from "../contract";
import { countryForViesPrefix } from "../vat-id";

/**
 * The official VIES REST service — `POST /check-vat-number`.
 *
 * Contract: https://ec.europa.eu/assets/taxud/vow-information/swagger_publicVAT.yaml (that URL is documentation,
 * not an endpoint). The cloud sandbox this was written in cannot reach ec.europa.eu (proxy 403, 2026-11-02), so the
 * response shape below follows the published contract as documented, and the base URL is configurable
 * (`VIES_REST_BASE_URL`). A read-only smoke from the VPS confirms both before activation (runbook).
 *
 * Three outcomes, and only three:
 * - VALID — a successful answer that this exact number is valid;
 * - INVALID — a real negative answer of the service;
 * - UNAVAILABLE — everything else: timeout, network, HTTP error, rate limit, a malformed or mismatched payload, an
 *   unsuccessful operation. An HTTP 200 alone is not a valid answer: VIES reports member-state outages as
 *   `userError` (or `errorWrappers`) inside a 200.
 *
 * Nothing here decides an exemption. The backend matches the answer to the buyer and decides.
 */

export const VIES_DEFAULT_BASE_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api";
export const VIES_TIMEOUT_MS = 8_000;

export type ViesRequester = { memberStateCode: string; number: string };

export type ViesResult = {
	status: B2bVatVerificationStatus;
	/** The exact number asked about (`DE123456789`). */
	vatId: string;
	/** Server time when the answer arrived — the "original checkedAt" the 24 h count from. */
	checkedAt: string;
	requestIdentifier: string | null;
	/** As VIES returned them; `null` when empty or a placeholder. Never invented. */
	name: string | null;
	address: string | null;
	/** Why UNAVAILABLE/INVALID, for logs and tests (a VIES error code, or our own classification). */
	detail: string;
};

/** Split `SK2122890660` into what VIES wants as the requester. */
export function parseRequesterVatId(raw: string | null | undefined): ViesRequester | null {
	const value = (raw ?? "").toUpperCase().replace(/\s/g, "");
	const match = /^([A-Z]{2})([0-9A-Z+*]{2,14})$/.exec(value);
	if (!match || !countryForViesPrefix(match[1])) return null;
	return { memberStateCode: match[1], number: match[2] };
}

/** VIES says "---" (or nothing) when a member state does not disclose a field. That is not a value. */
function disclosed(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed || /^-+$/.test(trimmed)) return null;
	return trimmed.slice(0, 1000);
}

/** Error codes VIES uses for a negative judgement of the INPUT, as opposed to "could not answer". */
const NEGATIVE_INPUT_ERRORS = new Set(["INVALID_INPUT"]);

type ViesFetch = (input: string, init: RequestInit) => Promise<Response>;

export type CheckVatNumberParams = {
	/** Full normalized number including its VIES prefix. */
	vatId: string;
	requester: ViesRequester | null;
	baseUrl?: string;
	timeoutMs?: number;
	fetchImpl?: ViesFetch;
	now?: () => Date;
};

export async function checkVatNumber({
	vatId,
	requester,
	baseUrl = VIES_DEFAULT_BASE_URL,
	timeoutMs = VIES_TIMEOUT_MS,
	fetchImpl = fetch,
	now = () => new Date(),
}: CheckVatNumberParams): Promise<ViesResult> {
	const countryCode = vatId.slice(0, 2);
	const vatNumber = vatId.slice(2);
	const unavailable = (detail: string): ViesResult => ({
		status: "UNAVAILABLE",
		vatId,
		checkedAt: now().toISOString(),
		requestIdentifier: null,
		name: null,
		address: null,
		detail,
	});

	if (!countryForViesPrefix(countryCode) || !vatNumber) return unavailable("not-a-vies-number");

	const body: Record<string, string> = { countryCode, vatNumber };
	if (requester) {
		body.requesterMemberStateCode = requester.memberStateCode;
		body.requesterNumber = requester.number;
	}

	let response: Response;
	try {
		response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/check-vat-number`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify(body),
			cache: "no-store",
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		return unavailable(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return unavailable(`http-${response.status}-not-json`);
	}
	if (!payload || typeof payload !== "object") return unavailable(`http-${response.status}-no-object`);
	const record = payload as Record<string, unknown>;

	// `CommonResponse`: { actionSucceed: false, errorWrappers: [{ error, message }] }
	const wrappers = Array.isArray(record.errorWrappers) ? record.errorWrappers : null;
	if (record.actionSucceed === false || (wrappers && wrappers.length > 0)) {
		const code = String((wrappers?.[0] as { error?: unknown } | undefined)?.error ?? "UNKNOWN");
		if (NEGATIVE_INPUT_ERRORS.has(code)) {
			return { ...unavailable(code), status: "INVALID" };
		}
		return unavailable(code);
	}

	if (!response.ok) return unavailable(`http-${response.status}`);

	// A member-state outage arrives as `valid: false` plus a `userError` that is not VALID/INVALID.
	const userError = typeof record.userError === "string" ? record.userError : null;
	if (userError && userError !== "VALID" && userError !== "INVALID") return unavailable(userError);

	if (typeof record.valid !== "boolean") return unavailable("no-valid-flag");

	// The answer must be about exactly the number we asked for.
	const answeredCountry = typeof record.countryCode === "string" ? record.countryCode.toUpperCase() : "";
	const answeredNumber =
		typeof record.vatNumber === "string" ? record.vatNumber.toUpperCase().replace(/\s/g, "") : "";
	if (answeredCountry !== countryCode || answeredNumber !== vatNumber) return unavailable("answer-mismatch");

	const requestIdentifier =
		typeof record.requestIdentifier === "string" && record.requestIdentifier.trim()
			? record.requestIdentifier.trim().slice(0, 64)
			: null;

	return {
		status: record.valid ? "VALID" : "INVALID",
		vatId,
		checkedAt: now().toISOString(),
		requestIdentifier,
		name: disclosed(record.name),
		address: disclosed(record.address),
		detail: record.valid ? "valid" : "invalid",
	};
}
