import { describe, expect, it } from "vitest";

import { EAN_METAFIELD_KEY, gtinProperty, publicEan, publicGtin } from "./product-ean";

/** Appends the GS1 check digit, so a test can build a number it knows is only wrong by its prefix. */
function withCheckDigit(body: string): string {
	let total = 0;
	for (let position = 0; position < body.length; position += 1) {
		total += Number(body[body.length - 1 - position]) * (position % 2 === 0 ? 3 : 1);
	}
	return body + String((10 - (total % 10)) % 10);
}

/**
 * The cases of CFM's `apps/saleor_sync/tests/test_gtin.py`, one for one. The rule is held in two
 * places on purpose (CFM does not publish a number that cannot be a GTIN, the storefront does not
 * show one it was handed by hand), and two copies of a rule only stay one rule while the same
 * cases run against both.
 */
describe("publicGtin", () => {
	it.each([
		// The five CoolZ coolers, CoolZ Power and the stand, as the onboarding manifest holds them.
		"8717809204097",
		"8717809204103",
		"8717809204110",
		"8717809204127",
		"8717809204134",
		"8717809204141",
		"8717809204394",
		// One of each other length.
		"96385074",
		"036000291452",
		"10614141000415",
		"4006381333931",
	])("a real GTIN is shown as it is: %s", (value) => {
		expect(publicGtin(value)).toBe(value);
	});

	it("trims surrounding whitespace and nothing else", () => {
		expect(publicGtin("  8717809204103\n")).toBe("8717809204103");
		expect(publicGtin("87178 09204103")).toBeNull();
		expect(publicGtin("8717809-204103")).toBeNull();
	});

	it.each([
		"",
		"   ",
		"abc",
		"8717809204104", // wrong check digit
		"871780920410", // eleven digits and a check digit is not a GTIN length
		"87178092041030000", // too long
		"8717809204103x",
		"٨٧١٧٨٠٩٢٠٤١٠٣", // Arabic-Indic digits: a lenient digit test accepts them, a barcode does not
		"²",
		"0000000000000", // passes the check digit and means nothing
		"00000000",
	])("what cannot be a GTIN is not shown: %j", (value) => {
		expect(publicGtin(value)).toBeNull();
	});

	it.each([null, undefined, 8717809204103, 8717809204103.0, ["8717809204103"], {}])(
		"only text is read: %j",
		(value) => {
			expect(publicGtin(value)).toBeNull();
		},
	);

	it.each(["200000000000", "290000000000", "020000000000", "040000000000"])(
		"a restricted circulation number is not a product identity: %s",
		(body) => {
			expect(publicGtin(withCheckDigit(body))).toBeNull();
		},
	);

	it("reads the restricted prefixes in the thirteen-digit form", () => {
		// UPC-A 2xxxxxxxxxx and 4xxxxxxxxxx are those same numbers, written with one digit less.
		expect(publicGtin(withCheckDigit("20000000000"))).toBeNull();
		expect(publicGtin(withCheckDigit("40000000000"))).toBeNull();
		// A packaging indicator in front of a restricted number does not make it a product's number.
		expect(publicGtin(withCheckDigit("1" + "200000000000"))).toBeNull();
		// An ordinary one with the same indicator is shown.
		expect(publicGtin("10614141000415")).toBe("10614141000415");
	});

	it("asks Saleor for the key CFM writes", () => {
		expect(EAN_METAFIELD_KEY).toBe("cfm_ean");
	});
});

describe("publicEan", () => {
	it("is the variant's declared number, when it is a real GTIN", () => {
		expect(publicEan({ ean: "8717809204103" })).toBe("8717809204103");
	});

	it("is nothing for a variant CFM has published no number for", () => {
		expect(publicEan({ ean: null })).toBeNull();
		expect(publicEan({})).toBeNull();
		expect(publicEan(undefined)).toBeNull();
		expect(publicEan(null)).toBeNull();
	});

	it("is nothing for a number that cannot be a GTIN, never a repaired one", () => {
		expect(publicEan({ ean: "8717809204104" })).toBeNull();
		expect(publicEan({ ean: "not-an-ean" })).toBeNull();
	});
});

describe("gtinProperty", () => {
	it("names the schema.org property by the length of the number", () => {
		expect(gtinProperty("96385074")).toEqual({ gtin8: "96385074" });
		expect(gtinProperty("036000291452")).toEqual({ gtin12: "036000291452" });
		expect(gtinProperty("8717809204103")).toEqual({ gtin13: "8717809204103" });
		expect(gtinProperty("10614141000415")).toEqual({ gtin14: "10614141000415" });
	});

	it("adds nothing for a value that is not a valid GTIN", () => {
		expect(gtinProperty("8717809204104")).toEqual({});
		expect(gtinProperty(null)).toEqual({});
		expect(gtinProperty(undefined)).toEqual({});
		expect(gtinProperty("")).toEqual({});
	});
});
