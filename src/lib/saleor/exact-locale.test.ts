import { describe, expect, it } from "vitest";
import {
	resolveExactLocaleCategory,
	resolveExactLocaleMenu,
	resolveExactLocaleProduct,
	resolveExactLocaleProducts,
} from "./exact-locale";

const translatedProduct = () => ({
	id: "p1",
	name: "Strešný nosič",
	slug: "stresny-nosic",
	description: '{"blocks":[]}',
	seoTitle: "Strešný nosič",
	seoDescription: "Slovenský popis",
	translation: {
		name: "Dachträger",
		slug: "dachtraeger",
		description: '{"blocks":[{"type":"paragraph","data":{"text":"Paketinhalt"}}]}',
		seoTitle: "Dachträger kaufen",
		seoDescription: "Deutsche Beschreibung",
	},
	category: {
		name: "Strešné nosiče",
		slug: "stresne-nosice",
		translation: { name: "Dachträger", slug: "dachtraeger" },
	},
	attributes: [
		{
			attribute: {
				name: "Typ strechy",
				slug: "roof-type",
				translation: { name: "Dachtyp" },
			},
			values: [{ name: "Fixačné body", translation: { name: "Fixpunkte" } }],
		},
	],
	thumbnail: { url: "https://img/1.webp", alt: "Slovenský alt" },
	media: [
		{ url: "https://img/1.webp", alt: "Slovenský alt", type: "IMAGE" },
		{ url: "https://img/2.webp", alt: "Slovenský alt 2", type: "IMAGE" },
	],
	variants: [
		{
			nonSelectionAttributes: [
				{
					attribute: {
						name: "Upevnenie",
						slug: "mounting-type",
						translation: { name: "Befestigung" },
					},
					values: [{ name: "Fixačné body", translation: { name: "Fixpunkte" } }],
				},
			],
		},
	],
});

describe("exact-locale product boundary", () => {
	it("never exposes Slovak product, category, attribute, value, or media copy on a foreign route", () => {
		const product = resolveExactLocaleProduct(translatedProduct(), "de-DE");
		expect(product).not.toBeNull();
		expect(JSON.stringify(product)).not.toContain("Strešný");
		expect(JSON.stringify(product)).not.toContain("Obsah balenia");
		expect(JSON.stringify(product)).not.toContain("Fixačné body");
		expect(product?.name).toBe("Dachträger");
		expect(product?.slug).toBe("dachtraeger");
		expect(product?.attributes[0].attribute.name).toBe("Dachtyp");
		expect(product?.attributes[0].values[0].name).toBe("Fixpunkte");
		expect(product?.media.map((item) => item.alt)).toEqual(["Dachträger", ""]);
		expect(product?.variants[0].nonSelectionAttributes[0].attribute.name).toBe("Befestigung");
	});

	it.each(["name", "description", "seoDescription"] as const)(
		"fails closed when exact %s is missing",
		(field) => {
			const product = translatedProduct();
			product.translation[field] = "";
			expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
		},
	);

	it("falls back from a missing foreign SEO title only to the translated name", () => {
		const product = translatedProduct();
		product.translation.seoTitle = "";
		const localized = resolveExactLocaleProduct(product, "de-DE");
		expect(localized?.seoTitle).toBe("Dachträger");
		expect(localized?.seoTitle).not.toBe(product.seoTitle);
	});

	it("fails closed when one displayed attribute value has no exact translation", () => {
		const product = translatedProduct();
		product.attributes[0].values[0].translation = { name: "" };
		expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
	});

	it("fails closed instead of leaking a non-selection variant attribute", () => {
		const product = translatedProduct();
		product.variants[0].nonSelectionAttributes[0].values[0].translation = { name: "" };
		expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
	});

	it("keeps base slugs as URL-only fallback", () => {
		const product = translatedProduct();
		product.translation.slug = "";
		expect(resolveExactLocaleProduct(product, "de-DE")?.slug).toBe("stresny-nosic");
	});

	it("filters incomplete cards and reports the honest loaded-page count", () => {
		const incomplete = translatedProduct();
		incomplete.id = "p2";
		incomplete.translation.description = "";
		const result = resolveExactLocaleProducts([translatedProduct(), incomplete], "de-DE");
		expect(result.products.map((product) => product.id)).toEqual(["p1"]);
		expect(result.dropped).toBe(1);
	});
});

describe("exact-locale taxonomy and menu boundaries", () => {
	it("rejects an incomplete foreign category", () => {
		expect(
			resolveExactLocaleCategory(
				{
					name: "Strešné nosiče",
					slug: "stresne-nosice",
					description: "SK",
					seoTitle: "SK",
					seoDescription: "SK",
					translation: { name: "Dachträger", description: "DE", seoTitle: "", seoDescription: "DE" },
				},
				"de-DE",
			),
		).toBeNull();
	});

	it("drops menu items whose linked resource is not translated", () => {
		const items = resolveExactLocaleMenu(
			[
				{
					name: "Nosiče",
					translation: { name: "Träger" },
					category: { name: "Nosiče", slug: "nosice", translation: null },
				},
			],
			"de-DE",
		);
		expect(items).toEqual([]);
	});
});

describe("media ALT and the source locale", () => {
	it("leaves Saleor's own ALT untouched on the source locale", () => {
		// `localizedMedia` sits AFTER the `isSourceLocale` early return, so it
		// never runs for sk-SK. Slovak pages therefore keep whatever ALT Saleor
		// holds — the rewrite is a foreign-locale measure, not a global one.
		const product = resolveExactLocaleProduct(translatedProduct(), "sk-SK");

		expect(product?.media?.map((item) => item.alt)).toEqual(["Slovenský alt", "Slovenský alt 2"]);
	});

	it("does not leak source-language ALT onto a foreign route", () => {
		const product = resolveExactLocaleProduct(translatedProduct(), "de-DE");

		expect(product?.media?.map((item) => item.alt)).not.toContain("Slovenský alt");
	});
});
