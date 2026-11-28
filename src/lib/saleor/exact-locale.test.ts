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
		expect(product?.media.map((item) => item.alt)).toEqual(["Dachträger", "Dachträger – Foto 2"]);
		expect(product?.variants[0].nonSelectionAttributes[0].attribute.name).toBe("Befestigung");
	});

	it.each(["name", "description", "seoTitle", "seoDescription", "slug"] as const)(
		"fails closed when exact %s is missing",
		(field) => {
			const product = translatedProduct();
			product.translation[field] = "";
			expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
		},
	);

	it("refuses a missing foreign SEO title instead of filling it from the name (contract v2)", () => {
		const product = translatedProduct();
		product.translation.seoTitle = "";
		expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
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

	it("refuses a missing translated slug instead of publishing the Slovak one abroad (contract v2)", () => {
		const product = translatedProduct();
		product.translation.slug = "";
		expect(resolveExactLocaleProduct(product, "de-DE")).toBeNull();
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

	// FIXTURE: Slovak alts of the shape CFM writes (`name – tail`); the dictionary itself is CFM's real file.
	const withCfmAlts = () => {
		const product = translatedProduct();
		const media = [
			{ url: "https://img/1.webp", alt: "Strešný nosič – fotka výrobku", type: "IMAGE" },
			{ url: "https://img/2.webp", alt: "Strešný nosič – rozmery", type: "IMAGE" },
			{ url: "https://img/3.webp", alt: "Strešný nosič – fotka 3", type: "IMAGE" },
			{ url: "https://img/4.webp", alt: "ručne písaný alt", type: "IMAGE" },
		];
		return { ...product, media, variants: [{ ...product.variants[0], media }] };
	};

	it("builds a foreign ALT from the translated name and CFM's dictionary", () => {
		const product = resolveExactLocaleProduct(withCfmAlts(), "de-DE");
		const expected = ["Dachträger", "Dachträger – Abmessungen", "Dachträger – Foto 3", "Dachträger – Foto 4"];

		expect(product?.media?.map((item) => item.alt)).toEqual(expected);
		expect(product?.variants?.[0]?.media?.map((item) => item.alt)).toEqual(expected);
		expect(product?.thumbnail?.alt).toBe("Dachträger");
	});

	it("reads the language of the market's locale: de-AT is German, en-CA is English", () => {
		const at = resolveExactLocaleProduct(withCfmAlts(), "de-AT");
		const ca = resolveExactLocaleProduct(withCfmAlts(), "en-CA");

		expect(at?.media?.[1]?.alt).toBe("Dachträger – Abmessungen");
		expect(ca?.media?.[1]?.alt).toBe("Dachträger – dimensions");
		expect(ca?.media?.[3]?.alt).toBe("Dachträger – photo 4");
	});

	it("shows no Slovak ALT on any foreign market", () => {
		for (const locale of [
			"cs-CZ",
			"de-DE",
			"de-AT",
			"pl-PL",
			"hu-HU",
			"it-IT",
			"fr-FR",
			"es-ES",
			"ro-RO",
			"en-US",
			"en-CA",
		]) {
			const product = resolveExactLocaleProduct(withCfmAlts(), locale);
			const alts = (product?.media ?? []).map((item) => item.alt ?? "");
			expect(alts.join("|")).not.toMatch(/Strešný|nosič|ručne|rozmery/);
			expect(new Set(alts).size).toBe(alts.length);
		}
	});
});
