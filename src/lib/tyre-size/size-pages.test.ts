import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fittingCodes } from "./choice";
import { tyreSizeIndex } from "./size-index";
import {
	MIN_PRODUCTS_TO_INDEX,
	indexableTyrePageSlugs,
	offeredTyreRims,
	popularTyreSizes,
	tyreFamilyOffer,
	tyreFamilyPageOf,
	tyreFamilyPages,
	tyrePageOf,
	tyreRimPages,
	tyreSizeOffer,
	tyreSizePageOf,
	tyreSizePages,
	tyreSizePagesOfRim,
} from "./size-pages";

/**
 * The tyre-size pages of the snow-chain shelf, read from the sealed list (`velkosti_20261105.json`) itself: nothing
 * here is invented but which codes a channel sells.
 *
 *   1. One size has one address, and it is the list's own label.
 *   2. Only a standard size in the range of real tyres is a page: old spellings, half-inch rims and a row outside
 *      that range (`275/20 R20`) are not.
 *   3. Whether a page may be indexed is decided by what the channel SELLS, never by the list alone.
 */

const ALL_CODES = new Set(Object.keys(tyreSizeIndex().products));

describe("which address is a page", () => {
	it("reads a size's address as the list's own label and back", () => {
		const page = tyrePageOf(["205-60-r16"]);
		expect(page).toEqual({
			kind: "size",
			label: "205/60 R16",
			slug: "205-60-r16",
			width: 205,
			profile: 60,
			rim: "16",
		});
		expect(tyreSizePageOf("205/60 R16")).toEqual(page);
	});

	it("reads a rim's address", () => {
		expect(tyrePageOf(["r16"])).toEqual({ kind: "rim", rim: "16", slug: "r16" });
	});

	it("has no second spelling, no deeper path and no page for a size the list does not hold", () => {
		for (const segments of [
			["205-60-R16"],
			["205-60-16"],
			["205/60 R16"],
			["205-60-r16", "x"],
			[],
			["R16"],
			["r99"],
			["r9"],
			// A well-formed size no code of the list fits.
			["205-40-r21"],
			["constructor"],
			["__proto__"],
		]) {
			expect(tyrePageOf(segments), segments.join("/")).toBeNull();
		}
	});

	it("gives no page to a row that is not a standard size of a real tyre", () => {
		const labels = new Set(
			Object.values(tyreSizeIndex().products).flatMap((product) => product.sizes.map(([label]) => label)),
		);
		// Each of these IS in the list, so the product page and the selector answer for it; none gets an address.
		for (const label of ["120/80 R10", "175 R13", "5.00-12", "205/65 R17,5", "275/20 R20"]) {
			expect(labels.has(label), `${label} is a row of the list`).toBe(true);
			expect(tyreSizePageOf(label), label).toBeNull();
		}
		// A row CFM took out of the list (D0245, 2026-11-15) is not a row any more, and has no address either.
		expect(labels.has("650/17 R17")).toBe(false);
		expect(tyrePageOf(["650-17-r17"])).toBeNull();
	});

	it("lists every page once, ascending by rim, width and profile, and every one resolves", () => {
		const pages = tyreSizePages();
		expect(pages.length).toBe(860);
		expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
		for (const page of pages) expect(tyrePageOf([page.slug])).toEqual(page);
		const key = (page: (typeof pages)[number]) => Number(page.rim) * 1e6 + page.width * 1e3 + page.profile;
		expect(pages.map(key)).toEqual([...pages.map(key)].sort((a, b) => a - b));
	});

	it("has a rim page for each rim that holds a size, and each lists its own sizes", () => {
		const rims = tyreRimPages();
		expect(rims.map((rim) => rim.rim)).toEqual([
			"10",
			"12",
			"13",
			"14",
			"15",
			"16",
			"17",
			"18",
			"19",
			"20",
			"21",
			"22",
			"23",
			"24",
		]);
		expect(rims.reduce((sum, rim) => sum + tyreSizePagesOfRim(rim.rim).length, 0)).toBe(
			tyreSizePages().length,
		);
		expect(tyreSizePagesOfRim("16").every((page) => page.rim === "16")).toBe(true);
		expect(tyreSizePagesOfRim("99")).toEqual([]);
	});
});

describe("what a channel offers for a size", () => {
	it("names the codes of the list that the channel sells, and tells chains from socks", () => {
		const offer = tyreSizeOffer("205/60 R16", ALL_CODES);
		expect(offer.codes).toEqual([...fittingCodes("205/60 R16")].sort());
		expect(offer.codes).toHaveLength(12);
		// DAC Easy GO, DAC Active, DAC Super X, Gran Pree, Menabo and SnowDrive socks; the rest are chains.
		expect(offer.socks).toBe(6);
		expect(offer.chains).toBe(6);
		expect(offer.indexable).toBe(true);
	});

	it("does not promise a code the channel does not sell", () => {
		const offer = tyreSizeOffer("205/60 R16", new Set(["N16075", "N17143", "X-not-a-chain"]));
		expect(offer.codes).toEqual(["N16075", "N17143"]);
		expect(offer).toMatchObject({ chains: 1, socks: 1, indexable: true });
	});

	it("keeps a page with one product, or none, out of the index", () => {
		expect(MIN_PRODUCTS_TO_INDEX).toBe(2);
		expect(tyreSizeOffer("205/60 R16", new Set(["N16075"]))).toMatchObject({
			codes: ["N16075"],
			indexable: false,
		});
		expect(tyreSizeOffer("205/60 R16", new Set())).toMatchObject({ codes: [], indexable: false });
	});
});

describe("the pages a search engine is told about", () => {
	it("names nothing for a channel that sells nothing", () => {
		expect(indexableTyrePageSlugs(new Set())).toEqual([]);
	});

	it("names a rim before its sizes, and only sizes with enough products on sale", () => {
		const slugs = indexableTyrePageSlugs(new Set(["N16075", "N17143"]));
		// Every size both codes fit, each under its rim, and nothing else.
		const both = tyreSizePages().filter(
			(page) => tyreSizeOffer(page.label, new Set(["N16075", "N17143"])).codes.length === 2,
		);
		expect(both.length).toBeGreaterThan(0);
		// The two codes are of two families, one product each: no family page is named.
		expect(slugs.filter((slug) => !slug.startsWith("r"))).toEqual(both.map((page) => page.slug));
		for (const page of both) {
			expect(slugs.indexOf(`r${page.rim}`)).toBeGreaterThanOrEqual(0);
			expect(slugs.indexOf(`r${page.rim}`)).toBeLessThan(slugs.indexOf(page.slug));
		}
		expect(slugs).toContain("205-60-r16");
	});

	it("covers the whole list when the channel sells every code", () => {
		const slugs = indexableTyrePageSlugs(ALL_CODES);
		const sizes = slugs.filter((slug) => /^\d{3}-\d{2}-r\d{2}$/.test(slug));
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(sizes.length).toBe(tyreSizePages().filter((page) => fittingCodes(page.label).size >= 2).length);
		// The thirteen model families come first, each of them a page.
		expect(slugs.slice(0, 13)).toEqual(tyreFamilyPages().map((family) => family.slug));
		for (const slug of slugs) expect(tyrePageOf([slug]), slug).not.toBeNull();
	});
});

describe("the shortcuts on the shelf", () => {
	it("names common sizes in the list's order, and only ones the channel may have indexed", () => {
		const popular = popularTyreSizes(ALL_CODES, 24);
		expect(popular).toHaveLength(24);
		expect(popular.map((page) => page.label)).toContain("205/55 R16");
		expect(popular).toEqual(
			[...popular].sort(
				(a, b) => Number(a.rim) - Number(b.rim) || a.width - b.width || a.profile - b.profile,
			),
		);
		for (const page of popular) {
			expect(tyreSizeOffer(page.label, ALL_CODES).codes.length).toBeGreaterThanOrEqual(MIN_PRODUCTS_TO_INDEX);
		}
		// A shop that sells one product names no shortcut: no size of its is a page to send a search to.
		expect(popularTyreSizes(new Set(["N16075"]), 24)).toEqual([]);
	});

	it("falls back to the list when the shop could not be asked, and names nothing for an empty shop", () => {
		expect(popularTyreSizes(null, 5)).toHaveLength(5);
		expect(popularTyreSizes(new Set(), 5)).toEqual([]);
		expect(offeredTyreRims(new Set())).toEqual([]);
		expect(offeredTyreRims(null)).toEqual(tyreRimPages());
		expect(offeredTyreRims(new Set(["N16075"])).length).toBeGreaterThan(0);
	});
});

describe("the pages by model family", () => {
	it("gives each of the thirteen families one address, which is its key, and no address that reads as a size", () => {
		const families = tyreFamilyPages();
		expect(families).toHaveLength(13);
		for (const family of families) {
			expect(family.slug).toBe(family.key);
			expect(family.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			expect(family.slug).not.toMatch(/^r\d\d$/);
			expect(family.slug).not.toMatch(/^\d{3}-\d{2}-r\d{2}$/);
			expect(tyrePageOf([family.slug])).toEqual(family);
		}
		expect(tyrePageOf(["snowdrive-r9"])).toEqual({
			kind: "family",
			key: "snowdrive-r9",
			slug: "snowdrive-r9",
			name: "SnowDrive R-9",
			product: "chain",
		});
		expect(tyrePageOf(["SnowDrive-R9"])).toBeNull();
		expect(tyrePageOf(["snowdrive-r9", "x"])).toBeNull();
		expect(tyrePageOf(["thule-easy-fit"])).toBeNull();
	});

	it("names a model without a noun, so a page in any language can say chains or socks itself", () => {
		// Pinned whole: a new label that carries a Slovak word must be seen here, not on a German page.
		expect(Object.fromEntries(tyreFamilyPages().map((family) => [family.key, family.name]))).toEqual({
			"dac-active": "DAC Active Series",
			"dac-blue-ice": "DAC Blue ICE",
			"dac-easy-go": "DAC Easy GO",
			"dac-oto-top-16": "DAC oto TOP 16 mm",
			"dac-super-x": "DAC Maranello Super X",
			"gran-pree-ponozky": "Gran Pree",
			"menabo-snow-socks": "Menabo Snow Socks",
			"snowdrive-nx7": "SnowDrive Hybrid NX-7",
			"snowdrive-pilot-pro": "SnowDrive Pilot-Pro",
			"snowdrive-ponozky": "SnowDrive",
			"snowdrive-r9": "SnowDrive R-9",
			"snowdrive-s16": "SnowDrive S-16",
			"snowdrive-wx9": "SnowDrive WX-9",
		});
		expect(tyreFamilyPageOf("N16075")?.key).toBe("snowdrive-r9");
		expect(tyreFamilyPageOf("N17143")?.product).toBe("sock");
		expect(tyreFamilyPageOf("X0000")).toBeNull();
		expect(tyreFamilyPageOf(null)).toBeNull();
	});

	it("offers what the channel sells of a family, and indexes it from two products up", () => {
		const whole = tyreFamilyOffer("snowdrive-r9", ALL_CODES);
		expect(whole.codes.length).toBeGreaterThan(2);
		expect(whole.codes).toEqual([...whole.codes].sort());
		expect(whole.indexable).toBe(true);
		expect(whole.sizes).toBeGreaterThan(whole.codes.length);
		expect(whole.rims).toEqual([...whole.rims].sort((a, b) => Number(a) - Number(b)));
		for (const rim of whole.rims) expect(tyrePageOf([`r${rim}`]), rim).not.toBeNull();

		const one = tyreFamilyOffer("snowdrive-r9", new Set(["N16075"]));
		expect(one.codes).toEqual(["N16075"]);
		expect(one.indexable).toBe(false);
		// Only what the one code on sale is listed for.
		expect(one.sizes).toBeLessThan(whole.sizes);

		expect(tyreFamilyOffer("snowdrive-r9", new Set())).toEqual({
			codes: [],
			sizes: 0,
			rims: [],
			indexable: false,
		});
		expect(tyreFamilyOffer("no-such-family", ALL_CODES).codes).toEqual([]);
	});

	it("puts every code of the list in exactly one family's offer", () => {
		const offered = tyreFamilyPages().flatMap((family) => tyreFamilyOffer(family.key, ALL_CODES).codes);
		expect(offered.length).toBe(ALL_CODES.size);
		expect(new Set(offered)).toEqual(ALL_CODES);
	});
});
