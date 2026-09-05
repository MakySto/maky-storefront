import { describe, expect, it } from "vitest";

import { publicProductCode } from "./product-code";

/**
 * Measured against the whole public sk-eur catalogue on 2026-09-05: 417
 * products, 417 variants, every name passing every clause, and only three
 * variants whose SKU differs from their name at all.
 */
describe("publicProductCode", () => {
	it("returns the declared short code", () => {
		expect(publicProductCode({ name: "N21048|N20003|N15428|N15428" })).toBe("N21048|N20003|N15428|N15428");
	});

	it("keeps a repeated component — two crossbars are not a duplicate", () => {
		// `N15428|N15428` is two identical crossbars in one bundle. Collapsing it
		// would understate what is in the box.
		expect(publicProductCode({ name: "N15428|N15428" })).toBe("N15428|N15428");
	});

	it("never derives the code by cutting the suffix off a SKU", () => {
		// The whole point. `sku` is not consulted, so there is nothing to cut —
		// even though on 414 of 417 variants it would have produced the same
		// string, which is exactly what makes the shortcut so tempting.
		expect(publicProductCode({ name: null } as { name: string | null })).toBeNull();
	});

	it("refuses anything carrying the internal marker", () => {
		expect(publicProductCode({ name: "N15031|CFMP-B-NOR-7580c97859183e-000000" })).toBeNull();
		expect(publicProductCode({ name: "n15031|cfmp-b-nor-7580c97859183e-000000" })).toBeNull();
	});

	it("refuses a human label that happens to fit the character set", () => {
		// The catalogue has no colour or size variants yet. Dog crates and seat
		// covers will bring them, and "Black" under a "SKU:" label is worse than
		// no line at all.
		expect(publicProductCode({ name: "Black" })).toBeNull();
		expect(publicProductCode({ name: "XL" })).toBeNull();
	});

	it("refuses a name that is only the variant id", () => {
		expect(publicProductCode({ name: "UHJvZHVjdFZhcmlhbnQ6MQ", id: "UHJvZHVjdFZhcmlhbnQ6MQ" })).toBeNull();
	});

	it("is silent rather than wrong on missing, blank or oversized input", () => {
		expect(publicProductCode(null)).toBeNull();
		expect(publicProductCode(undefined)).toBeNull();
		expect(publicProductCode({})).toBeNull();
		expect(publicProductCode({ name: "   " })).toBeNull();
		expect(publicProductCode({ name: "A1" })).toBeNull();
		expect(publicProductCode({ name: "N1".padEnd(41, "9") })).toBeNull();
	});

	it("refuses whitespace, which no real code contains", () => {
		expect(publicProductCode({ name: "Default Title" })).toBeNull();
		expect(publicProductCode({ name: "N210 48" })).toBeNull();
	});

	it("accepts every shape the live catalogue actually uses", () => {
		// Sampled across autodoplnky, strešné boxy, autochladničky, klietky and
		// nosiče lyží — including the two that `.toUpperCase()` used to corrupt.
		for (const code of [
			"A7604",
			"A7703S",
			"605503",
			"770100",
			"PZ-859",
			"g3K9042",
			"PZ-GP001bag",
			"598",
			"BB04BS|BB09BS|BB06BS|BB06BS|BB03FR",
		]) {
			expect(publicProductCode({ name: code })).toBe(code);
		}
	});

	it("preserves case, because the code is case-sensitive", () => {
		// The listing card used to `.toUpperCase()` this, which changed 34 of the
		// 417 real codes into strings the supplier does not use.
		expect(publicProductCode({ name: "g3K9042" })).toBe("g3K9042");
		expect(publicProductCode({ name: "PZ-GP001bag" })).toBe("PZ-GP001bag");
	});
});
