import { describe, expect, it } from "vitest";

import { STOREFRONT_CATEGORIES, categoryUrl } from "@/config/categories";
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

	it("keeps the root and the Nordrive listing apart — two identities, never one segment", () => {
		const [root, nordrive] = LOCALIZED_CATEGORIES;
		expect(root!.saleorId).not.toBe(nordrive!.saleorId);
		expect(root!.placement).toBe("root");
		expect(nordrive!.placement).toBe("listing");
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

	it("no localized segment is another catalogue category's slug", () => {
		const slugs = new Set(STOREFRONT_CATEGORIES.map((category) => category.slug));
		for (const { language, segment, category } of localized) {
			if (segment === category.baseSlug) continue;
			expect(slugs.has(segment), `${language}: ${segment}`).toBe(false);
		}
	});
});

describe("Slovakia is unchanged", () => {
	const slugs = [
		...STOREFRONT_CATEGORIES.map((category) => category.slug),
		"nordrive-stresne-nosice",
		"prislusenstvo-k-stresnym-boxom",
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
		expect(categoryUrlFor("cz-czk", "nordrive-stresni-nosice")).toBe("/categories/nordrive-stresni-nosice");
		expect(categoryUrlFor("de-eur", "nordrive-stresne-nosice")).toBe("/categories/nordrive-dachtraeger");
	});

	it("map every localized segment back to the base slug Saleor knows", () => {
		for (const row of categoryRouteTable()) {
			expect(categoryBaseSlug(row.channel, row.segment), row.path).toBe(row.baseSlug);
			expect(categorySegment(row.channel, row.baseSlug), row.path).toBe(row.segment);
		}
	});

	it("leave every other category on its base slug", () => {
		expect(categoryUrlFor("cz-czk", "stresne-boxy")).toBe("/stresne-boxy");
		expect(categoryUrlFor("cz-czk", "prislusenstvo-k-stresnym-boxom")).toBe(
			"/categories/prislusenstvo-k-stresnym-boxom",
		);
	});

	it("do not recognise another language's spelling", () => {
		expect(isLocalizedRootSegment("cz", "dachtraeger")).toBe(false);
		expect(isLocalizedRootSegment("cz", "stresni-nosice")).toBe(true);
		expect(categoryBaseSlug("cz-czk", "dachtraeger")).toBe("dachtraeger");
	});

	it("never call a listing category a root", () => {
		expect(isLocalizedRootSegment("cz", "nordrive-stresni-nosice")).toBe(false);
	});
});
