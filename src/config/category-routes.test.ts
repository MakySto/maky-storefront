import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	CATEGORY_SLUGS,
	LIVE_CATEGORY_SLUGS_KEY,
	STOREFRONT_CATEGORIES,
	categoryUrl,
} from "@/config/categories";
import { TYRE_SHELF_MARKETS, TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { MARKET_ROOT_SEGMENTS } from "@/lib/routing.generated";
import {
	CATALOG_LANGUAGES,
	KARGO_CATEGORY_SLUGS,
	KARGO_PREVIOUS_SLUG,
	LOCALIZED_CATEGORIES,
	categoryBaseSlug,
	categoryRouteTable,
	categorySegment,
	baseSlugOfCategory,
	categoryUrlFor,
	baseSlugForCategoryId,
	categoryRootServes,
	isKargoCategory,
	isLocalizedRootSegment,
	renamedCategoryTarget,
	saleorSlugFor,
} from "./category-routes";

/**
 * The COMMERCE-2 routing contract, as the shared CFM ↔ M document states it (§2, 16. 9. 2026).
 * Typed out here rather than derived, so a change to the map has to change this table too.
 */
const CONTRACT: Readonly<
	Record<string, { channel: string; currency: string; locale: string; root: string }>
> = {
	sk: { channel: "sk-eur", currency: "EUR", locale: "sk-SK", root: "/stresne-nosice" },
	cz: { channel: "cz-czk", currency: "CZK", locale: "cs-CZ", root: "/stresni-nosice" },
	de: { channel: "de-eur", currency: "EUR", locale: "de-DE", root: "/dachtraeger" },
	at: { channel: "at-eur", currency: "EUR", locale: "de-AT", root: "/dachtraeger" },
	pl: { channel: "pl-pln", currency: "PLN", locale: "pl-PL", root: "/bagazniki-dachowe" },
	hu: { channel: "hu-huf", currency: "HUF", locale: "hu-HU", root: "/tetocsomagtartok" },
	it: { channel: "it-eur", currency: "EUR", locale: "it-IT", root: "/barre-portatutto" },
	fr: { channel: "fr-eur", currency: "EUR", locale: "fr-FR", root: "/barres-de-toit" },
	es: { channel: "es-eur", currency: "EUR", locale: "es-ES", root: "/barras-de-techo" },
	ro: { channel: "ro-ron", currency: "RON", locale: "ro-RO", root: "/bare-transversale" },
	us: { channel: "us-usd", currency: "USD", locale: "en-US", root: "/roof-racks" },
	ca: { channel: "ca-cad", currency: "CAD", locale: "en-CA", root: "/roof-racks" },
};

describe("the category route table matches the shared contract", () => {
	it("gives every market its contracted channel, currency, locale and canonical root", () => {
		expect(Object.keys(CHANNEL_MAP)).toEqual(Object.keys(CONTRACT));
		const roots = categoryRouteTable().filter((row) => row.baseSlug === "stresne-nosice");
		expect(roots).toHaveLength(12);
		for (const row of roots) {
			const contract = CONTRACT[row.market]!;
			expect(row.channel, row.market).toBe(contract.channel);
			expect(CHANNEL_MAP[row.market]!.currency, row.market).toBe(contract.currency);
			expect(row.locale, row.market).toBe(contract.locale);
			expect(row.path, row.market).toBe(`/${row.market}${contract.root}`);
		}
	});

	it("keeps Slovakia on its base slug", () => {
		for (const row of categoryRouteTable().filter((r) => r.market === "sk")) {
			expect(row.segment).toBe(row.baseSlug);
		}
	});

	it("reads the market's editorial language, not its country: AT like DE, US and CA as one EN", () => {
		const language = (market: string) => categoryRouteTable().find((row) => row.market === market)!.language;
		expect(language("at")).toBe("de");
		expect(language("de")).toBe("de");
		expect(language("us")).toBe("en");
		expect(language("ca")).toBe("en");
		expect(language("cz")).toBe("cs");
	});

	it("keeps the root and the Nordrive shelf apart — two identities, never one segment", () => {
		const [root, nordrive] = LOCALIZED_CATEGORIES;
		expect(root!.saleorId).not.toBe(nordrive!.saleorId);
		for (const language of CATALOG_LANGUAGES) {
			const segments = LOCALIZED_CATEGORIES.map((category) => category.segments[language]);
			expect(new Set(segments).size, language).toBe(segments.length);
		}
	});

	it("spells Nordrive nordrive-<localized root>, as the contract proposes", () => {
		const [root, nordrive] = LOCALIZED_CATEGORIES;
		for (const language of CATALOG_LANGUAGES) {
			expect(nordrive!.segments[language]).toBe(`nordrive-${root!.segments[language]}`);
		}
	});
});

describe("no collision in the shared root namespace", () => {
	const localized = LOCALIZED_CATEGORIES.flatMap((category) =>
		CATALOG_LANGUAGES.map((language) => ({ language, segment: category.segments[language], category })),
	);

	it("no localized segment is also a route", () => {
		for (const { language, segment } of localized) {
			expect(MARKET_ROOT_SEGMENTS.has(segment), `${language}: ${segment}`).toBe(false);
		}
	});

	it("no localized segment is another category's slug — any of the 30 Saleor holds", () => {
		for (const { language, segment, category } of localized) {
			if (segment === category.baseSlug) continue;
			expect(CATEGORY_SLUGS.has(segment), `${language}: ${segment}`).toBe(false);
		}
	});
});

describe("Slovakia is unchanged", () => {
	const slugs = [
		...STOREFRONT_CATEGORIES.map((category) => category.slug),
		...CATEGORY_SLUGS,
		"a-category-this-build-does-not-know",
	];

	for (const key of ["sk", "sk-eur"]) {
		it(`categoryUrlFor(${key}) equals categoryUrl for every category`, () => {
			for (const slug of slugs) expect(categoryUrlFor(key, slug), slug).toBe(categoryUrl(slug));
		});
	}

	it("has no localized root to recognise", () => {
		expect(isLocalizedRootSegment("sk", "stresne-nosice")).toBe(false);
		expect(isLocalizedRootSegment("sk", "stresni-nosice")).toBe(false);
	});
});

describe("foreign markets", () => {
	it("route the roof-rack category under the localized root, by market or by channel", () => {
		expect(categoryUrlFor("cz", "stresne-nosice")).toBe("/stresni-nosice");
		expect(categoryUrlFor("cz-czk", "stresne-nosice")).toBe("/stresni-nosice");
		expect(categoryUrlFor("at-eur", "stresne-nosice")).toBe("/dachtraeger");
		expect(categoryUrlFor("us-usd", "stresne-nosice")).toBe("/roof-racks");
		expect(categoryUrlFor("ca", "stresne-nosice")).toBe("/roof-racks");
	});

	it("accept a spelling Saleor already translated and still land on the canonical URL", () => {
		expect(categoryUrlFor("cz-czk", "stresni-nosice")).toBe("/stresni-nosice");
		expect(categoryUrlFor("cz-czk", "nordrive-stresni-nosice")).toBe("/nordrive-stresni-nosice");
		expect(categoryUrlFor("de-eur", "nordrive-stresne-nosice")).toBe("/nordrive-dachtraeger");
	});

	it("map every localized segment back to the base slug Saleor knows", () => {
		for (const row of categoryRouteTable()) {
			expect(categoryBaseSlug(row.channel, row.segment), row.path).toBe(row.baseSlug);
			expect(categorySegment(row.channel, row.baseSlug), row.path).toBe(row.segment);
		}
	});

	it("leave every other category on its base slug, at the root like the rest (owner, 2026-10-06)", () => {
		expect(categoryUrlFor("cz-czk", "stresne-boxy")).toBe("/stresne-boxy");
		expect(categoryUrlFor("cz-czk", "prislusenstvo-k-stresnym-boxom")).toBe(
			"/prislusenstvo-k-stresnym-boxom",
		);
		expect(categoryUrlFor("de-eur", "nosice-bicyklov-na-tazne-zariadenie")).toBe(
			"/nosice-bicyklov-na-tazne-zariadenie",
		);
	});

	it("keep a category this build does not know on its /categories/ URL, which still works", () => {
		// Created in Saleor after src/config/categories.ts was last written, and not yet seen by the
		// live category list (`lib/live-categories.ts`): the proxy cannot tell it from a product, so
		// it keeps the URL it has until the live list knows the slug.
		expect(categoryUrlFor("cz-czk", "a-category-this-build-does-not-know")).toBe(
			"/categories/a-category-this-build-does-not-know",
		);
		// A slug Saleor translated and the table does not map is left for the page to resolve.
		expect(categoryUrlFor("de-eur", "fahrradtraeger")).toBe("/categories/fahrradtraeger");
	});

	it("do not recognise another language's spelling", () => {
		expect(isLocalizedRootSegment("cz", "dachtraeger")).toBe(false);
		expect(isLocalizedRootSegment("cz", "stresni-nosice")).toBe(true);
		expect(categoryBaseSlug("cz-czk", "dachtraeger")).toBe("dachtraeger");
	});

	it("recognise the localized Nordrive spelling as a root in its own market only", () => {
		expect(isLocalizedRootSegment("cz", "nordrive-stresni-nosice")).toBe(true);
		expect(isLocalizedRootSegment("cz", "nordrive-dachtraeger")).toBe(false);
		expect(isLocalizedRootSegment("sk", "nordrive-stresne-nosice")).toBe(false);
	});
});

describe("the car-fridge category", () => {
	// What CFM writes as the category's translated slug, typed out so the row has to keep it (the CoolZ
	// translation pack, 2026-10-08). To be compared with what Saleor holds once CFM has written it.
	const SEGMENTS: Readonly<Record<string, string>> = {
		sk: "autochladnicky",
		cz: "autochladnicky",
		de: "kuehlboxen-fuers-auto",
		at: "kuehlboxen-fuers-auto",
		pl: "lodowki-samochodowe",
		hu: "autos-hutoladak",
		it: "frigoriferi-portatili",
		fr: "glacieres-pour-voiture",
		es: "neveras-de-coche",
		ro: "frigidere-auto",
		us: "portable-refrigerators-freezers",
		ca: "portable-refrigerators-freezers",
	};

	it("has the segment CFM writes, in every market", () => {
		const rows = categoryRouteTable().filter((row) => row.baseSlug === "autochladnicky");
		expect(rows).toHaveLength(12);
		for (const row of rows) expect(row.path, row.market).toBe(`/${row.market}/${SEGMENTS[row.market]}`);
	});

	it("is the Saleor category it names (Category:10)", () => {
		const fridges = LOCALIZED_CATEGORIES.find((category) => category.baseSlug === "autochladnicky");
		expect(fridges?.saleorId).toBe(btoa("Category:10"));
	});

	it("is one address, whether the link carries the base slug or the slug Saleor translated", () => {
		// The product page links with the translated slug, the menu and the home page with the base one.
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(categoryUrlFor(market, "autochladnicky"), market).toBe(`/${segment}`);
			expect(categoryUrlFor(market, segment), market).toBe(`/${segment}`);
			expect(categoryBaseSlug(market, segment), market).toBe("autochladnicky");
		}
	});

	it("is a root only in the market's own spelling, and in Slovakia only as the base slug", () => {
		expect(isLocalizedRootSegment("de", "kuehlboxen-fuers-auto")).toBe(true);
		expect(isLocalizedRootSegment("at", "kuehlboxen-fuers-auto")).toBe(true);
		expect(isLocalizedRootSegment("cz", "kuehlboxen-fuers-auto")).toBe(false);
		expect(isLocalizedRootSegment("sk", "autochladnicky")).toBe(false);
		// The Czech spelling is the base slug itself: recognised through the category list, not as a spelling.
		expect(isLocalizedRootSegment("cz", "autochladnicky")).toBe(false);
	});
});

describe("the Thule roof-rack category", () => {
	// What CFM writes as the category's translated slug, typed out so the row has to keep it
	// (THULE_CATEGORY_L10N_MANIFEST of the foreign Thule run, CFM 3348ecc6, 2026-10-11; the English slug of the
	// USA and Canada from the run that followed, CFM d221edc9). To be compared with what Saleor holds.
	const SEGMENTS: Readonly<Record<string, string>> = {
		sk: "thule-stresne-nosice",
		cz: "thule-stresni-nosice",
		de: "thule-dachtraeger",
		at: "thule-dachtraeger",
		pl: "thule-bagazniki-dachowe",
		hu: "thule-tetocsomagtartok",
		it: "thule-barre-portatutto",
		fr: "thule-barres-de-toit",
		es: "thule-barras-de-techo",
		ro: "thule-bare-transversale",
		us: "thule-roof-racks",
		ca: "thule-roof-racks",
	};
	const thule = LOCALIZED_CATEGORIES.find((category) => category.baseSlug === "thule-stresne-nosice");

	it("has the segment CFM writes, in every market", () => {
		const rows = categoryRouteTable().filter((row) => row.baseSlug === "thule-stresne-nosice");
		expect(rows).toHaveLength(12);
		for (const row of rows) expect(row.path, row.market).toBe(`/${row.market}/${SEGMENTS[row.market]}`);
	});

	it("is the Saleor category it names (Category:6)", () => {
		expect(thule?.saleorId).toBe(btoa("Category:6"));
	});

	it("is spelled thule-<localized root> in every language but Slovak, which keeps the base slug", () => {
		const [root] = LOCALIZED_CATEGORIES;
		for (const language of CATALOG_LANGUAGES) {
			expect(thule!.segments[language], language).toBe(
				language === "sk" ? "thule-stresne-nosice" : `thule-${root!.segments[language]}`,
			);
		}
	});

	it("gives the USA and Canada the one English segment CFM writes for both (EN and EN_CA)", () => {
		for (const [market, channel] of [
			["us", "us-usd"],
			["ca", "ca-cad"],
		] as const) {
			expect(categoryUrlFor(market, "thule-stresne-nosice"), market).toBe("/thule-roof-racks");
			expect(categoryUrlFor(channel, "thule-roof-racks"), channel).toBe("/thule-roof-racks");
			expect(categoryBaseSlug(channel, "thule-roof-racks"), channel).toBe("thule-stresne-nosice");
		}
	});

	it("is one address, whether the link carries the base slug or the slug Saleor translated", () => {
		// The product page links with the translated slug, the nav and the listing chips with the base one.
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(categoryUrlFor(market, "thule-stresne-nosice"), market).toBe(`/${segment}`);
			expect(categoryUrlFor(market, segment), market).toBe(`/${segment}`);
			expect(categoryBaseSlug(market, segment), market).toBe("thule-stresne-nosice");
		}
	});

	it("is a root only in the market's own spelling, and in Slovakia only as the base slug", () => {
		expect(isLocalizedRootSegment("de", "thule-dachtraeger")).toBe(true);
		expect(isLocalizedRootSegment("at", "thule-dachtraeger")).toBe(true);
		expect(isLocalizedRootSegment("cz", "thule-stresni-nosice")).toBe(true);
		expect(isLocalizedRootSegment("us", "thule-roof-racks")).toBe(true);
		expect(isLocalizedRootSegment("ca", "thule-roof-racks")).toBe(true);
		expect(isLocalizedRootSegment("cz", "thule-dachtraeger")).toBe(false);
		expect(isLocalizedRootSegment("de", "thule-stresni-nosice")).toBe(false);
		expect(isLocalizedRootSegment("us", "thule-dachtraeger")).toBe(false);
		expect(isLocalizedRootSegment("de", "thule-roof-racks")).toBe(false);
		// The base slug is a spelling nowhere: Slovakia keeps it, the English markets reach it as the base slug.
		for (const market of ["sk", "us", "ca"]) {
			expect(isLocalizedRootSegment(market, "thule-stresne-nosice"), market).toBe(false);
		}
	});
});

describe("the snow-chain category", () => {
	// What CFM writes as the category's translated slug in the nine EU languages
	// (SNEHOVE_RETAZE_CATEGORY_L10N_MANIFEST of the foreign chain run, 2026-11-08), typed out so the row has to keep it.
	// Austria reads the German translation. The USA and Canada are not part of the run, so no English slug exists and
	// their address stays the base slug.
	const BASE = "snehove-retaze";
	const SEGMENTS: Readonly<Record<string, string>> = {
		sk: BASE,
		cz: "snehove-retezy",
		de: "schneeketten",
		at: "schneeketten",
		pl: "lancuchy-sniegowe",
		hu: "holancok",
		it: "catene-da-neve",
		fr: "chaines-a-neige",
		es: "cadenas-de-nieve",
		ro: "lanturi-de-zapada",
		us: BASE,
		ca: BASE,
	};
	const OFFERED = Object.keys(SEGMENTS).filter((market) => !["sk", "us", "ca"].includes(market));
	const chains = LOCALIZED_CATEGORIES.find((category) => category.baseSlug === BASE);

	it("has the segment CFM writes in the nine EU markets and the base slug everywhere else", () => {
		const rows = categoryRouteTable().filter((row) => row.baseSlug === BASE);
		expect(rows).toHaveLength(12);
		for (const row of rows) expect(row.path, row.market).toBe(`/${row.market}/${SEGMENTS[row.market]}`);
		expect(OFFERED).toHaveLength(9);
	});

	it("is the Saleor category it names (Category:9)", () => {
		expect(chains?.saleorId).toBe(btoa("Category:9"));
		expect(baseSlugForCategoryId(btoa("Category:9"))).toBe(BASE);
	});

	it("is the shelf the tyre-size filter narrows, so a rename of its slug has to come here", () => {
		expect(TYRE_SHELF_SLUG).toBe(BASE);
		for (const market of Object.keys(SEGMENTS)) {
			expect(categoryUrlFor(market, TYRE_SHELF_SLUG), market).toBe(`/${SEGMENTS[market]}`);
		}
	});

	it("is led to from a market's homepage exactly where it is sold, and every such market has its address in the table", () => {
		// A tyre size given on the homepage leads to the shelf only in a market that sells it. Slovakia and the nine EU
		// markets of the foreign chain run do; the USA and Canada do not (CFM wrote nothing there). A market added to
		// `TYRE_SHELF_MARKETS` without its row in the table would send the shopper to a second, untranslated address.
		expect([...TYRE_SHELF_MARKETS].sort()).toEqual(["sk", ...OFFERED].sort());
		for (const market of TYRE_SHELF_MARKETS) {
			expect(categoryUrlFor(market, TYRE_SHELF_SLUG), market).toBe(`/${SEGMENTS[market]}`);
		}
		for (const market of ["us", "ca"]) expect(TYRE_SHELF_MARKETS.has(market), market).toBe(false);
	});

	it("is one address, whether the link carries the base slug or the slug Saleor translated", () => {
		// The product page links with the translated slug, the shelf link and the size filter with the base one.
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(categoryUrlFor(market, BASE), market).toBe(`/${segment}`);
			expect(categoryUrlFor(market, segment), market).toBe(`/${segment}`);
			expect(categoryUrlFor(CHANNEL_MAP[market]!.saleorSlug, segment), market).toBe(`/${segment}`);
			expect(categoryBaseSlug(market, segment), market).toBe(BASE);
			expect(categoryUrlFor(market, segment), market).not.toContain("/categories/");
		}
	});

	it("is found by its id on a product, whatever slug the product's category carries in the market", () => {
		for (const market of OFFERED) {
			expect(baseSlugOfCategory(market, { id: btoa("Category:9"), slug: SEGMENTS[market] }), market).toBe(
				BASE,
			);
			expect(baseSlugOfCategory(market, { slug: SEGMENTS[market] }), market).toBe(BASE);
		}
	});

	it("shares Germany's spelling in Austria: one language, no spelling of its own", () => {
		expect(chains?.marketSegments).toBeUndefined();
		expect(chains?.legacySegments).toBeUndefined();
		expect(SEGMENTS.at).toBe(SEGMENTS.de);
		expect(isLocalizedRootSegment("at", SEGMENTS.de!)).toBe(true);
		expect(categorySegment("at", BASE)).toBe(categorySegment("de", BASE));
	});

	it("is a root only in the market's own spelling, and nowhere in Slovakia, the USA and Canada", () => {
		for (const market of OFFERED)
			expect(isLocalizedRootSegment(market, SEGMENTS[market]!), market).toBe(true);
		for (const market of ["sk", "us", "ca"]) {
			// The base slug is a spelling nowhere: these markets reach the category through the category list.
			expect(isLocalizedRootSegment(market, BASE), market).toBe(false);
		}
		expect(isLocalizedRootSegment("cz", SEGMENTS.de!)).toBe(false);
		expect(isLocalizedRootSegment("de", SEGMENTS.cz!)).toBe(false);
		expect(isLocalizedRootSegment("de", SEGMENTS.fr!)).toBe(false);
		expect(isLocalizedRootSegment("us", SEGMENTS.de!)).toBe(false);
		expect(isLocalizedRootSegment("sk", SEGMENTS.cz!)).toBe(false);
	});

	it("moves nothing in the markets that are not part of the run", () => {
		// Before this row the USA and Canada answered at the base slug, and they still do.
		expect(categoryUrlFor("us", BASE)).toBe(`/${BASE}`);
		expect(categoryUrlFor("ca", BASE)).toBe(`/${BASE}`);
		expect(categoryRootServes("us", BASE)).toBe(true);
		expect(categoryRootServes("sk", BASE)).toBe(true);
		// Another category's address is not changed by the new row.
		expect(categoryUrlFor("de", "stresne-nosice")).toBe("/dachtraeger");
		expect(categoryUrlFor("de", "autochladnicky")).toBe("/kuehlboxen-fuers-auto");
	});

	it("keeps its spellings clear of every other category's, in every language", () => {
		for (const language of CATALOG_LANGUAGES) {
			const spellings = LOCALIZED_CATEGORIES.map((category) => category.segments[language]);
			expect(new Set(spellings).size, language).toBe(spellings.length);
		}
	});
});

describe("the Nordrive Kargo van category", () => {
	// Typed out from the table the owner chose on 2026-10-30 (names in `Kargo_kategoria_nazvy_a_slugy_20261030.md`),
	// not derived from the code: Austria and Canada are spelled apart from Germany and the USA.
	const BASE = "kargo-stresne-nosice-a-stresne-kose-na-dodavky";
	const SEGMENTS: Readonly<Record<string, string>> = {
		sk: BASE,
		cz: "kargo-stresni-nosice-a-stresni-kose-na-dodavky",
		de: "kargo-dachtraeger-und-dachkoerbe-fuer-transporter",
		at: "kargo-dachtraeger-und-dachkoerbe-fuer-lieferwagen",
		pl: "kargo-bagazniki-dachowe-i-kosze-dachowe-do-samochodow-dostawczych",
		hu: "kargo-tetocsomagtartok-es-tetokosarak-kisteherautokra",
		ro: "kargo-bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
		fr: "kargo-barres-et-galeries-de-toit-pour-utilitaires",
		it: "kargo-barre-portatutto-e-ceste-portacarico-per-furgoni",
		es: "kargo-barras-de-techo-y-portaequipajes-para-furgonetas",
		us: "kargo-roof-racks-and-crossbars-for-vans",
		ca: "kargo-van-roof-racks-and-crossbars",
	};
	const kargo = LOCALIZED_CATEGORIES.find((category) => category.baseSlug === BASE);

	// The category is not in the build's own list: the running server learns it from Saleor.
	const published = globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> };
	beforeEach(() => {
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set([BASE]);
	});
	afterEach(() => {
		delete published[LIVE_CATEGORY_SLUGS_KEY];
	});

	it("has the segment the owner chose, in every market", () => {
		const rows = categoryRouteTable().filter((row) => row.baseSlug === BASE);
		expect(rows).toHaveLength(12);
		for (const row of rows) expect(row.path, row.market).toBe(`/${row.market}/${SEGMENTS[row.market]}`);
	});

	it("spells Austria apart from Germany and Canada apart from the USA, and no other pair", () => {
		expect(SEGMENTS.at).not.toBe(SEGMENTS.de);
		expect(SEGMENTS.ca).not.toBe(SEGMENTS.us);
		expect(new Set(Object.values(SEGMENTS)).size).toBe(12);
	});

	it("is the Saleor category it names (Category:34)", () => {
		expect(kargo?.saleorId).toBe(btoa("Category:34"));
	});

	it("is one address, whether the link carries the base slug or the slug Saleor translated", () => {
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(categoryUrlFor(market, BASE), market).toBe(`/${segment}`);
			expect(categoryUrlFor(market, segment), market).toBe(`/${segment}`);
			expect(categoryBaseSlug(market, segment), market).toBe(BASE);
		}
	});

	it("is a root only in the market's own spelling, also where two markets share a language", () => {
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(isLocalizedRootSegment(market, segment), market).toBe(market !== "sk");
		}
		expect(isLocalizedRootSegment("de", SEGMENTS.at!)).toBe(false);
		expect(isLocalizedRootSegment("at", SEGMENTS.de!)).toBe(false);
		expect(isLocalizedRootSegment("us", SEGMENTS.ca!)).toBe(false);
		expect(isLocalizedRootSegment("ca", SEGMENTS.us!)).toBe(false);
		expect(isLocalizedRootSegment("cz", SEGMENTS.de!)).toBe(false);
	});

	it("leaves the other rows of a shared language as they were", () => {
		expect(categorySegment("at", "stresne-nosice")).toBe("dachtraeger");
		expect(categorySegment("ca", "stresne-nosice")).toBe("roof-racks");
		expect(categorySegment("ca", "thule-stresne-nosice")).toBe("thule-roof-racks");
	});

	// What Saleor held on 2026-11-02 (read anonymously, `kargo-zahranicie-citania-20261102.txt`): the translated
	// slugs have no `kargo-` in front, so they are NOT the table's segments; the id is the same in every language.
	const KARGO_ID = btoa("Category:34");
	const SALEOR_SLUGS: Readonly<Record<string, string>> = {
		cz: "stresni-nosice-a-kose-na-dodavky",
		de: "dachtraeger-und-dachkoerbe-fuer-transporter",
		at: "dachtraeger-und-dachkoerbe-fuer-transporter",
		pl: "bagazniki-dachowe-i-kosze-do-samochodow-dostawczych",
		hu: "tetocsomagtartok-es-tetokosarak-kisteherautokra",
		ro: "bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
		fr: "barres-de-toit-et-galeries-pour-utilitaires",
		it: "barre-portatutto-e-cesti-per-furgoni",
		es: "barras-de-techo-y-bacas-para-furgonetas",
	};

	it("is the Kargo shelf by its id, whatever slug Saleor translated it to in the market", () => {
		for (const [market, slug] of Object.entries(SALEOR_SLUGS)) {
			const category = { id: KARGO_ID, slug };
			expect(isKargoCategory(market, category), market).toBe(true);
			expect(isKargoCategory(CHANNEL_MAP[market]!.saleorSlug, category), market).toBe(true);
			expect(baseSlugOfCategory(market, category), market).toBe(BASE);
		}
		// Slovakia and the English markets carry the slug Saleor holds for the base row.
		expect(isKargoCategory("sk", { id: KARGO_ID, slug: KARGO_PREVIOUS_SLUG })).toBe(true);
		expect(isKargoCategory("us", { id: KARGO_ID, slug: KARGO_PREVIOUS_SLUG })).toBe(true);
	});

	it("is the Kargo shelf by the table's spelling too, for a category that arrives without an id", () => {
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(isKargoCategory(market, { slug: segment }), market).toBe(true);
			expect(isKargoCategory(market, { slug: BASE }), market).toBe(true);
			expect(isKargoCategory(market, { slug: KARGO_PREVIOUS_SLUG }), market).toBe(true);
			expect(baseSlugOfCategory(market, { slug: segment }), market).toBe(BASE);
		}
	});

	it("is not the Kargo shelf for any other category, abroad or at home", () => {
		const roofRacks = { id: btoa("Category:2"), slug: "dachtraeger" };
		expect(isKargoCategory("de", roofRacks)).toBe(false);
		expect(baseSlugOfCategory("de", roofRacks)).toBe("stresne-nosice");
		expect(isKargoCategory("de", { slug: "autochladnicky" })).toBe(false);
		// A category the table does not know falls back to its slug, unchanged.
		expect(baseSlugOfCategory("de", { id: "Q2F0ZWdvcnk6OTk5", slug: "autochladnicky" })).toBe(
			"autochladnicky",
		);
		// Another market's spelling is not this market's.
		expect(isKargoCategory("cz", { slug: SEGMENTS.de! })).toBe(false);
		for (const none of [null, undefined, {}, { slug: "" }, { id: "", slug: null }]) {
			expect(isKargoCategory("de", none)).toBe(false);
			expect(baseSlugOfCategory("de", none)).toBeNull();
		}
	});

	it("keeps the old Kargo slug for the shelf and the quote button, while Saleor still names it", () => {
		expect(KARGO_CATEGORY_SLUGS).toEqual([BASE, KARGO_PREVIOUS_SLUG]);
	});
});

describe("the Kargo category while Saleor still holds its first slug (read 2026-11-02)", () => {
	const BASE = "kargo-stresne-nosice-a-stresne-kose-na-dodavky";
	const published = globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> };
	// The slugs CFM wrote as the category's first translations, typed out from the Saleor read.
	const FIRST_TRANSLATIONS: Readonly<Record<string, string>> = {
		cz: "stresni-nosice-a-kose-na-dodavky",
		de: "dachtraeger-und-dachkoerbe-fuer-transporter",
		at: "dachtraeger-und-dachkoerbe-fuer-transporter",
		pl: "bagazniki-dachowe-i-kosze-do-samochodow-dostawczych",
		hu: "tetocsomagtartok-es-tetokosarak-kisteherautokra",
		ro: "bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
		fr: "barres-de-toit-et-galeries-pour-utilitaires",
		it: "barre-portatutto-e-cesti-per-furgoni",
		es: "barras-de-techo-y-bacas-para-furgonetas",
	};

	beforeEach(() => {
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set([KARGO_PREVIOUS_SLUG]);
	});
	afterEach(() => {
		delete published[LIVE_CATEGORY_SLUGS_KEY];
	});

	it("asks Saleor for the slug it holds, and for the new one the moment it holds that", () => {
		expect(saleorSlugFor(BASE)).toBe(KARGO_PREVIOUS_SLUG);
		expect(saleorSlugFor(KARGO_PREVIOUS_SLUG)).toBe(KARGO_PREVIOUS_SLUG);
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set([BASE]);
		expect(saleorSlugFor(BASE)).toBe(BASE);
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set([BASE, KARGO_PREVIOUS_SLUG]);
		expect(saleorSlugFor(BASE)).toBe(BASE);
		delete published[LIVE_CATEGORY_SLUGS_KEY];
		expect(saleorSlugFor(BASE)).toBe(BASE);
		expect(saleorSlugFor("stresne-nosice")).toBe("stresne-nosice");
	});

	it("names the category by its id, whatever slug a translation gave it", () => {
		expect(baseSlugForCategoryId(btoa("Category:34"))).toBe(BASE);
		expect(baseSlugForCategoryId(btoa("Category:5"))).toBe("nordrive-stresne-nosice");
		expect(baseSlugForCategoryId(btoa("Category:999"))).toBeNull();
		expect(baseSlugForCategoryId(null)).toBeNull();
	});

	it("serves the localized root abroad at once, and keeps Slovakia on its old root until the rename", () => {
		for (const market of Object.keys(CHANNEL_MAP).filter((m) => m !== "sk")) {
			expect(categoryRootServes(market, BASE), market).toBe(true);
			expect(categoryUrlFor(market, BASE), market).not.toContain("/categories/");
		}
		expect(categoryRootServes("sk", BASE)).toBe(false);
		expect(categoryUrlFor("sk", KARGO_PREVIOUS_SLUG)).toBe(`/${KARGO_PREVIOUS_SLUG}`);
		// A chip that knows the category by id asks for the new base slug: it must not land on `/categories/…`.
		expect(categoryUrlFor("sk", BASE)).toBe(`/${KARGO_PREVIOUS_SLUG}`);
	});

	it("reads every first translated slug as the category, and links it to the canonical root", () => {
		for (const [market, legacy] of Object.entries(FIRST_TRANSLATIONS)) {
			expect(categoryBaseSlug(market, legacy), market).toBe(BASE);
			expect(categoryUrlFor(market, legacy), market).toBe(`/${categorySegment(market, BASE)}`);
			expect(renamedCategoryTarget(market, [legacy]), market).toBe(`/${categorySegment(market, BASE)}`);
			expect(renamedCategoryTarget(market, [legacy, "x", "y"]), market).toBe(
				`/${categorySegment(market, BASE)}/x/y`,
			);
		}
	});

	it("sends the Slovak first slug to the new root abroad at once, and in Slovakia only after the rename", () => {
		for (const market of Object.keys(CHANNEL_MAP).filter((m) => m !== "sk")) {
			expect(renamedCategoryTarget(market, [KARGO_PREVIOUS_SLUG]), market).toBe(
				`/${categorySegment(market, BASE)}`,
			);
		}
		expect(renamedCategoryTarget("sk", [KARGO_PREVIOUS_SLUG])).toBeNull();
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set([BASE]);
		expect(renamedCategoryTarget("sk", [KARGO_PREVIOUS_SLUG])).toBe(`/${BASE}`);
	});

	it("leaves another language's spelling and other roots alone", () => {
		expect(renamedCategoryTarget("de", [FIRST_TRANSLATIONS.pl!])).toBeNull();
		expect(renamedCategoryTarget("de", ["dachtraeger"])).toBeNull();
		expect(renamedCategoryTarget("sk", ["stresne-nosice"])).toBeNull();
		expect(renamedCategoryTarget("de", [])).toBeNull();
	});
});
