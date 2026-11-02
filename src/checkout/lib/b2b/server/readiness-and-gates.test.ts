import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GraphQLResult } from "@/lib/graphql";

import type { MakyB2bReadinessQuery } from "../graphql";
import {
	admitB2bAction,
	B2B_ACTION_WINDOW_MS,
	B2B_ACTIONS_PER_CHECKOUT,
	isPlausibleCheckoutId,
	resetB2bActionGate,
} from "./action-gate";
import { isB2bCheckoutUiEnabled, readB2bRuntimeConfig } from "./b2b-config";
import { checkB2bReadiness, resetB2bReadinessCache } from "./b2b-readiness";
import { executeB2bAppGraphQL, setB2bAppExecutorForTests } from "./b2b-saleor-client";

/**
 * MOCKS: the Saleor transport is replaced (`setB2bAppExecutorForTests`); the readiness answers are fixtures of the
 * PROPOSED schema (`maky-b2b-v1.graphql`). The token value is an obvious fake.
 */

const FAKE_TOKEN = "fake-b2b-app-token-for-tests";
const ENV_KEYS = [
	"SALEOR_B2B_APP_TOKEN",
	"B2B_CHECKOUT_UI_ENABLED",
	"MAKY_VAT_ID",
	"VIES_REST_BASE_URL",
	"NEXT_PUBLIC_SALEOR_API_URL",
	"MAKY_SALEOR_WRITES",
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
	saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.SALEOR_B2B_APP_TOKEN = FAKE_TOKEN;
	process.env.MAKY_VAT_ID = "SK2122890660";
	// A sandbox endpoint: the write policy allows writes there without any setting.
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://saleor.invalid/graphql/";
	delete process.env.MAKY_SALEOR_WRITES;
	resetB2bReadinessCache();
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	setB2bAppExecutorForTests(null);
	resetB2bReadinessCache();
	resetB2bActionGate();
});

const readyAnswer = (patch: Partial<MakyB2bReadinessQuery> = {}): MakyB2bReadinessQuery => ({
	app: {
		id: "QXBwOjQy",
		name: "MAKY B2B checkout - production",
		isActive: true,
		permissions: [{ code: "MANAGE_TAXES" }, { code: "HANDLE_TAXES" }],
	},
	mutationType: { fields: [{ name: "checkoutComplete" }, { name: "checkoutB2bTaxAttestationUpdate" }] },
	checkoutType: { fields: [{ name: "id" }, { name: "b2bTaxState" }] },
	stateType: {
		fields: ["contextVersion", "decision", "effectiveTaxExemption", "checkedAt", "expiresAt"].map((name) => ({
			name,
		})),
	},
	...patch,
});

function answer(data: MakyB2bReadinessQuery | null, error?: GraphQLResult<unknown>) {
	const executor = vi.fn(async (_doc: unknown, options: { headers: HeadersInit }) => {
		void options;
		if (error) return error;
		return { ok: true, data } as GraphQLResult<unknown>;
	});
	setB2bAppExecutorForTests(executor as never);
	return executor;
}

describe("B2B runtime config", () => {
	it("only the literal 'true' switches the UI on", () => {
		for (const value of [undefined, "", "1", "yes", "TRUE ", "true"]) {
			if (value === undefined) delete process.env.B2B_CHECKOUT_UI_ENABLED;
			else process.env.B2B_CHECKOUT_UI_ENABLED = value;
			expect(isB2bCheckoutUiEnabled()).toBe(value?.trim().toLowerCase() === "true");
		}
	});

	it("reports the token as present without exposing it", () => {
		const config = readB2bRuntimeConfig();
		expect(config.hasAppToken).toBe(true);
		expect(JSON.stringify(config)).not.toContain(FAKE_TOKEN);
		expect(config.requester).toEqual({ memberStateCode: "SK", number: "2122890660" });
	});

	it("a VIES override must be https", () => {
		process.env.VIES_REST_BASE_URL = "http://evil.invalid";
		expect(readB2bRuntimeConfig().viesBaseUrl).toBe("https://ec.europa.eu/taxation_customs/vies/rest-api");
	});
});

describe("executeB2bAppGraphQL", () => {
	it("sends the token as a header of this call only and reduces errors to a kind", async () => {
		const executor = answer(null, {
			ok: false,
			error: { type: "http", message: `boom with ${"x".repeat(1000)}`, statusCode: 502 },
		} as never);
		const result = await executeB2bAppGraphQL({} as never, {});
		const headers = executor.mock.calls[0]?.[1].headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
		expect(result).toMatchObject({ ok: false, error: { kind: "http", statusCode: 502 } });
		if (!result.ok) expect(result.error.message.length).toBeLessThanOrEqual(500);
	});

	it("no token: nothing is sent", async () => {
		delete process.env.SALEOR_B2B_APP_TOKEN;
		const executor = answer(readyAnswer());
		expect(await executeB2bAppGraphQL({} as never, {})).toMatchObject({
			ok: false,
			error: { kind: "no-token" },
		});
		expect(executor).not.toHaveBeenCalled();
	});
});

describe("checkB2bReadiness (mocked Saleor)", () => {
	it("ok with an active app holding exactly MANAGE_TAXES and HANDLE_TAXES on a schema with the contract", async () => {
		answer(readyAnswer());
		const readiness = await checkB2bReadiness({ fresh: true });
		expect(readiness.failures).toEqual([]);
		expect(readiness).toMatchObject({
			ok: true,
			endpointHost: "saleor.invalid",
			writes: "allowed:non-production-endpoint",
			token: "present",
			requester: "configured",
			app: { id: "QXBwOjQy", isActive: true },
			permissions: { required: { MANAGE_TAXES: true, HANDLE_TAXES: true }, other: [] },
			schema: { checkoutB2bTaxState: true, stateFields: true, attestationMutation: true },
		});
		expect(JSON.stringify(readiness)).not.toContain(FAKE_TOKEN);
	});

	it("names what is missing: permission, inactive app, backend without the contract", async () => {
		answer(
			readyAnswer({
				app: {
					id: "QXBwOjQy",
					name: "x",
					isActive: false,
					permissions: [{ code: "MANAGE_TAXES" }, { code: "MANAGE_ORDERS" }],
				},
				mutationType: { fields: [{ name: "checkoutComplete" }] },
				checkoutType: { fields: [{ name: "id" }] },
				stateType: null,
			}),
		);
		const readiness = await checkB2bReadiness({ fresh: true });
		expect(readiness.ok).toBe(false);
		expect(readiness.failures).toEqual(
			expect.arrayContaining([
				"app-inactive",
				"permission-missing-HANDLE_TAXES",
				"schema-missing-b2bTaxState",
				"schema-incomplete-CheckoutB2bTaxState",
				"schema-missing-checkoutB2bTaxAttestationUpdate",
			]),
		);
		expect(readiness.warnings).toContain("app-has-extra-permissions");
		expect(readiness.permissions.other).toEqual(["MANAGE_ORDERS"]);
	});

	it("a token Saleor does not accept, or no token, is not ready", async () => {
		answer({ ...readyAnswer(), app: null });
		// (a blocked write policy is a failure too: `MAKY_SALEOR_WRITES=block`)
		expect((await checkB2bReadiness({ fresh: true })).failures).toContain("app-not-authenticated");

		delete process.env.SALEOR_B2B_APP_TOKEN;
		delete process.env.MAKY_VAT_ID;
		const readiness = await checkB2bReadiness({ fresh: true });
		expect(readiness).toMatchObject({ ok: false, token: "missing", requester: "missing" });
		expect(readiness.failures).toEqual(expect.arrayContaining(["token-missing", "requester-vat-id-missing"]));
	});

	it("is kept briefly, and a fresh probe asks again", async () => {
		const executor = answer(readyAnswer());
		let now = 1_000_000;
		await checkB2bReadiness({ now: () => now });
		await checkB2bReadiness({ now: () => now });
		expect(executor).toHaveBeenCalledTimes(1);
		await checkB2bReadiness({ fresh: true, now: () => now });
		expect(executor).toHaveBeenCalledTimes(2);
		now += 120_000;
		await checkB2bReadiness({ now: () => now });
		expect(executor).toHaveBeenCalledTimes(3);
	});
});

describe("action gate", () => {
	it("admits a person's pace and stops a script", () => {
		const t0 = 5_000_000;
		for (let i = 0; i < B2B_ACTIONS_PER_CHECKOUT; i++) expect(admitB2bAction("co-1", t0 + i)).toBe(true);
		expect(admitB2bAction("co-1", t0 + 100)).toBe(false);
		expect(admitB2bAction("co-2", t0 + 100)).toBe(true);
		expect(admitB2bAction("co-1", t0 + B2B_ACTION_WINDOW_MS + 100)).toBe(true);
	});

	it("accepts only checkout ids of a plausible shape", () => {
		expect(isPlausibleCheckoutId("Q2hlY2tvdXQ6MTIzNDU2Nzg=")).toBe(true);
		expect(isPlausibleCheckoutId("3f6c1a2e-0b5d-4e8a-9c41-2d7f8e6b1a90")).toBe(true);
		expect(isPlausibleCheckoutId("short")).toBe(false);
		expect(isPlausibleCheckoutId("a".repeat(200))).toBe(false);
		expect(isPlausibleCheckoutId("abc def ghi")).toBe(false);
		expect(isPlausibleCheckoutId(42)).toBe(false);
	});
});

describe("write policy", () => {
	it("a process that may not write to Saleor is not ready", async () => {
		process.env.MAKY_SALEOR_WRITES = "block";
		answer(readyAnswer());
		const readiness = await checkB2bReadiness({ fresh: true });
		expect(readiness).toMatchObject({ ok: false, writes: "blocked" });
		expect(readiness.failures).toContain("writes-blocked");
	});
});
