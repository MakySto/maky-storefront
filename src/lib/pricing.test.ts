import { describe, expect, it } from "vitest";

import { compareAtLineTotal } from "./pricing";

/**
 * The drawer struck through a pre-discount total and the full cart page showed
 * none, so the two surfaces described the same line differently. Nobody can see
 * it today — 0 of 417 live variants have `priceUndiscounted > price` — which is
 * exactly when a disagreement about a PRICE gets locked in.
 */
describe("compareAtLineTotal", () => {
	it("multiplies the undiscounted UNIT price by the quantity", () => {
		expect(compareAtLineTotal({ price: 80, priceUndiscounted: 100, currency: "EUR", quantity: 3 })).toEqual({
			amount: 300,
			currency: "EUR",
		});
	});

	it("is null when nothing is discounted", () => {
		expect(
			compareAtLineTotal({ price: 100, priceUndiscounted: 100, currency: "EUR", quantity: 1 }),
		).toBeNull();
	});

	it("is null when the undiscounted price is missing", () => {
		expect(compareAtLineTotal({ price: 100, currency: "EUR", quantity: 1 })).toBeNull();
	});

	it("handles a zero price rather than treating it as absent", () => {
		// `0` is falsy; `hasDiscount` uses typeof for exactly this reason.
		expect(compareAtLineTotal({ price: 0, priceUndiscounted: 50, currency: "EUR", quantity: 2 })).toEqual({
			amount: 100,
			currency: "EUR",
		});
	});

	it("refuses a nonsensical quantity instead of rendering a wrong number", () => {
		expect(
			compareAtLineTotal({ price: 80, priceUndiscounted: 100, currency: "EUR", quantity: 0 }),
		).toBeNull();
		expect(
			compareAtLineTotal({ price: 80, priceUndiscounted: 100, currency: "EUR", quantity: Number.NaN }),
		).toBeNull();
	});

	it("is null without a currency — an amount alone cannot be rendered", () => {
		expect(compareAtLineTotal({ price: 80, priceUndiscounted: 100, quantity: 1 })).toBeNull();
	});
});
