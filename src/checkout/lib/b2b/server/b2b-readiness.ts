import "server-only";

import { saleorWriteDecision } from "@/lib/saleor/write-policy";

import { MAKY_B2B_READINESS_OPERATION, MakyB2bReadinessDocument } from "../graphql";
import { readB2bRuntimeConfig } from "./b2b-config";
import { executeB2bAppGraphQL } from "./b2b-saleor-client";

/**
 * Is THIS running process able to offer the automatic exemption?
 *
 * A green deploy is not the answer: `deploy-production.sh` only warns when the secret sync fails, and a missing SSM
 * parameter is skipped with the old `.env` kept. So the running app asks Saleor itself, with the token it actually
 * holds, and reports names, ids and booleans — never a value. When this is not `ok`, nothing is written with the
 * token: no VIES answer is sent and no new exemption is granted. What the backend has already decided is still read
 * (publicly) and stated (`evaluate-b2b.ts`), never replaced by "off".
 *
 * The probe is one request (`MakyB2bReadinessDocument`): it executes `app { … }` and makes Saleor VALIDATE the very
 * state query, attestation mutation and payment-lock release this build sends. So the schema check names no type: an
 * endpoint without the contract (or with revision 1, which cannot release a lock), or with a field, argument or
 * input type spelled differently, refuses the document (HTTP 400) and its validation messages are reported in
 * `schema.errors`.
 *
 * Kept briefly per process so a checkout render does not cost a Saleor round trip each time.
 */

export const REQUIRED_APP_PERMISSIONS = ["MANAGE_TAXES", "HANDLE_TAXES"] as const;
const OK_TTL_MS = 60_000;
const FAIL_TTL_MS = 15_000;

export type B2bReadiness = {
	ok: boolean;
	checkedAt: string;
	uiEnabled: boolean;
	endpointHost: string | null;
	token: "present" | "missing";
	requester: "configured" | "missing";
	writes: string;
	app: { id: string; name: string | null; isActive: boolean | null } | null;
	permissions: { required: Record<string, boolean>; other: string[] };
	/**
	 * `valid`: the endpoint accepted the B2B documents of this build. `invalid`: it refused them, `errors` says why.
	 * `unknown`: the probe was not sent or did not get that far (no token, writes blocked, network).
	 */
	schema: { contract: "valid" | "invalid" | "unknown"; errors: string[] };
	/** Why `ok` is false, as stable short codes. */
	failures: string[];
	/** Not blocking, but worth a look (e.g. the app holds more permissions than it needs). */
	warnings: string[];
};

const CACHE_KEY = Symbol.for("maky.b2b.readiness.v1");
type Registry = typeof globalThis & { [CACHE_KEY]?: { value: B2bReadiness; until: number } };

export function resetB2bReadinessCache(): void {
	delete (globalThis as Registry)[CACHE_KEY];
}

function endpointHost(): string | null {
	try {
		return new URL(process.env.NEXT_PUBLIC_SALEOR_API_URL ?? "").hostname || null;
	} catch {
		return null;
	}
}

export async function checkB2bReadiness(
	options: { fresh?: boolean; now?: () => number } = {},
): Promise<B2bReadiness> {
	const now = options.now ?? Date.now;
	const registry = globalThis as Registry;
	const cached = registry[CACHE_KEY];
	if (!options.fresh && cached && cached.until > now()) return cached.value;

	const config = readB2bRuntimeConfig();
	const decision = saleorWriteDecision();
	const failures: string[] = [];
	const warnings: string[] = [];

	const readiness: B2bReadiness = {
		ok: false,
		checkedAt: new Date(now()).toISOString(),
		uiEnabled: config.uiEnabled,
		endpointHost: endpointHost(),
		token: config.hasAppToken ? "present" : "missing",
		requester: config.requester ? "configured" : "missing",
		writes: decision.allowed ? `allowed:${decision.because}` : "blocked",
		app: null,
		permissions: {
			required: Object.fromEntries(REQUIRED_APP_PERMISSIONS.map((code) => [code, false])),
			other: [],
		},
		schema: { contract: "unknown", errors: [] },
		failures,
		warnings,
	};

	if (!readiness.endpointHost) failures.push("endpoint-missing");
	if (!config.hasAppToken) failures.push("token-missing");
	if (!config.requester) failures.push("requester-vat-id-missing");
	if (!decision.allowed) failures.push("writes-blocked");

	// The probe carries the attestation and release mutations (validated, never executed), so the write guard treats
	// it as a write: where writes are blocked it is not sent, and `writes-blocked` already says the process is not ready.
	if (config.hasAppToken && readiness.endpointHost && decision.allowed) {
		const result = await executeB2bAppGraphQL(
			MakyB2bReadinessDocument,
			{},
			{ signal: AbortSignal.timeout(8_000), operationName: MAKY_B2B_READINESS_OPERATION },
		);
		if (!result.ok) {
			if (result.error.kind === "invalid") {
				readiness.schema = { contract: "invalid", errors: result.error.messages ?? [result.error.message] };
				failures.push("schema-contract-invalid");
			} else {
				failures.push(
					`saleor-${result.error.kind}${result.error.statusCode ? `-${result.error.statusCode}` : ""}`,
				);
			}
		} else {
			readiness.schema = { contract: "valid", errors: [] };
			const { app } = result.data;
			if (!app) {
				failures.push("app-not-authenticated");
			} else {
				readiness.app = { id: app.id, name: app.name, isActive: app.isActive };
				if (app.isActive !== true) failures.push("app-inactive");
				const codes = new Set((app.permissions ?? []).map((permission) => permission.code));
				for (const code of REQUIRED_APP_PERMISSIONS) {
					readiness.permissions.required[code] = codes.has(code);
					if (!codes.has(code)) failures.push(`permission-missing-${code}`);
				}
				readiness.permissions.other = [...codes].filter(
					(code) => !(REQUIRED_APP_PERMISSIONS as readonly string[]).includes(code),
				);
				if (readiness.permissions.other.length) warnings.push("app-has-extra-permissions");
			}
		}
	}

	readiness.ok = failures.length === 0;
	registry[CACHE_KEY] = { value: readiness, until: now() + (readiness.ok ? OK_TTL_MS : FAIL_TTL_MS) };
	return readiness;
}
