import { afterEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * hreflang reads the live-market set from the environment, so each case has to
 * import the module fresh.
 */
async function alternatesFor(markets: string, path = "/kontakt") {
	vi.resetModules();
	vi.stubEnv("MAKY_LIVE_MARKETS", markets);
	const { buildHreflangAlternates } = await import("./hreflang");
	return buildHreflangAlternates(path);
}

/**
 * market -> hreflang. `x-default` is dropped first: it repeats the first live
 * market's URL, so keying on the URL without dropping it silently overwrites
 * that market's entry.
 */
async function byMarket(markets: string) {
	const alternates = await alternatesFor(markets);
	return Object.fromEntries(
		alternates.filter((a) => a.hreflang !== "x-default").map((a) => [a.url.split("/")[3], a.hreflang]),
	);
}

afterEach(() => vi.unstubAllEnvs());

describe("buildHreflangAlternates", () => {
	it("says nothing when only one market is live", async () => {
		// A page has no alternate to itself, and `x-default` alone would invite a
		// crawler to treat a single-market site as an international one. This is
		// also why every hreflang defect here is latent today.
		await expect(alternatesFor("sk")).resolves.toEqual([]);
	});

	it("annotates each market with its own locale, not its language", async () => {
		const tags = await byMarket("sk,de,at");

		// The defect this pins: `htmlLang` is a bare language for all twelve
		// markets, so Germany and Austria both read "de". The old code patched
		// Austria by name and left Germany generic, which annotated two separate
		// storefronts asymmetrically.
		expect(tags.de).toBe("de-DE");
		expect(tags.at).toBe("de-AT");
		expect(tags.sk).toBe("sk-SK");
	});

	it("separates the two English markets the same way, without a special case", async () => {
		const tags = await byMarket("sk,us,ca");

		expect(tags.us).toBe("en-US");
		expect(tags.ca).toBe("en-CA");
	});

	it("never emits the same hreflang twice, for any live set", async () => {
		// Two pages claiming one hreflang gets the WHOLE cluster ignored, not just
		// the duplicate — so this is the property that actually matters. Under the
		// old language-plus-exceptions rule a thirteenth market sharing a language
		// would have collided silently.
		const all = Object.keys(CHANNEL_MAP);
		const alternates = await alternatesFor(all.join(","));
		const tags = alternates.filter((a) => a.hreflang !== "x-default").map((a) => a.hreflang);

		expect(tags).toHaveLength(all.length);
		expect(new Set(tags).size).toBe(tags.length);
	});

	it("points x-default at the first live market, not a hardcoded sk", async () => {
		const alternates = await alternatesFor("de,at");
		const xDefault = alternates.find((a) => a.hreflang === "x-default");

		expect(xDefault?.url).toContain("/de/kontakt");
	});
});

/**
 * Page-level eligibility.
 *
 * The helper used to answer "which markets are live", which is only half the question.
 * A market being live says nothing about whether it has THIS page, and hreflang is
 * reciprocal — annotate `/cz/o-nas` as the Czech version of `/sk/o-nas` while the
 * former 404s and a crawler discards the whole cluster, not just that entry.
 */
describe("buildHreflangAlternates — page-level eligibility", () => {
	async function subject(markets: string) {
		vi.resetModules();
		vi.stubEnv("MAKY_LIVE_MARKETS", markets);
		return (await import("./hreflang")).buildHreflangAlternates;
	}

	afterEach(() => vi.unstubAllEnvs());

	it("annotates a static legal page, which every market with copy really has", async () => {
		const build = await subject("sk,cz,de");
		const urls = build("/kontakt").map((e) => e.url);
		expect(urls).toEqual(
			expect.arrayContaining([
				expect.stringContaining("/sk/kontakt"),
				expect.stringContaining("/cz/kontakt"),
				expect.stringContaining("/de/kontakt"),
			]),
		);
	});

	it("says nothing about a CMS page only one market has", async () => {
		const build = await subject("sk,cz,de");
		// `o-nas` is `sk` alone in route-policy until Payload holds a translated
		// document, so there is no second member of the cluster to name.
		expect(build("/o-nas")).toEqual([]);
	});

	it("refuses to guess for a catalogue URL", async () => {
		const build = await subject("sk,cz,de");
		// The same product slug existing under /sk proves nothing about /de. Those
		// identities live in Saleor; a guess here would poison the whole cluster.
		expect(build("/products")).toEqual([]);
		expect(build("/categories/stresne-nosice")).toEqual([]);
	});

	it("says nothing for a private or non-indexable route", async () => {
		const build = await subject("sk,cz,de");
		expect(build("/account")).toEqual([]);
		expect(build("/search")).toEqual([]);
		expect(build("/garage")).toEqual([]);
	});

	it("says nothing for a path that is not a route at all", async () => {
		const build = await subject("sk,cz,de");
		expect(build("/nejaky-produkt-slug")).toEqual([]);
	});

	it("still annotates the market homepage, which exists wherever the market does", async () => {
		const build = await subject("sk,cz,de");
		const entries = build("");
		expect(entries.length).toBe(4); // three markets + x-default
	});

	it("follows a sub-route to its parent segment's markets", async () => {
		const build = await subject("sk,cz,de");
		const urls = build("/odstupenie-od-zmluvy/vzorovy-formular").map((e) => e.url);
		expect(urls).toEqual(
			expect.arrayContaining([
				expect.stringContaining("/sk/odstupenie-od-zmluvy/vzorovy-formular"),
				expect.stringContaining("/de/odstupenie-od-zmluvy/vzorovy-formular"),
			]),
		);
	});
});
