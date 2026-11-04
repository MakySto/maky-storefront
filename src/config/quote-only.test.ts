import { describe, expect, it } from "vitest";

import { quoteInsteadOfPrice } from "./quote-only";

const KARGO = "stresne-nosice-a-kose-na-dodavky";

describe("quoteInsteadOfPrice", () => {
	it("hides the price of a Kargo product the channel does not sell", () => {
		expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug: KARGO })).toBe(true);
	});

	it("hides it under the new category slug too, and under the old one until Saleor is renamed", () => {
		for (const categorySlug of ["kargo-stresne-nosice-a-stresne-kose-na-dodavky", KARGO]) {
			expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug }), categorySlug).toBe(true);
		}
	});

	it("keeps the price where the channel sells it — the market decides, not the category", () => {
		expect(quoteInsteadOfPrice({ isPurchasable: true, categorySlug: KARGO })).toBe(false);
	});

	it("leaves every other category alone, the car fridges included", () => {
		expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug: "autochladnicky" })).toBe(false);
		expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug: "nordrive-stresne-nosice" })).toBe(
			false,
		);
	});

	it("never hides a price on a surface that does not know the category", () => {
		expect(quoteInsteadOfPrice({ isPurchasable: false })).toBe(false);
		expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug: null })).toBe(false);
		expect(quoteInsteadOfPrice({ isPurchasable: false, categorySlug: "" })).toBe(false);
	});
});
