import "server-only";

import { saleorWriteDecision } from "@/lib/saleor/write-policy";

import { MakyB2bReadinessDocument } from "../graphql";
import { readB2bRuntimeConfig } from "./b2b-config";
import { executeB2bAppGraphQL } from "./b2b-saleor-client";

/**
 * Is THIS running process able to offer the automatic exemption?
 *
 * A green deploy is not the answer: `deploy-production.sh` only warns when the secret sync fails, and a missing SSM
 * parameter is skipped with the old `.env` kept. So the running app asks Saleor itself, with the token it actually
 * holds, and reports names, ids and booleans — never a value. When this is not `ok`, the company block still works
 * (a company buys with VAT), but no VIES result is sent and no exemption is offered.
 *
 * Kept briefly per process so a checkout render does not cost a Saleor round trip each time.
 */

export const REQUIRED_APP_PERMISSIONS = ["MANAGE_TAXES", "HANDLE_TAXES"] as const;
const REQUIRED_STATE_FIELDS = [
	"contextVersion",
	"decision",
	"effectiveTaxExemption",
	"checkedAt",
	"expiresAt",
];
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
	schema: { checkoutB2bTaxState: boolean; stateFields: boolean; attestationMutation: boolean };
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
		schema: { checkoutB2bTaxState: false, stateFields: false, attestationMutation: false },
		failures,
		warnings,
	};

	if (!readiness.endpointHost) failures.push("endpoint-missing");
	if (!config.hasAppToken) failures.push("token-missing");
	if (!config.requester) failures.push("requester-vat-id-missing");
	if (!decision.allowed) failures.push("writes-blocked");

	if (config.hasAppToken && readiness.endpointHost) {
		const result = await executeB2bAppGraphQL(
			MakyB2bReadinessDocument,
			{},
			{ signal: AbortSignal.timeout(8_000) },
		);
		if (!result.ok) {
			failures.push(
				`saleor-${result.error.kind}${result.error.statusCode ? `-${result.error.statusCode}` : ""}`,
			);
		} else {
			const { app, mutationType, checkoutType, stateType } = result.data;
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
			const checkoutFields = new Set((checkoutType?.fields ?? []).map((field) => field.name));
			const stateFields = new Set((stateType?.fields ?? []).map((field) => field.name));
			const mutations = new Set((mutationType?.fields ?? []).map((field) => field.name));
			readiness.schema = {
				checkoutB2bTaxState: checkoutFields.has("b2bTaxState"),
				stateFields: REQUIRED_STATE_FIELDS.every((field) => stateFields.has(field)),
				attestationMutation: mutations.has("checkoutB2bTaxAttestationUpdate"),
			};
			if (!readiness.schema.checkoutB2bTaxState) failures.push("schema-missing-b2bTaxState");
			if (!readiness.schema.stateFields) failures.push("schema-incomplete-CheckoutB2bTaxState");
			if (!readiness.schema.attestationMutation)
				failures.push("schema-missing-checkoutB2bTaxAttestationUpdate");
		}
	}

	readiness.ok = failures.length === 0;
	registry[CACHE_KEY] = { value: readiness, until: now() + (readiness.ok ? OK_TTL_MS : FAIL_TTL_MS) };
	return readiness;
}
