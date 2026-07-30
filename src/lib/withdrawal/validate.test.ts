import { describe, expect, it } from "vitest";

import { WITHDRAWAL_LIMITS } from "./contract";
import { validateWithdrawal, type RawWithdrawalInput } from "./validate";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function input(overrides: Partial<RawWithdrawalInput> = {}): RawWithdrawalInput {
	return {
		submissionId: VALID_UUID,
		source: "guest",
		market: "SK",
		locale: "sk",
		name: "Jana Nováková",
		email: "jana@example.sk",
		orderNumber: "ORD-1042",
		scope: "wholeOrder",
		items: [],
		note: null,
		...overrides,
	};
}

function codes(raw: RawWithdrawalInput): string[] {
	const result = validateWithdrawal(raw);
	return result.ok ? [] : result.errors.map((error) => `${error.field}:${error.code}`);
}

describe("validateWithdrawal — the minimum a notice needs", () => {
	it("accepts a whole-order guest notice", () => {
		const result = validateWithdrawal(input());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.name).toBe("Jana Nováková");
		expect(result.value.scope).toBe("wholeOrder");
		expect(result.value.source).toBe("guest");
	});

	it("accepts a partial notice with selected items", () => {
		const result = validateWithdrawal(
			input({
				scope: "selectedItems",
				items: [{ orderLineId: "line-1", productName: "Strešný box", quantity: 2 }],
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.items).toEqual([
			{ orderLineId: "line-1", productName: "Strešný box", sku: null, quantity: 2 },
		]);
	});

	it("requires a name, an e-mail and a contract identifier — and nothing else", () => {
		expect(codes(input({ name: "   " }))).toEqual(["customerName:required"]);
		expect(codes(input({ email: "" }))).toEqual(["customerEmail:required"]);
		expect(codes(input({ orderNumber: "" }))).toEqual(["orderNumber:required"]);
	});

	it("never asks for an address, an IBAN, a delivery date or a reason", () => {
		// A notice carrying none of those is complete. This is the whole point of the
		// field list: § 20a asks for a name, a contract identifier and an online
		// contact, and anything further would narrow the right by making it harder.
		expect(validateWithdrawal(input({ note: null, items: [] })).ok).toBe(true);
	});

	it("has no phone field at all — Payload's withdrawal endpoint rejects one", () => {
		// `customer` allows exactly name and email, and unknown keys are refused, so a
		// phone would fail the whole request. Collecting it only to drop it would also
		// be personal data gathered for no purpose.
		const result = validateWithdrawal(input());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(Object.keys(result.value)).not.toContain("phone");
	});
});

describe("validateWithdrawal — what it refuses to refuse", () => {
	// Each of these has an innocent explanation, and rejecting any of them would
	// destroy the evidence that a notice was ever given.
	it("accepts an order number that will never match anything", () => {
		expect(validateWithdrawal(input({ orderNumber: "asi 1042?" })).ok).toBe(true);
	});

	it("accepts a notice given before delivery", () => {
		// There is no receivedAt field to be missing, and no date arithmetic anywhere.
		expect(validateWithdrawal(input({ note: "Tovar mi ešte nebol doručený." })).ok).toBe(true);
	});

	it("accepts a notice for an order that looks far older than fourteen days", () => {
		expect(validateWithdrawal(input({ orderNumber: "ORD-1 (z januára)" })).ok).toBe(true);
	});

	it("has no field in which a reason for withdrawal could be required", () => {
		const result = validateWithdrawal(input());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(Object.keys(result.value)).not.toContain("reason");
	});
});

describe("validateWithdrawal — malformed input", () => {
	it("rejects an address that cannot be an e-mail", () => {
		expect(codes(input({ email: "jana(at)example.sk" }))).toEqual(["customerEmail:invalid"]);
		expect(codes(input({ email: "jana@example" }))).toEqual(["customerEmail:invalid"]);
		expect(codes(input({ email: "jana @example.sk" }))).toEqual(["customerEmail:invalid"]);
	});

	it("accepts the shapes a strict pattern would wrongly reject", () => {
		for (const email of ["j.n+odstupenie@sub.example.co.uk", "ěščř@example.sk", "a@b.cd"]) {
			expect(validateWithdrawal(input({ email })).ok, email).toBe(true);
		}
	});

	it("rejects a submissionId that is not a UUID", () => {
		expect(codes(input({ submissionId: "not-a-uuid" }))).toEqual(["submissionId:invalid"]);
		expect(codes(input({ submissionId: "" }))).toEqual(["submissionId:invalid"]);
	});

	it("rejects a market this form does not serve", () => {
		expect(codes(input({ market: "CZ" }))).toContain("market:unsupportedMarket");
		expect(codes(input({ locale: "cs" }))).toContain("market:unsupportedMarket");
	});

	it("rejects an unknown scope", () => {
		expect(codes(input({ scope: "halfOrder" }))).toContain("scope:required");
	});

	it("requires at least one item when the scope says selected items", () => {
		expect(codes(input({ scope: "selectedItems", items: [] }))).toContain("items:required");
	});

	it("rejects quantities below one", () => {
		const raw = input({
			scope: "selectedItems",
			items: [{ orderLineId: "l1", productName: "Nosič", quantity: 0 }],
		});
		expect(codes(raw)).toContain("items:invalidQuantity");
	});

	it("rejects a fractional quantity rather than rounding it", () => {
		const raw = input({
			scope: "selectedItems",
			items: [{ orderLineId: "l1", productName: "Nosič", quantity: 1.5 }],
		});
		expect(codes(raw)).toContain("items:invalidQuantity");
	});

	it("caps the item count at Payload's limit of 100", () => {
		const items = Array.from({ length: WITHDRAWAL_LIMITS.items + 1 }, (_, index) => ({
			orderLineId: `l${index}`,
			productName: "Nosič",
			quantity: 1,
		}));
		expect(codes(input({ scope: "selectedItems", items }))).toContain("items:tooMany");
	});

	it("rejects a note longer than the limit instead of silently truncating it", () => {
		// Truncating a legal notice would be worse than refusing it: the customer would
		// never learn that half of what they wrote was thrown away.
		expect(codes(input({ note: "x".repeat(WITHDRAWAL_LIMITS.note + 1) }))).toContain("note:tooLong");
	});
});

describe("validateWithdrawal — normalisation", () => {
	it("trims and collapses whitespace", () => {
		const result = validateWithdrawal(input({ name: "  Jana   Nováková  " }));
		expect(result.ok && result.value.name).toBe("Jana Nováková");
	});

	it("strips control characters rather than rejecting the notice", () => {
		const result = validateWithdrawal(input({ name: "Jana\u0000 Nováková\u0007" }));
		expect(result.ok && result.value.name).toBe("Jana Nováková");
	});

	it("keeps line breaks in a note but collapses runs of blank lines", () => {
		const result = validateWithdrawal(input({ note: "prvý\r\n\r\n\r\n\r\ndruhý" }));
		expect(result.ok && result.value.note).toBe("prvý\n\ndruhý");
	});

	it("treats a blank optional field as absent, not as an empty string", () => {
		const result = validateWithdrawal(input({ note: "  " }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.note).toBeNull();
	});

	it("keeps a hand-typed SKU and nulls a blank one", () => {
		const result = validateWithdrawal(
			input({
				scope: "selectedItems",
				items: [
					{ productName: "Strešný box", sku: " TH-6299 ", quantity: 1 },
					{ productName: "Nosič", sku: "  ", quantity: 1 },
				],
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.items.map((item) => item.sku)).toEqual(["TH-6299", null]);
	});

	it("never lets the client's `source` claim mean anything more than a hint", () => {
		// Saying "account" does not make it one; ownership is proven from the session.
		const result = validateWithdrawal(input({ source: "account" }));
		expect(result.ok && result.value.source).toBe("account");
		const nonsense = validateWithdrawal(input({ source: "administrator" }));
		expect(nonsense.ok && nonsense.value.source).toBe("guest");
	});

	it("reports every problem at once, so the form is not fixed one field per attempt", () => {
		expect(codes(input({ name: "", email: "nope", orderNumber: "" })).sort()).toEqual([
			"customerEmail:invalid",
			"customerName:required",
			"orderNumber:required",
		]);
	});
});
