import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryUrlFor } from "@/config/category-routes";
import { proxy } from "@/proxy";
import { liveCategoriesStats, prewarmLiveCategories, resetLiveCategoriesForTests } from "./live-categories";
import { installFakeSaleor } from "./live-categories.testkit";

/**
 * Saleor as `api.maky.store` answered the category list on 2026-11-15, read from the browser the shop is opened in,
 * with the translation of every language a foreign market reads: 35 categories, 8 of them translated.
 *
 * The first deploy of the translated-address read (PR 119, 2026-11-15 18:00 UTC) printed
 * `localized spellings=0 refused=9` at boot, and the question was whether Saleor's translations were read wrongly.
 * They were not. Every translation Saleor holds is one the table already spells, except the nine of Category:34, the
 * Nordrive Kargo shelf: Saleor still holds it under the slug of its first night, `stresne-nosice-a-kose-na-dodavky`,
 * with the first translations, while the table's row is named `kargo-…` and keeps those nine as `legacySegments`
 * that answer a redirect. The read compared base SLUGS, saw "a spelling of kargo-…" in the table, and refused its
 * own category's translations as if another category held them. This file replays that Saleor and pins what the
 * server has to make of it: nothing to learn, nothing to refuse, nothing to warn about.
 */

const ID = {
	"default-category": "Q2F0ZWdvcnk6MQ==",
	"stresne-nosice": "Q2F0ZWdvcnk6Mg==",
	"nordrive-stresne-nosice": "Q2F0ZWdvcnk6NQ==",
	"thule-stresne-nosice": "Q2F0ZWdvcnk6Ng==",
	"snehove-retaze": "Q2F0ZWdvcnk6OQ==",
	autochladnicky: "Q2F0ZWdvcnk6MTA=",
	"stresne-nosice-a-kose-na-dodavky": "Q2F0ZWdvcnk6MzQ=",
	"diely-stresnych-nosicov": "Q2F0ZWdvcnk6MzU=",
	"patky-stresnych-nosicov": "Q2F0ZWdvcnk6MzY=",
} as const;

const LIVE_CATEGORIES = [
	"default-category",
	"stresne-nosice",
	"stresne-boxy",
	"tazne-zariadenia",
	"nordrive-stresne-nosice",
	"thule-stresne-nosice",
	"nosice-bicyklov",
	"nosice-lyzi",
	"snehove-retaze",
	"autochladnicky",
	"prislusenstvo-k-stresnym-boxom",
	"nahradne-diely-k-stresnym-boxom",
	"nosice-bicyklov-na-strechu",
	"nosice-bicyklov-na-tazne-zariadenie",
	"nosice-bicyklov-na-zadne-dvere",
	"prislusenstvo-k-nosicom-bicyklov",
	"nahradne-diely-k-nosicom-bicyklov",
	"drziaky-a-stojany-na-bicykle",
	"preprava-zvierat",
	"ochranne-mreze-a-bariery",
	"ochranne-potahy-do-auta",
	"prislusenstvo-k-prepravnym-klietkam",
	"prepravne-klietky-pre-psov-do-auta",
	"autodoplnky",
	"nosice-kajakov-a-surfov",
	"stresne-stany",
	"opravne-sady",
	"prislusenstvo-k-nosicom-lyzi",
	"prislusenstvo-k-stresnym-stanom",
	"vanicky-do-kufra",
	"green-valley-stresne-nosice",
	"menabo-stresne-nosice",
	"stresne-nosice-a-kose-na-dodavky",
	"diely-stresnych-nosicov",
	"patky-stresnych-nosicov",
];

const roofRacks = (prefix: string) => ({
	CS: `${prefix}stresni-nosice`,
	DE: `${prefix}dachtraeger`,
	DE_AT: `${prefix}dachtraeger`,
	PL: `${prefix}bagazniki-dachowe`,
	HU: `${prefix}tetocsomagtartok`,
	IT: `${prefix}barre-portatutto`,
	FR: `${prefix}barres-de-toit`,
	ES: `${prefix}barras-de-techo`,
	RO: `${prefix}bare-transversale`,
	EN: `${prefix}roof-racks`,
	EN_CA: `${prefix}roof-racks`,
});

const LIVE_TRANSLATIONS: Record<string, Record<string, string>> = {
	"stresne-nosice": roofRacks(""),
	"nordrive-stresne-nosice": roofRacks("nordrive-"),
	"thule-stresne-nosice": roofRacks("thule-"),
	"snehove-retaze": {
		CS: "snehove-retezy",
		DE: "schneeketten",
		DE_AT: "schneeketten",
		PL: "lancuchy-sniegowe",
		HU: "holancok",
		IT: "catene-da-neve",
		FR: "chaines-a-neige",
		ES: "cadenas-de-nieve",
		RO: "lanturi-de-zapada",
	},
	autochladnicky: {
		CS: "autochladnicky",
		DE: "kuehlboxen-fuers-auto",
		DE_AT: "kuehlboxen-fuers-auto",
		PL: "lodowki-samochodowe",
		HU: "autos-hutoladak",
		IT: "frigoriferi-portatili",
		FR: "glacieres-pour-voiture",
		ES: "neveras-de-coche",
		RO: "frigidere-auto",
		EN: "portable-refrigerators-freezers",
		EN_CA: "portable-refrigerators-freezers",
	},
	// The Kargo shelf, still under its first-night slug: the nine translations CFM wrote first.
	"stresne-nosice-a-kose-na-dodavky": {
		CS: "stresni-nosice-a-kose-na-dodavky",
		DE: "dachtraeger-und-dachkoerbe-fuer-transporter",
		DE_AT: "dachtraeger-und-dachkoerbe-fuer-transporter",
		PL: "bagazniki-dachowe-i-kosze-do-samochodow-dostawczych",
		HU: "tetocsomagtartok-es-tetokosarak-kisteherautokra",
		IT: "barre-portatutto-e-cesti-per-furgoni",
		FR: "barres-de-toit-et-galeries-pour-utilitaires",
		ES: "barras-de-techo-y-bacas-para-furgonetas",
		RO: "bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
	},
	"diely-stresnych-nosicov": {
		CS: "dily-stresnich-nosicu",
		DE: "einzelteile-fuer-dachtraeger",
		DE_AT: "dachtraeger-einzelteile",
		PL: "czesci-bagaznikow-dachowych",
		HU: "tetocsomagtarto-alkatreszek",
		IT: "componenti-per-portapacchi-da-tetto",
		FR: "pieces-pour-barres-de-toit",
		ES: "piezas-para-barras-de-techo",
		RO: "piese-pentru-bare-de-acoperis",
	},
	"patky-stresnych-nosicov": {
		CS: "patky-stresnich-nosicu",
		DE: "fusssaetze-fuer-dachtraeger",
		DE_AT: "traegerfuesse-fuer-dachtraeger",
		PL: "stopy-bagaznikow-dachowych",
		HU: "tetocsomagtarto-talpak",
		IT: "piedi-per-portapacchi-da-tetto",
		FR: "pieds-pour-barres-de-toit",
		ES: "pies-para-barras-de-techo",
		RO: "picioare-pentru-bare-de-acoperis",
	},
};

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const where = (response: Response) => new URL(response.headers.get("location") ?? "http://none").pathname;

let lines: string[];

beforeEach(() => {
	resetLiveCategoriesForTests();
	lines = [];
	vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
	vi.spyOn(console, "warn").mockImplementation((line: string) => void lines.push(line));
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetLiveCategoriesForTests();
});

const liveWorld = () =>
	installFakeSaleor({
		categories: [...LIVE_CATEGORIES],
		translations: structuredClone(LIVE_TRANSLATIONS),
		ids: ID,
	});

describe("Saleor as it was on 2026-11-15", () => {
	it("says what the boot line of the first deploy said, minus the refusals that were not one", async () => {
		liveWorld();
		await prewarmLiveCategories({ waitMs: 5_000 });

		// `deploy-production.sh` reads this line by its exact shape: 32 in the build, 3 more in Saleor.
		expect(lines).toContain("[live-categories] floor=32 live=3 refused=0 loaded=yes");
		expect(lines).toContain("[live-categories] localized spellings=0 refused=0");
		expect(lines.filter((line) => line.includes("NOT routed"))).toEqual([]);
	});

	it("takes the three categories no list names, and no spelling: the table already has every translation", async () => {
		liveWorld();
		await prewarmLiveCategories({ waitMs: 5_000 });

		const stats = liveCategoriesStats();
		// Created after the floor was written: the two shelves of the brands and the Kargo shelf under its first slug.
		expect(stats.admitted).toEqual([
			"green-valley-stresne-nosice",
			"menabo-stresne-nosice",
			"stresne-nosice-a-kose-na-dodavky",
		]);
		expect(stats.localized).toEqual({});
		expect(stats.localizedRefused).toEqual({});
	});

	it("does not ask Saleor whether a product holds a slug the table spells: there is nothing to admit", async () => {
		const { world } = liveWorld();
		await prewarmLiveCategories({ waitMs: 5_000 });
		expect(world.spellingProbeQueries).toEqual([]);
	});

	it("leaves every address where the table puts it, the Kargo shelf in all nine markets included", async () => {
		liveWorld();
		await prewarmLiveCategories({ waitMs: 5_000 });

		// What a foreign page holds for the Kargo shelf is the translated slug Saleor returns: the first one.
		expect(categoryUrlFor("de", "dachtraeger-und-dachkoerbe-fuer-transporter")).toBe(
			"/kargo-dachtraeger-und-dachkoerbe-fuer-transporter",
		);
		expect(categoryUrlFor("at", "dachtraeger-und-dachkoerbe-fuer-transporter")).toBe(
			"/kargo-dachtraeger-und-dachkoerbe-fuer-lieferwagen",
		);
		// Slovakia has the root that serves until Saleor holds the new slug.
		expect(categoryUrlFor("sk", "kargo-stresne-nosice-a-stresne-kose-na-dodavky")).toBe(
			"/stresne-nosice-a-kose-na-dodavky",
		);

		const home = await proxy(req("/de/dachtraeger-und-dachkoerbe-fuer-transporter"));
		expect(home.status).toBe(301);
		expect(where(home)).toBe("/de/kargo-dachtraeger-und-dachkoerbe-fuer-transporter");
		const retired = await proxy(req("/de/categories/dachtraeger-und-dachkoerbe-fuer-transporter"));
		expect(retired.status).toBe(308);
		expect(where(retired)).toBe("/de/kargo-dachtraeger-und-dachkoerbe-fuer-transporter");
	});

	it("takes a category created tomorrow on top of this list, with its translations, and keeps the rest as it was", async () => {
		const { world } = liveWorld();
		world.categories.push("a-future-category");
		world.translations["a-future-category"] = { DE: "zukuenftige-kategorie", CS: "budouci-kategorie" };
		await prewarmLiveCategories({ waitMs: 5_000 });

		expect(lines).toContain("[live-categories] floor=32 live=4 refused=0 loaded=yes");
		expect(lines).toContain("[live-categories] localized spellings=2 refused=0");
		expect(categoryUrlFor("de", "zukuenftige-kategorie")).toBe("/zukuenftige-kategorie");
		expect(categoryUrlFor("cz", "budouci-kategorie")).toBe("/budouci-kategorie");
		// Nothing that was routed before moves.
		expect(categoryUrlFor("de", "fusssaetze-fuer-dachtraeger")).toBe("/fusssaetze-fuer-dachtraeger");
	});
});
