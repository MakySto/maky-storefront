import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * A generation page with the roof and the years on every set.
 *
 * The page lists EVERY set of the generation — 14 on the median page, 104 on the largest, across
 * several roofs and several windows of years, with no car chosen. Without the facts, sets of every
 * roof read alike under a heading that says "compatible"; this pins what it says instead, and in
 * every market's own words.
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

// The heart is a client component with its own translation context; no assertion here is about it.
vi.mock("@/ui/components/wishlist/wishlist-button", () => ({ WishlistButton: () => null }));
vi.mock("@/ui/components/plp/listing-add-to-cart", () => ({
	ListingAddToCart: ({ variantId }: { variantId: string }) =>
		createElement("button", { "data-add": variantId }),
}));

import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { type OfferFit } from "@/lib/fitment/offer-fit";
import { CatalogOfferList } from "./offer-list";

const offer = (i: number, over: Partial<FitmentOffer> = {}): FitmentOffer => ({
	saleorProductId: `p${i}`,
	saleorVariantId: `v${i}`,
	externalReference: `ext${i}`,
	productKind: "roof-rack-set",
	name: `Set ${i}`,
	slug: `set-${i}`,
	thumbnailUrl: null,
	thumbnailAlt: null,
	categoryName: null,
	categorySlug: null,
	price: { amount: 300, currency: "EUR" },
	availability: "on-demand",
	completeSetIncludes: null,
	facets: null,
	isPurchasable: true,
	isDemo: false,
	...over,
});

const NONE = {
	"not-published": 0,
	"variant-missing": 0,
	"identity-mismatch": 0,
	"wrong-kind": 0,
	"not-sellable": 0,
	"not-localized": 0,
	"lookup-failed": 0,
} as const;

const offers = (over: Partial<FitmentOffers> = {}): FitmentOffers => ({
	offers: [],
	compatibleCount: 0,
	purchasableCount: 0,
	rejected: { ...NONE },
	lookupFailed: false,
	isDemo: false,
	...over,
});

const fit = (over: Partial<OfferFit> = {}): OfferFit => ({
	yearFrom: 2018,
	yearTo: 2021,
	roofTypes: ["flush-rails"],
	bodyTypes: null,
	...over,
});

async function text(value: FitmentOffers, fits: Map<string, OfferFit[]>, locale = "sk-SK"): Promise<string> {
	const html = renderToStaticMarkup(
		await CatalogOfferList({ offers: value, channel: "sk-eur", locale, fits }),
	);
	return html
		.replace(/<!-- -->/g, "")
		.replace(/<[^>]+>/g, "|")
		.replace(/&#x27;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&");
}

const MIXED = offers({
	offers: [offer(0), offer(1), offer(2), offer(3)],
	compatibleCount: 4,
	purchasableCount: 4,
});
const MIXED_FITS = new Map<string, OfferFit[]>([
	["p0", [fit({ roofTypes: ["flush-rails"], yearFrom: 2022, yearTo: null })]],
	["p1", [fit({ roofTypes: ["raised-rails"], yearFrom: 2018, yearTo: 2021 })]],
	["p2", [fit({ roofTypes: ["flush-rails"], yearFrom: 2018, yearTo: 2021 })]],
	// p3 has no application in the map: it names no roof and no years.
]);

describe("what the page says about its sets", () => {
	it("stops calling the list 'compatible' — nothing on it has been matched to a car", async () => {
		const rendered = await text(MIXED, MIXED_FITS);
		expect(rendered).toContain("|Zostavy pre túto generáciu|");
		expect(rendered).not.toContain("Kompatibilné zostavy");
		// The lead used to say the sets were "not chosen for your car" on a page whose URL names one;
		// it now says what each set applies to and where the difference is read.
		expect(rendered).toContain(
			"Každá zostava platí len pre uvedený typ strechy a roky, rozdiely vidíte priamo na kartách. Máte iné auto? Zmeňte ho v hlavičke.",
		);
		expect(rendered).not.toContain("nie sú vybrané podľa vášho auta");
	});

	it("puts the roof and the years the set is made for on every card", async () => {
		const rendered = await text(MIXED, MIXED_FITS);
		expect(rendered).toContain("Strecha: Integrované pozdĺžniky · Roky: 2018 – 2021");
		expect(rendered).toContain("Strecha: Pozdĺžniky nad strechou · Roky: 2018 – 2021");
		// An open window reads "od", not a made-up end.
		expect(rendered).toContain("Strecha: Integrované pozdĺžniky · Roky: od 2022");
	});

	it("offers a roof filter where the page mixes several roofs, and counts each", async () => {
		const rendered = await text(MIXED, MIXED_FITS);
		// All of them, then the classic roof, then integrated, then the sets that name no roof last —
		// one list of every set, not one shelf per roof.
		const order = [
			"Všetky",
			"Pozdĺžniky nad strechou",
			"Integrované pozdĺžniky",
			"Bez určeného typu strechy",
		].map((label) => rendered.indexOf(`|${label}|`));
		expect(order.every((at) => at >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		expect(rendered).toContain("|Integrované pozdĺžniky|2|");
		expect(rendered).toContain("|Všetky|4|");
		expect(rendered).not.toContain('<h3 class="text-text-primary text-base');
	});

	it("counts a set made for several roofs under each of them, and does not call the page one roof", async () => {
		const both = offers({
			offers: [offer(0), offer(1)],
			compatibleCount: 2,
			purchasableCount: 2,
		});
		const rendered = await text(
			both,
			new Map<string, OfferFit[]>([
				["p0", [fit({ roofTypes: ["flush-rails", "raised-rails"] })]],
				["p1", [fit({ roofTypes: ["raised-rails"] })]],
			]),
		);
		// p0 is both an integrated-rails set and a raised-rails set: it is found under either chip.
		expect(rendered).toContain("|Všetky|2|");
		expect(rendered).toContain("|Pozdĺžniky nad strechou|2|");
		expect(rendered).toContain("|Integrované pozdĺžniky|1|");
		// Two roofs on a card are said, and nothing adds to the cart until the shopper has chosen.
		expect(rendered).toContain("Strecha: Integrované pozdĺžniky, Pozdĺžniky nad strechou");
		expect(rendered).not.toContain("data-add");
	});

	it("lists a group oldest window first", async () => {
		const rendered = await text(MIXED, MIXED_FITS);
		expect(rendered.indexOf("|Set 2|")).toBeLessThan(rendered.indexOf("|Set 0|"));
	});

	it("keeps the way on to the set's page where the roofs are mixed — the shopper has to say which is theirs", async () => {
		const rendered = await text(MIXED, MIXED_FITS);
		expect(rendered).not.toContain("data-add");
		expect(rendered.match(/Zobraziť zostavu/g)).toHaveLength(4);
	});

	it("lets every set on a one-roof page add to the cart itself", async () => {
		const single = new Map<string, OfferFit[]>(["p0", "p1", "p2"].map((id) => [id, [fit()]]));
		const html = renderToStaticMarkup(
			await CatalogOfferList({
				offers: offers({ offers: [offer(0), offer(1), offer(2)], compatibleCount: 3, purchasableCount: 3 }),
				channel: "sk-eur",
				locale: "sk-SK",
				fits: single,
			}),
		);
		expect(html.match(/data-add="v\d"/g)).toHaveLength(3);
		expect(html).not.toContain("Zobraziť zostavu");
	});

	it("keeps the link when a set names no roof — the page is then not one roof", async () => {
		// p3 has no application in the map: nothing says which roof it is for.
		const html = renderToStaticMarkup(
			await CatalogOfferList({
				offers: offers({ offers: [offer(0), offer(3)], compatibleCount: 2, purchasableCount: 2 }),
				channel: "sk-eur",
				locale: "sk-SK",
				fits: new Map([["p0", [fit()]]]),
			}),
		);
		expect(html).not.toContain("data-add");
		expect(html.match(/Zobraziť zostavu/g)).toHaveLength(2);
	});

	it("adds no group headings to a page with one roof", async () => {
		const single = new Map<string, OfferFit[]>(["p0", "p1", "p2", "p3"].map((id) => [id, [fit()]]));
		const rendered = await text(MIXED, single);
		expect(rendered).not.toContain("|Bez určeného typu strechy|");
		expect(rendered).not.toContain("|Všetky|");
		expect(rendered).toContain("Strecha: Integrované pozdĺžniky · Roky: 2018 – 2021");
	});

	it("says nothing about a roof for a set that names none — it never fills one in", async () => {
		const rendered = await text(
			offers({ offers: [offer(3)], compatibleCount: 1, purchasableCount: 1 }),
			new Map(),
		);
		expect(rendered).not.toContain("Strecha:");
		expect(rendered).not.toContain("Roky:");
	});
});

describe("what a card says the set contains", () => {
	const documented = offers({
		offers: [offer(0, { completeSetIncludes: ["bars", "feet", "fitting-kit"], facets: { maxLoadKg: 90 } })],
		compatibleCount: 1,
		purchasableCount: 1,
	});
	const one = new Map<string, OfferFit[]>([["p0", [fit()]]]);

	async function withFacts(
		facts?: Map<string, { facets: Record<string, number> | null; includes: string[] | null }>,
	) {
		const html = renderToStaticMarkup(
			await CatalogOfferList({ offers: documented, channel: "sk-eur", locale: "sk-SK", fits: one, facts }),
		);
		return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "|");
	}

	it("says what the offer carries when the page was given no rows to read", async () => {
		const rendered = await withFacts();
		expect(rendered).toContain("Kompletná zostava");
		expect(rendered).toContain("priečniky, pätky, montážny kit");
	});

	it("says nothing of a set no sellable row speaks for, and what the rows agree on otherwise", async () => {
		const silent = await withFacts(new Map());
		expect(silent).not.toContain("Kompletná zostava");
		expect(silent).not.toContain("priečniky");
		expect(silent).not.toContain("90 kg");

		const disagreeing = await withFacts(new Map([["p0", { facets: { maxLoadKg: 75 }, includes: null }]]));
		expect(disagreeing).not.toContain("Kompletná zostava");
		expect(disagreeing).not.toContain("priečniky");
		expect(disagreeing).toContain("75 kg");
		expect(disagreeing).not.toContain("90 kg");
	});

	it("wears the badge only for bars, feet and the fitting kit all documented", async () => {
		const barsAndKit = await withFacts(
			new Map([["p0", { facets: null, includes: ["bars", "fitting-kit"] }]]),
		);
		expect(barsAndKit).not.toContain("Kompletná zostava");
		expect(barsAndKit).toContain("priečniky, montážny kit");
		expect(barsAndKit).not.toContain("neúpln");
	});
});

describe("when the sets exist and the shop does not sell them", () => {
	it("says so, in the configurator's own two sentences — not 'unverified'", async () => {
		const hidden = offers({ compatibleCount: 3, rejected: { ...NONE, "not-published": 3 } });
		const rendered = await text(hidden, new Map());
		expect(rendered).toContain(
			"Kompatibilné zostavy pre toto vozidlo existujú, ale momentálne nie sú v predaji. Neznamená to, že na vaše vozidlo nič nepasuje.",
		);
		expect(rendered).not.toContain("zatiaľ nie sú overené");
	});

	it("keeps the old wording where nothing was hidden", async () => {
		const rendered = await text(offers({ compatibleCount: 3 }), new Map());
		expect(rendered).toContain("Nejaké záznamy existujú, ale zatiaľ nie sú overené.");
	});
});

describe("in every market's own words", () => {
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
		it(locale, async () => {
			const rendered = await text(MIXED, MIXED_FITS, locale);
			const own = load(locale);
			expect(rendered).toContain(`|${own.catalog.offersTitleGeneration}|`);
			expect(rendered).toContain(own.catalog.offersBrowseNote);
			expect(rendered).toContain(own.fitment.cardRoof.replace("{roof}", own.fitment.roofFlushRails));
			// None of the new Slovak sentences leaks into another market.
			for (const sk of ["Zostavy pre túto generáciu", "Strecha:", "Roky:", "Bez určeného typu strechy"]) {
				// "Roky:" is also how Czech says it, and cs-CZ's own file does; a string that IS the
				// market's translation is not a leak.
				if (own.fitment.cardYears.startsWith(sk) || own.fitment.cardRoof.startsWith(sk)) continue;
				expect(rendered).not.toContain(sk);
			}
		});
	}
});
