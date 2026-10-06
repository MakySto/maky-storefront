import { describe, expect, it } from "vitest";

import { CATEGORY_SLUGS, STOREFRONT_CATEGORIES, categoryUrl } from "@/config/categories";
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
