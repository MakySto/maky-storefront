import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * A vehicle page narrowed to one maker and read by price (owner, 2026-11-27: the list reached from
 * the vehicle selector has to offer what the category list offers).
 *
 * Both choices live in the page's address, beside the year and the roof, so a link to "Thule for a
 * 2024 Kuga with flush rails, cheapest first" can be saved and sent. The selects are a client
 * component that goes to an address the server built; here it is replaced by one that prints those
 * addresses, because they are what this file is about.
 */
const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../../i18n/messages");
// Loosely typed on purpose: the files are the fixture, and next-intl is not type-augmented.
const load = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8")) as Record<string, any>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

type Option = { value: string; label: string; href: string };
vi.mock("./offer-view-select", () => ({
	OfferViewSelect: ({ label, value, options }: { label: string; value: string; options: Option[] }) =>
		createElement(
			"menu",
			{ "data-select": label, "data-value": value },
			options.map((option) =>
				createElement(
					"a",
					{ key: option.value, href: option.href, "data-option": option.value },
					option.label,
				),
			),
		),
}));
vi.mock("@/ui/components/wishlist/wishlist-button", () => ({ WishlistButton: () => null }));
vi.mock("@/ui/components/plp/listing-add-to-cart", () => ({
	ListingAddToCart: ({ variantId }: { variantId: string }) =>
		createElement("button", { "data-add": variantId }),
}));

import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { type OfferFit } from "@/lib/fitment/offer-fit";
import { type RoofType } from "@/lib/fitment/contract";
import { CatalogOfferList, type OfferListView } from "./offer-list";

const PAGE = "/sk/stresne-nosice/ford/kuga/dfk";

const offer = (i: number, brand: string | null, amount: number | null): FitmentOffer => ({
	saleorProductId: `p${i}`,
	saleorVariantId: `v${i}`,
	externalReference: `ext${i}`,
	productKind: "roof-rack-set",
	name: `Set ${i}`,
	slug: `set-${i}`,
	thumbnailUrl: null,
	thumbnailAlt: null,
	brand,
	categoryName: null,
	categorySlug: null,
	price: amount === null ? null : { amount, currency: "EUR" },
	availability: "in-stock",
	completeSetIncludes: null,
	facets: null,
	isPurchasable: true,
	isDemo: false,
});

/** Five flush-rail sets of three makers, one without a price, and one Nordrive set for raised rails. */
const LIST: FitmentOffer[] = [
	offer(0, "Thule", 420),
	offer(1, "Nordrive", 180),
	offer(2, "Green Valley", null),
	offer(3, "Thule", 260),
	offer(4, "Nordrive", 95),
	offer(5, "Nordrive", 150),
];
const ROOF: Record<string, RoofType> = { p5: "raised-rails" };
const FITS = new Map<string, OfferFit[]>(
	LIST.map((row) => [
		row.saleorProductId,
		[
			{
				yearFrom: 2019,
				yearTo: null,
				roofTypes: [ROOF[row.saleorProductId] ?? "flush-rails"],
				bodyTypes: null,
			},
		],
	]),
);
const OFFERS: FitmentOffers = {
	offers: LIST,
	compatibleCount: LIST.length,
	purchasableCount: LIST.length,
	rejected: {
		"not-published": 0,
		"variant-missing": 0,
		"identity-mismatch": 0,
		"wrong-kind": 0,
		"not-sellable": 0,
		"not-localized": 0,
		"lookup-failed": 0,
	},
	lookupFailed: false,
	isDemo: false,
};

async function markup(over: Partial<OfferListView> = {}, locale = "sk-SK", value = OFFERS): Promise<string> {
	const view: OfferListView = { year: null, roof: null, years: [], path: PAGE, ...over };
	const html = renderToStaticMarkup(
		await CatalogOfferList({ offers: value, channel: "sk-eur", locale, fits: FITS, view }),
	);
	return html.replace(/&amp;/g, "&");
}

/** The options of one select: what each says and where it goes. */
const select = (html: string, label: string) => {
	const menu = html.match(new RegExp(`<menu data-select="${label}"[^>]*>(.*?)</menu>`, "s"));
	if (!menu) return null;
	return {
		value: menu[0].match(/data-value="([^"]*)"/)![1],
		options: [...menu[1]!.matchAll(/<a href="([^"]*)" data-option="[^"]*">([^<]*)<\/a>/g)].map((m) => [
			m[2],
			m[1],
		]),
	};
};
/** The sets in the order the page lists them. */
const listed = (html: string) => [...html.matchAll(/>Set (\d)</g)].map((m) => Number(m[1]));
const roofLinks = (html: string) =>
	[...(html.match(/<nav[^>]*>(.*?)<\/nav>/s)?.[1] ?? "").matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe("the makers of the list", () => {
	it("offers each maker with its number of sets, the one with the most first", async () => {
		const brands = select(await markup(), "Značka")!;
		expect(brands.value).toBe("");
		expect(brands.options).toEqual([
			["Všetky značky", PAGE],
			["Nordrive (3)", `${PAGE}?brand=nordrive`],
			["Thule (2)", `${PAGE}?brand=thule`],
			["Green Valley (1)", `${PAGE}?brand=green-valley`],
		]);
	});

	it("shows only the sets of the maker the address names, and counts them", async () => {
		const html = await markup({ brand: "thule" });
		expect(listed(html).sort()).toEqual([0, 3]);
		expect(html).toContain("2 zostavy");
		expect(select(html, "Značka")!.value).toBe("thule");
	});

	it("counts the makers of the chosen roof only", async () => {
		const brands = select(await markup({ roof: "flush-rails" }), "Značka")!;
		expect(brands.options.map((option) => option[0])).toEqual([
			"Všetky značky",
			"Nordrive (2)",
			"Thule (2)",
			"Green Valley (1)",
		]);
		expect(brands.options[2]![1]).toBe(`${PAGE}?roof=flush-rails&brand=thule`);
	});

	it("ignores a maker this list has no set of, and never empties the list by it", async () => {
		for (const html of [
			await markup({ brand: "yakima" }),
			await markup({ roof: "raised-rails", brand: "thule" }),
		]) {
			expect(listed(html).length).toBeGreaterThan(0);
			expect(html).not.toContain("tu zostavu nemáme");
		}
		// One maker under raised rails: nothing to choose, so no control.
		expect(select(await markup({ roof: "raised-rails", brand: "thule" }), "Značka")).toBeNull();
		expect(select(await markup({ brand: "yakima" }), "Značka")!.value).toBe("");
	});

	it("keeps the maker in a roof's link only where that roof has a set of it", async () => {
		expect(roofLinks(await markup({ brand: "thule", sort: "price_asc" }))).toEqual([
			`${PAGE}?brand=thule&sort=price_asc`,
			`${PAGE}?roof=raised-rails&sort=price_asc`,
			`${PAGE}?roof=flush-rails&brand=thule&sort=price_asc`,
		]);
		expect(roofLinks(await markup({ brand: "nordrive" }))).toEqual([
			`${PAGE}?brand=nordrive`,
			`${PAGE}?roof=raised-rails&brand=nordrive`,
			`${PAGE}?roof=flush-rails&brand=nordrive`,
		]);
	});

	it("offers no maker where every set is one maker's", async () => {
		const one = { ...OFFERS, offers: [LIST[0]!, LIST[3]!] };
		expect(select(await markup({}, "sk-SK", one), "Značka")).toBeNull();
	});
});

describe("the order of the list", () => {
	it("offers the page's own order and the two orders by price, as the category does", async () => {
		const order = select(
			await markup({ year: 2024, years: [2024, 2023], roof: "flush-rails" }),
			"Zoradiť podľa",
		)!;
		expect(order.value).toBe("");
		expect(order.options).toEqual([
			["Odporúčané", `${PAGE}?year=2024&roof=flush-rails`],
			["Cena: od najnižšej", `${PAGE}?year=2024&roof=flush-rails&sort=price_asc`],
			["Cena: od najvyššej", `${PAGE}?year=2024&roof=flush-rails&sort=price_desc`],
		]);
	});

	it("lists the cheapest first, and the set without a price last", async () => {
		expect(listed(await markup({ sort: "price_asc" }))).toEqual([4, 5, 1, 3, 0, 2]);
	});

	it("lists the dearest first, and the set without a price still last", async () => {
		expect(listed(await markup({ sort: "price_desc" }))).toEqual([0, 3, 1, 5, 4, 2]);
	});

	it("orders what the maker and the roof left", async () => {
		const html = await markup({ roof: "flush-rails", brand: "nordrive", sort: "price_desc" });
		expect(listed(html)).toEqual([1, 4]);
		expect(select(html, "Zoradiť podľa")!.value).toBe("price_desc");
	});

	it("keeps the maker and the order when the year changes", async () => {
		const years = select(
			await markup({ year: 2024, years: [2024, 2023], brand: "thule", sort: "price_asc" }),
			"Rok výroby",
		)!;
		expect(years.options).toEqual([
			["Všetky roky", `${PAGE}?brand=thule&sort=price_asc`],
			["2024", `${PAGE}?year=2024&brand=thule&sort=price_asc`],
			["2023", `${PAGE}?year=2023&brand=thule&sort=price_asc`],
		]);
	});

	it("offers no order for a single set", async () => {
		const one = { ...OFFERS, offers: [LIST[0]!] };
		expect(select(await markup({}, "sk-SK", one), "Zoradiť podľa")).toBeNull();
	});
});

describe("in every market's own words", () => {
	it.each([
		"cs-CZ",
		"de-AT",
		"de-DE",
		"en-CA",
		"en-US",
		"es-ES",
		"fr-FR",
		"hu-HU",
		"it-IT",
		"pl-PL",
		"ro-RO",
		"sk-SK",
	])("%s names the maker and the order controls", async (locale) => {
		const messages = load(locale);
		const html = await markup({ brand: "thule", sort: "price_asc" }, locale);
		expect(html).not.toMatch(/catalog\.view|plp\.|common\./);
		expect(select(html, messages.plp.brand)!.options[0]![0]).toBe(messages.catalog.viewAllBrands);
		expect(select(html, messages.common.sortBy)!.options.map((option) => option[0])).toEqual([
			messages.plp.featured,
			messages.plp.priceLowToHigh,
			messages.plp.priceHighToLow,
		]);
	});
});
