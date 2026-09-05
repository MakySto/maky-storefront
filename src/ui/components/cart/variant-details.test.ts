import { describe, expect, it } from "vitest";

import { getVariantDetails } from "./variant-details";

const attr = (name: string, slug: string, value: string | null) => ({
	attribute: { name, slug },
	values: value === null ? [] : [{ name: value, value }],
});

/**
 * This block existed and had never run.
 *
 * `getVariantDetails` read `variant.attributes`, a field `CheckoutFind` does not
 * return — the query aliases the two Saleor lists as `selectionAttributes` and
 * `nonSelectionAttributes`. So it was always `[]`, every drawer line fell through
 * to the bare variant name, and TypeScript stayed quiet because the property was
 * optional and `lines` is passed as a variable rather than an object literal.
 *
 * Measured on 2026-09-05: 0 of 417 live variants carry ANY attribute, selection
 * or otherwise. So the fix is correct and changes nothing a shopper can see
 * today — it starts mattering when CFM publishes variant attributes.
 */
describe("getVariantDetails", () => {
	it("reads the selection attributes", () => {
		expect(getVariantDetails({ selectionAttributes: [attr("Farba", "color", "Čierna")] })).toEqual([
			{ name: "Farba", value: "Čierna", colorHex: undefined, isColor: true },
		]);
	});

	it("puts colour first, because that is what a shopper scans for", () => {
		const result = getVariantDetails({
			selectionAttributes: [attr("Veľkosť", "size", "XL"), attr("Farba", "color", "Čierna")],
		});

		expect(result.map((a) => a.name)).toEqual(["Farba", "Veľkosť"]);
	});

	it("skips an attribute that has no value", () => {
		// A label with no answer reads as a missing value rather than an absent
		// question, which is worse than saying nothing.
		expect(getVariantDetails({ selectionAttributes: [attr("Farba", "color", null)] })).toEqual([]);
	});

	it("falls back to the slug when the attribute has no name", () => {
		const result = getVariantDetails({
			selectionAttributes: [
				{ attribute: { name: null, slug: "size" }, values: [{ name: "XL", value: "XL" }] },
			],
		});

		expect(result[0].name).toBe("size");
	});

	it("is empty, not undefined, for a variant with no attributes", () => {
		// The live catalogue today: every one of 417 variants.
		expect(getVariantDetails({ selectionAttributes: [] })).toEqual([]);
	});

	it("marks a non-colour attribute as such and gives it no swatch", () => {
		const [only] = getVariantDetails({ selectionAttributes: [attr("Veľkosť", "size", "XL")] });

		expect(only.isColor).toBe(false);
		expect(only.colorHex).toBeUndefined();
	});
});
