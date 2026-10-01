import { describe, expect, it } from "vitest";

import { CATEGORY_SLUGS, STOREFRONT_CATEGORIES, categoryFitmentKind, isCategorySlug } from "./categories";
import { FITMENT_SHELVES, shelfFitmentKind } from "./fitment-shelves";

/**
 * Which shelves the vehicle filter may speak for — kept apart from the navigation registry.
 *
 * The defect this separation fixes: the Thule and Nordrive roof-rack shelves are real listings
 * that are deliberately NOT in `STOREFRONT_CATEGORIES` (a registry entry is a menu slot, a root
 * URL and a proxy rule), and the filter used to find its scope THERE. So the shelf the 9 150
 * Thule sets land on was the one shelf with no car filter at all.
 */
describe("the vehicle filter's shelves", () => {
	it("covers the main roof-rack category and both makers' shelves", () => {
		for (const slug of ["stresne-nosice", "thule-stresne-nosice", "nordrive-stresne-nosice"]) {
			expect(shelfFitmentKind(slug)).toBe("roof-rack-set");
			expect(categoryFitmentKind(slug)).toBe("roof-rack-set");
		}
	});

	it("keeps the kinds the registry used to carry, so no shelf starts or stops answering", () => {
		expect(shelfFitmentKind("stresne-boxy")).toBe("roof-box");
		expect(shelfFitmentKind("nosice-bicyklov")).toBe("bike-carrier");
		expect(shelfFitmentKind("nosice-lyzi")).toBe("ski-carrier");
	});

	it("says nothing about the shelves the programme never assessed", () => {
		for (const slug of [
			"stresne-stany",
			"autochladnicky",
			"snehove-retaze",
			"tazne-zariadenia",
			// The accessory, spare-part and fitting-kit buckets under the roof-rack family: a set's id
			// never names one of their products, so narrowing them would empty them.
			"prislusenstvo-k-stresnym-boxom",
			"nahradne-diely-k-nosicom-bicyklov",
			"does-not-exist",
			"",
		]) {
			expect(shelfFitmentKind(slug)).toBeNull();
			expect(categoryFitmentKind(slug)).toBeNull();
		}
	});

	it("is not fooled by an inherited property name", () => {
		for (const slug of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
			expect(shelfFitmentKind(slug)).toBeNull();
		}
	});

	it("adds no URL and no navigation entry — scope is not registration", () => {
		// The two maker shelves keep the address they have: no root URL, no menu slot, no proxy rule.
		expect(isCategorySlug("thule-stresne-nosice")).toBe(false);
		expect(isCategorySlug("nordrive-stresne-nosice")).toBe(false);
		expect(CATEGORY_SLUGS.has("thule-stresne-nosice")).toBe(false);
		expect(STOREFRONT_CATEGORIES.some((category) => category.slug.includes("thule"))).toBe(false);
	});

	it("keeps the registry free of scope", () => {
		// The scope used to ride on the registry as a field; if it comes back, the two drift again.
		for (const category of STOREFRONT_CATEGORIES) {
			expect(category).not.toHaveProperty("fitmentKind");
		}
	});

	it("lists only kinds the contract knows", () => {
		const known = new Set([
			"roof-rack-set",
			"roof-box",
			"ski-carrier",
			"bike-carrier",
			"fitting-kit",
			"spare-part",
			"accessory",
		]);
		for (const kind of Object.values(FITMENT_SHELVES)) expect(known.has(kind)).toBe(true);
	});
});
