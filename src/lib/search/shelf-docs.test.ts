import { describe, expect, it } from "vitest";
import { isAccessoryCategory, toShelfDoc } from "./shelf-docs";

const carriers = {
	id: "c1",
	name: "Nosiče bicyklov",
	slug: "nosice-bicyklov",
	translation: { name: "Fahrradträger" },
};
const towbar = {
	id: "c2",
	name: "Nosiče bicyklov na ťažné zariadenie",
	slug: "nosice-bicyklov-na-tazne-zariadenie",
	translation: { name: "Fahrradträger für die Anhängerkupplung" },
	parent: carriers,
};

const product = {
	id: "UHJvZHVjdDoyNzU=",
	name: "Pro-USER Diamant FG2 – nosič bicyklov na ťažné zariadenie pre 2 bicykle",
	created: "2026-07-28T21:52:07+00:00",
	isAvailableForPurchase: true,
	ean: "8717809917591",
	category: towbar,
	attributes: [
		{ attribute: { slug: "manufacturer", inputType: "DROPDOWN" }, values: [{ name: "Pro-USER" }] },
		{ attribute: { slug: "material", inputType: "PLAIN_TEXT" }, values: [{ name: "hliník, oceľ" }] },
		{ attribute: { slug: "load", inputType: "NUMERIC" }, values: [{ name: "60" }] },
		{ attribute: { slug: "story", inputType: "RICH_TEXT" }, values: [{ name: "dlhý text" }] },
		{
			attribute: { slug: "note", inputType: "PLAIN_TEXT" },
			values: [{ name: "Veta dlhšia než štyridsať znakov nie je vlastnosť, ale popis." }],
		},
	],
	pricing: { priceRange: { start: { gross: { amount: 499 } } } },
	variants: [{ sku: "CFMP-PRO-TK91759", name: "TK91759" }],
};

const baseSlugOf = (category: { slug?: string | null }) => category.slug ?? null;

describe("a product as the index reads it", () => {
	it("carries its maker, its category chain, the other words for its shelf, and its codes", () => {
		const doc = toShelfDoc(product, { language: "sk", localized: false, baseSlugOf });
		expect(doc).toMatchObject({
			id: "UHJvZHVjdDoyNzU=",
			brand: "Pro-USER",
			categorySlug: "nosice-bicyklov-na-tazne-zariadenie",
			rootCategorySlug: "nosice-bicyklov",
			categoryNames: ["Nosiče bicyklov na ťažné zariadenie", "Nosiče bicyklov"],
			accessory: false,
			purchasable: true,
			price: 499,
		});
		expect(doc.codes).toEqual(["CFMP-PRO-TK91759", "TK91759", "8717809917591"]);
		expect(doc.synonyms).toContain("cyklonosič");
	});

	it("keeps a short property and leaves out a bare number, a long sentence and rich text", () => {
		const doc = toShelfDoc(product, { language: "sk", localized: false, baseSlugOf });
		expect(doc.attributes).toEqual(["hliník, oceľ"]);
	});

	it("names a parent category abroad by its translation only", () => {
		const german = { ...product, category: { ...towbar, name: "Fahrradträger für die Anhängerkupplung" } };
		const doc = toShelfDoc(german, { language: "de", localized: true, baseSlugOf });
		expect(doc.categoryNames).toEqual(["Fahrradträger für die Anhängerkupplung", "Fahrradträger"]);
		expect(doc.synonyms).toContain("Kupplungsträger");

		const untranslated = {
			...german,
			category: { ...german.category, parent: { ...carriers, translation: null } },
		};
		expect(toShelfDoc(untranslated, { language: "de", localized: true, baseSlugOf }).categoryNames).toEqual([
			"Fahrradträger für die Anhängerkupplung",
		]);
	});

	it("knows an accessory or a spare part by its category", () => {
		expect(isAccessoryCategory("prislusenstvo-k-nosicom-bicyklov")).toBe(true);
		expect(isAccessoryCategory("nahradne-diely-k-nosicom-bicyklov")).toBe(true);
		// A fitting kit is made for one car: it follows the bars and the feet it belongs to.
		expect(isAccessoryCategory("montazne-kity-stresnych-nosicov")).toBe(true);
		expect(isAccessoryCategory("priecniky-stresnych-nosicov")).toBe(false);
		expect(isAccessoryCategory("nosice-bicyklov")).toBe(false);
	});
});
