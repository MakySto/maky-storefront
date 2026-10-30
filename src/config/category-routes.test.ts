import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	CATEGORY_SLUGS,
	LIVE_CATEGORY_SLUGS_KEY,
	STOREFRONT_CATEGORIES,
	categoryUrl,
} from "@/config/categories";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { MARKET_ROOT_SEGMENTS } from "@/lib/routing.generated";
import {
	CATALOG_LANGUAGES,
	LOCALIZED_CATEGORIES,
	categoryBaseSlug,
	categoryRouteTable,
	categorySegment,
	categoryUrlFor,
	isLocalizedRootSegment,
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

describe("the Nordrive Kargo van category", () => {
	// Typed out from CFM's message of 2026-10-30 (the slugs it writes as the category's translations in the nine EU
	// markets). The USA and Canada are not in that run, so they keep the base slug.
	const SEGMENTS: Readonly<Record<string, string>> = {
		sk: "stresne-nosice-a-kose-na-dodavky",
		cz: "stresni-nosice-a-kose-na-dodavky",
		de: "dachtraeger-und-dachkoerbe-fuer-transporter",
		at: "dachtraeger-und-dachkoerbe-fuer-transporter",
		pl: "bagazniki-dachowe-i-kosze-do-samochodow-dostawczych",
		hu: "tetocsomagtartok-es-tetokosarak-kisteherautokra",
		ro: "bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
		fr: "barres-de-toit-et-galeries-pour-utilitaires",
		it: "barre-portatutto-e-cesti-per-furgoni",
		es: "barras-de-techo-y-bacas-para-furgonetas",
		us: "stresne-nosice-a-kose-na-dodavky",
		ca: "stresne-nosice-a-kose-na-dodavky",
	};
	const kargo = LOCALIZED_CATEGORIES.find(
		(category) => category.baseSlug === "stresne-nosice-a-kose-na-dodavky",
	);

	it("has the segment CFM writes, in every market", () => {
		const rows = categoryRouteTable().filter((row) => row.baseSlug === "stresne-nosice-a-kose-na-dodavky");
		expect(rows).toHaveLength(12);
		for (const row of rows) expect(row.path, row.market).toBe(`/${row.market}/${SEGMENTS[row.market]}`);
	});

	it("is the Saleor category it names (Category:34)", () => {
		expect(kargo?.saleorId).toBe(btoa("Category:34"));
	});

	// The category is not in the build's own list: the running server learns it from Saleor.
	const published = globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> };
	beforeEach(() => {
		published[LIVE_CATEGORY_SLUGS_KEY] = new Set(["stresne-nosice-a-kose-na-dodavky"]);
	});
	afterEach(() => {
		delete published[LIVE_CATEGORY_SLUGS_KEY];
	});

	it("is one address, whether the link carries the base slug or the slug Saleor translated", () => {
		for (const [market, segment] of Object.entries(SEGMENTS)) {
			expect(categoryUrlFor(market, "stresne-nosice-a-kose-na-dodavky"), market).toBe(`/${segment}`);
			expect(categoryUrlFor(market, segment), market).toBe(`/${segment}`);
			expect(categoryBaseSlug(market, segment), market).toBe("stresne-nosice-a-kose-na-dodavky");
		}
	});

	it("is a root only in the market's own spelling", () => {
		expect(isLocalizedRootSegment("de", "dachtraeger-und-dachkoerbe-fuer-transporter")).toBe(true);
		expect(isLocalizedRootSegment("at", "dachtraeger-und-dachkoerbe-fuer-transporter")).toBe(true);
		expect(isLocalizedRootSegment("pl", "bagazniki-dachowe-i-kosze-do-samochodow-dostawczych")).toBe(true);
		expect(isLocalizedRootSegment("cz", "dachtraeger-und-dachkoerbe-fuer-transporter")).toBe(false);
		expect(isLocalizedRootSegment("sk", "stresne-nosice-a-kose-na-dodavky")).toBe(false);
	});
});
