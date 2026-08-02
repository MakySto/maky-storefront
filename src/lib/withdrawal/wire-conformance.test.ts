import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { ContractSchemaValidator } from "../forms/contract-schema-validator";
import { WITHDRAWAL_LIMITS } from "./contract";
import { submitWithdrawal, type PersistPort } from "./submit";
import { normalizeWithdrawalPhone, type RawWithdrawalInput } from "./validate";

/**
 * Every body the storefront would send, validated against the contract Payload published.
 *
 * This is the test the branch did not have. The previous suite was green at 367 tests
 * while three separate fields would have failed 100 % of real requests, because the mock
 * that "verified" the wire was written from the same assumptions as the client that built
 * it. Nothing below states what the contract says — it reads
 * `__fixtures__/forms-backend-v1/withdrawal.schema.json`, vendored byte-for-byte from
 * `MakySto/maky-cms @ 459146a`, and asks it.
 *
 * If Payload changes the contract, re-vendoring the file changes what these tests accept.
 * Nobody has to remember to update a second copy of the rules, because there is no second
 * copy.
 */

const PACK = join(fileURLToPath(new URL("../forms/", import.meta.url)), "__fixtures__/forms-backend-v1");

const schema = JSON.parse(readFileSync(join(PACK, "withdrawal.schema.json"), "utf8")) as Record<
	string,
	unknown
>;
const manifest = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as {
	phoneScenarios: Record<string, string>;
	canonical: Record<string, string>;
};

const validator = new ContractSchemaValidator(schema);

function fixture(relativePath: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(PACK, relativePath), "utf8")) as Record<string, unknown>;
}

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function raw(overrides: Partial<RawWithdrawalInput> = {}): RawWithdrawalInput {
	return {
		submissionId: VALID_UUID,
		source: "guest",
		market: "SK",
		locale: "sk",
		name: "Jana Nováková",
		email: "jana@example.sk",
		phone: null,
		orderNumber: "ORD-1042",
		scope: "wholeOrder",
		items: [],
		note: null,
		...overrides,
	};
}

/** Runs the real pipeline and returns the exact object handed to the transport. */
async function bodyFor(
	overrides: Partial<RawWithdrawalInput> = {},
	verifiedOrder?: { saleorOrderId: string | null; saleorCustomerId: string | null },
): Promise<Record<string, unknown>> {
	const persist = vi.fn<PersistPort>(async () => ({ status: "unavailable" as const, reason: "captured" }));
	const outcome = await submitWithdrawal(raw(overrides), { persist, verifiedOrder });
	if (outcome.status === "invalid") {
		throw new Error(`input rejected before the wire: ${JSON.stringify(outcome.errors)}`);
	}
	return persist.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
}

function violationsFor(body: unknown): string[] {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return validator.validate(body).map((v) => `${v.path} [${v.keyword}] ${v.message}`);
	}
	// The provider has not yet published a V2 pack. Keep its V1 schema immutable and use
	// it to verify the unchanged base; focused tests below pin the four additive V2 fields.
	const { experienceVersion, customerStatement, customerOrderItems, returnMethod, ...base } = body as Record<
		string,
		unknown
	>;
	void experienceVersion;
	void customerStatement;
	void customerOrderItems;
	void returnMethod;
	return validator.validate(base).map((v) => `${v.path} [${v.keyword}] ${v.message}`);
}

describe("the validator is right — checked against the provider's own examples", () => {
	// Without this the rest of the file proves nothing: a validator that accepts
	// everything would report every body as conformant.
	// Withdrawal requests only. The pack also carries a contact-endpoint request, which
	// has its own shape and would fail this schema for good reasons.
	const canonical = Object.entries(manifest.canonical)
		.filter(([name, path]) => name.startsWith("withdrawalRequest") && path.includes(".request."))
		.map(([, path]) => path);

	it("finds the three canonical withdrawal requests", () => {
		expect(canonical).toHaveLength(3);
	});

	it.each(canonical)("accepts the canonical request %s", (relativePath) => {
		expect(violationsFor(fixture(relativePath))).toEqual([]);
	});

	it("rejects the fixture the provider marks as an invalid control character", () => {
		const violations = violationsFor(fixture(manifest.phoneScenarios.controlCharacterIsRejected));
		expect(violations.join(" ")).toContain("/customer/phone");
	});

	it("rejects the fixture the provider marks as over length", () => {
		const violations = violationsFor(fixture(manifest.phoneScenarios.thirtyThreeCharactersAreRejected));
		expect(violations.join(" ")).toContain("x-normalizedMaxLength");
	});

	it("refuses to run against a schema whose keywords it does not implement", () => {
		// The permissive-mock failure in a new coat: a contract could add a constraint and
		// a silent skip would stop enforcing it without anybody noticing.
		expect(() => new ContractSchemaValidator({ ...schema, unevaluatedProperties: false })).toThrow(
			/unsupported keyword/,
		);
	});
});

describe("what the storefront actually sends validates against the contract", () => {
	it("adds exactly the required V2 customer experience fields", async () => {
		const body = await bodyFor();
		expect(Object.keys(body).sort()).toEqual([
			"contract",
			"customer",
			"customerOrderItems",
			"customerStatement",
			"experienceVersion",
			"items",
			"legalNoticeVersion",
			"locale",
			"market",
			"note",
			"privacyNoticeVersion",
			"returnMethod",
			"scope",
			"source",
			"submissionId",
		]);
		expect(body).toMatchObject({
			experienceVersion: "returns-v2",
			customerStatement: "Odstupujem od zmluvy k objednávke ORD-1042 v celom rozsahu.",
			customerOrderItems: [],
			returnMethod: "merchantPickup",
		});
	});

	it("guest, whole order, no phone", async () => {
		expect(violationsFor(await bodyFor())).toEqual([]);
	});

	it("guest, selected items, with a phone", async () => {
		const body = await bodyFor({
			phone: "+421 901 730 066",
			scope: "selectedItems",
			items: [{ orderLineId: null, productName: "Strešný nosič", sku: null, quantity: 2 }],
		});
		expect(violationsFor(body)).toEqual([]);
		expect((body.customer as Record<string, unknown>).phone).toBe("+421 901 730 066");
	});

	it("account, whole order, with a phone and server-verified ids", async () => {
		const body = await bodyFor(
			{ source: "account", phone: "+421 901 730 066" },
			{ saleorOrderId: "T3JkZXI6MQ==", saleorCustomerId: "VXNlcjox" },
		);
		expect(violationsFor(body)).toEqual([]);
	});

	it("a note and hand-typed items", async () => {
		const body = await bodyFor({
			scope: "selectedItems",
			note: "Tovar je nepoškodený,\nposielam späť v pôvodnom obale.",
			items: [{ orderLineId: null, productName: "Nosič bicyklov", sku: "ABC-1", quantity: 1 }],
		});
		expect(violationsFor(body)).toEqual([]);
	});

	it("sends phone as an explicit null rather than omitting the key", async () => {
		// Both are legal. One shape is easier to reason about than two, and the canonical
		// fixture the provider ships uses null.
		const customer = (await bodyFor()).customer as Record<string, unknown>;
		expect("phone" in customer).toBe(true);
		expect(customer.phone).toBeNull();
	});

	it("never sends items alongside a whole-order scope", async () => {
		// The schema's else-branch allows only null or an empty array there, so passing
		// lines through would be a 400. The form already sends none; this proves the
		// library enforces it for any caller.
		const body = await bodyFor({
			scope: "wholeOrder",
			items: [{ orderLineId: "line-1", productName: "Strešný box", sku: null, quantity: 1 }],
		});
		expect(body.items).toEqual([]);
		expect(violationsFor(body)).toEqual([]);
	});
});

describe("phone normalization agrees with every scenario the provider published", () => {
	/** The phone value a scenario fixture carries, before normalization. */
	function phoneOf(relativePath: string): unknown {
		return (fixture(relativePath).customer as Record<string, unknown>).phone;
	}

	it("missing normalizes to null", () => {
		expect(normalizeWithdrawalPhone(phoneOf(manifest.phoneScenarios.missingNormalizesToNull))).toEqual({
			ok: true,
			value: null,
		});
	});

	it("null normalizes to null", () => {
		expect(normalizeWithdrawalPhone(phoneOf(manifest.phoneScenarios.nullNormalizesToNull))).toEqual({
			ok: true,
			value: null,
		});
	});

	it("empty normalizes to null", () => {
		expect(normalizeWithdrawalPhone(phoneOf(manifest.phoneScenarios.emptyNormalizesToNull))).toEqual({
			ok: true,
			value: null,
		});
	});

	it("surrounding whitespace is trimmed", () => {
		const raw = phoneOf(manifest.phoneScenarios.surroundingWhitespaceIsTrimmed);
		expect(normalizeWithdrawalPhone(raw)).toEqual({ ok: true, value: "+421 901 730 066" });
	});

	it("whitespace around a value already at the maximum is accepted", () => {
		const result = normalizeWithdrawalPhone(
			phoneOf(manifest.phoneScenarios.surroundingWhitespaceAtNormalizedMaximumIsAccepted),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect([...(result.value ?? "")]).toHaveLength(WITHDRAWAL_LIMITS.phoneCodePoints);
	});

	it("a non-ASCII character is accepted", () => {
		expect(normalizeWithdrawalPhone(phoneOf(manifest.phoneScenarios.nonAsciiIsAccepted)).ok).toBe(true);
	});

	it("a control character is refused, not stripped", () => {
		// The provider's fixture is a header-injection attempt. Stripping the newline would
		// turn a body Payload refuses into one it accepts, which is the worst option here.
		const raw = phoneOf(manifest.phoneScenarios.controlCharacterIsRejected);
		expect(normalizeWithdrawalPhone(raw)).toEqual({ ok: false, code: "invalid" });
		expect(String(raw)).toContain("Bcc:");
	});

	it("thirty-three characters are refused", () => {
		expect(
			normalizeWithdrawalPhone(phoneOf(manifest.phoneScenarios.thirtyThreeCharactersAreRejected)),
		).toEqual({ ok: false, code: "tooLong" });
	});

	it("covers every scenario the manifest declares", () => {
		// A new scenario in a future pack must fail this rather than pass unnoticed.
		expect(Object.keys(manifest.phoneScenarios)).toHaveLength(8);
	});
});

describe("phone length is measured in code points, which no vendored fixture can prove", () => {
	// Every phone fixture the provider ships is BMP-only, so `.length` passes all eight
	// and is still wrong. This is the only test that separates the two.
	const astral = "\u{1F600}";

	it("accepts 32 astral characters — 64 UTF-16 code units", () => {
		const value = astral.repeat(32);
		expect(value.length).toBe(64);
		expect([...value]).toHaveLength(32);
		expect(normalizeWithdrawalPhone(value)).toEqual({ ok: true, value });
	});

	it("refuses 33 astral characters", () => {
		expect(normalizeWithdrawalPhone(astral.repeat(33))).toEqual({ ok: false, code: "tooLong" });
	});

	it("and the contract agrees on both", () => {
		const withPhone = (phone: string) => {
			const body = fixture("fixtures/withdrawal-guest-whole-order.request.json");
			(body.customer as Record<string, unknown>).phone = phone;
			return violationsFor(body);
		};
		expect(withPhone(astral.repeat(32))).toEqual([]);
		expect(withPhone(astral.repeat(33)).join(" ")).toContain("x-normalizedMaxLength");
	});
});

describe("the storefront's limits are bound to the schema, not to a memory of it", () => {
	function schemaNode(path: string[]): Record<string, unknown> {
		let node: Record<string, unknown> = schema;
		for (const key of path) node = node[key] as Record<string, unknown>;
		return node;
	}

	it("takes the phone ceiling and its unit from the contract", () => {
		const phone = schemaNode(["properties", "customer", "properties", "phone"]);
		expect(phone["x-normalizedMaxLength"]).toBe(WITHDRAWAL_LIMITS.phoneCodePoints);
		expect(phone["x-normalizedLengthUnit"]).toBe("unicode-code-points");
		expect(phone["x-normalization"]).toBe("trim-empty-to-null");
	});

	it("refuses exactly the characters the schema's pattern refuses", () => {
		const pattern = new RegExp(
			schemaNode(["properties", "customer", "properties", "phone"]).pattern as string,
			"u",
		);
		// Sampled across C0, DEL, C1 and the printable ranges either side of them, so a
		// narrowing or widening of either rule shows up here.
		for (let code = 0; code <= 0x00ff; code++) {
			const char = String.fromCharCode(code);
			const schemaAccepts = pattern.test(char);
			const weAccept = normalizeWithdrawalPhone(`+421${char}901`).ok;
			expect(weAccept, `U+${code.toString(16).padStart(4, "0")}`).toBe(schemaAccepts);
		}
	});

	it("keeps every other limit at or under Payload's", () => {
		// A storefront limit LOOSER than the contract is a 400 the storefront could have
		// turned into a fixable inline error.
		const max = (path: string[]) => schemaNode(path)["x-normalizedMaxLength"] as number;
		expect(WITHDRAWAL_LIMITS.name).toBeLessThanOrEqual(max(["properties", "customer", "properties", "name"]));
		expect(WITHDRAWAL_LIMITS.email).toBeLessThanOrEqual(
			max(["properties", "customer", "properties", "email"]),
		);
		expect(WITHDRAWAL_LIMITS.orderNumber).toBeLessThanOrEqual(
			max(["properties", "contract", "properties", "orderNumber"]),
		);
		expect(WITHDRAWAL_LIMITS.note).toBeLessThanOrEqual(max(["properties", "note"]));
		expect(WITHDRAWAL_LIMITS.productName).toBeLessThanOrEqual(
			max(["$defs", "item", "properties", "productName"]),
		);
	});
});
