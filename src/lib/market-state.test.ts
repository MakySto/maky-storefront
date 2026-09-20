import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "./channel-map";
import {
	describeMarketState,
	indexableMarkets,
	isChannelIndexable,
	isChannelLive,
	isMarketIndexable,
	isMarketLive,
	liveMarkets,
	marketState,
	resetMarketStateWarningForTests,
} from "./market-state";
import { buildAlternatesMetadata, buildHreflangAlternates } from "./seo/hreflang";
import { getBaseUrl } from "./seo/config";

const ENV = "MAKY_LIVE_MARKETS";
const INDEX_ENV = "MAKY_INDEXABLE_MARKETS";

// Read rather than hardcoded: the base URL comes from NEXT_PUBLIC_STOREFRONT_URL
// and is localhost under vitest. These tests are about which markets appear, not
// about which host they appear on.
const BASE = getBaseUrl();

afterEach(() => {
	delete process.env[ENV];
	delete process.env[INDEX_ENV];
	resetMarketStateWarningForTests();
	vi.restoreAllMocks();
});

describe("liveMarkets", () => {
	it("defaults to sk alone", () => {
		expect(liveMarkets()).toEqual(["sk"]);
	});

	it("honours the env override", () => {
		process.env[ENV] = "sk,cz";
		expect(liveMarkets()).toEqual(["sk", "cz"]);
	});

	it("returns CHANNEL_MAP order, not the order somebody typed", () => {
		// Otherwise the sitemap and the hreflang cluster reshuffle on every edit to
		// an env var, for no reason.
		process.env[ENV] = "de,cz,sk";
		expect(liveMarkets()).toEqual(["sk", "cz", "de"]);
	});

	it("tolerates whitespace and case", () => {
		process.env[ENV] = " SK , Cz ";
		expect(liveMarkets()).toEqual(["sk", "cz"]);
	});

	it("drops names that are not markets rather than inventing them", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env[ENV] = "sk,gb,xx";
		expect(liveMarkets()).toEqual(["sk"]);
		expect(warn).toHaveBeenCalled();
	});

	it("falls back to the default when the override resolves to nothing", () => {
		// A typo in an env var is not a plausible reason to noindex the whole site.
		vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env[ENV] = "gb,xx";
		expect(liveMarkets()).toEqual(["sk"]);
	});

	it("falls back when the override is empty or whitespace", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		for (const value of ["", "   ", ",,,"]) {
			process.env[ENV] = value;
			expect(liveMarkets(), JSON.stringify(value)).toEqual(["sk"]);
		}
	});
});

describe("market state", () => {
	it("calls everything that is not live a preview", () => {
		expect(marketState("sk")).toBe("live");
		for (const m of ["cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(marketState(m), m).toBe("preview");
			expect(isMarketLive(m), m).toBe(false);
		}
	});

	it("answers the same question for a Saleor channel slug", () => {
		expect(isChannelLive("sk-eur")).toBe(true);
		expect(isChannelLive("de-eur")).toBe(false);
	});

	it("treats an unknown channel as not live", () => {
		expect(isChannelLive("does-not-exist")).toBe(false);
	});

	it("follows the override", () => {
		process.env[ENV] = "sk,de";
		expect(isChannelLive("de-eur")).toBe(true);
		expect(isChannelLive("cz-czk")).toBe(false);
	});
});

describe("hreflang follows the indexable set", () => {
	it("emits nothing while only one market is live", () => {
		// A cluster of one describes no alternate. It used to list all twelve
		// unconditionally, pointing at eleven empty, noindex storefronts — and a
		// non-reciprocated annotation gets the whole cluster ignored.
		expect(buildHreflangAlternates("/kontakt")).toEqual([]);
	});

	it("emits the live markets and an x-default once there are two", () => {
		process.env[ENV] = "sk,cz";
		process.env[INDEX_ENV] = "sk,cz";
		const entries = buildHreflangAlternates("/kontakt");
		// The market's locale, not its language: `htmlLang` is bare ("sk", "cs") for
		// all twelve, which made Germany and Austria — and the US and Canada — claim
		// the same annotation until a hardcoded list patched them one at a time.
		expect(entries.map((e) => e.hreflang)).toEqual(["sk-SK", "cs-CZ", "x-default"]);
		expect(entries.map((e) => e.url)).toEqual([
			`${BASE}/sk/kontakt`,
			`${BASE}/cz/kontakt`,
			`${BASE}/sk/kontakt`,
		]);
	});

	it("never names a preview market", () => {
		process.env[ENV] = "sk,cz";
		process.env[INDEX_ENV] = "sk,cz";
		const urls = buildHreflangAlternates("").map((e) => e.url);
		for (const preview of ["/de", "/at", "/fr", "/us"]) {
			expect(
				urls.some((u) => u.includes(preview)),
				preview,
			).toBe(false);
		}
	});

	it("points x-default at the first live market, not a hardcoded sk", () => {
		process.env[ENV] = "cz,de";
		process.env[INDEX_ENV] = "cz,de";
		const entries = buildHreflangAlternates("");
		expect(entries.at(-1)).toEqual({ hreflang: "x-default", url: `${BASE}/cz` });
	});

	it("omits `languages` entirely rather than emitting an empty map", () => {
		const meta = buildAlternatesMetadata("sk-eur", "/kontakt");
		expect(meta.alternates.canonical).toBe(`${BASE}/sk/kontakt`);
		expect(meta.alternates.languages).toBeUndefined();
	});

	it("carries `languages` once a second market is live", () => {
		process.env[ENV] = "sk,cz";
		process.env[INDEX_ENV] = "sk,cz";
		const meta = buildAlternatesMetadata("sk-eur", "/kontakt");
		expect(Object.keys(meta.alternates.languages ?? {})).toEqual(["sk-SK", "cs-CZ", "x-default"]);
	});
});

describe("describeMarketState", () => {
	it("reports the split the boot line prints", () => {
		const { live, preview, unknown } = describeMarketState();
		expect(live).toEqual(["sk"]);
		expect(preview).toEqual(["cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]);
		expect(unknown).toEqual([]);
		// Every market is in exactly one of the two sets.
		expect([...live, ...preview].sort()).toEqual(Object.keys(CHANNEL_MAP).sort());
	});

	it("surfaces unknown names instead of swallowing them", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env[ENV] = "sk,gb,xx";
		process.env[INDEX_ENV] = "sk,gb,xx";
		const { live, unknown } = describeMarketState();
		expect(live).toEqual(["sk"]);
		expect(unknown).toEqual(["gb", "xx"]);
	});
});

describe("indexableMarkets — the second gate", () => {
	it("defaults to sk alone, exactly like the live set", () => {
		// Both gates resolve to the same single market today. That is what makes adding
		// the second one a no-op for behaviour that exists, and a change only to what
		// happens when the first one stops being enforced.
		expect(indexableMarkets()).toEqual(["sk"]);
		expect(indexableMarkets()).toEqual(liveMarkets());
	});

	it("does NOT follow MAKY_LIVE_MARKETS on its own", () => {
		// The point of the whole change. Promoting a market at runtime opens it for
		// business; it must not hand it to a crawler, because that is the one step in
		// the rollout nobody can take back.
		process.env[ENV] = "sk,de";
		expect(liveMarkets()).toEqual(["sk", "de"]);
		expect(indexableMarkets()).toEqual(["sk"]);
		expect(isMarketLive("de")).toBe(true);
		expect(isMarketIndexable("de")).toBe(false);
	});

	it("needs both gates open", () => {
		process.env[ENV] = "sk,de";
		process.env[INDEX_ENV] = "sk,de";
		expect(indexableMarkets()).toEqual(["sk", "de"]);
	});

	it("never lets the index allowlist promote a market that is not live", () => {
		// Otherwise a market could be absent from navigation and the cookie while still
		// inviting a crawler — indexable but unreachable.
		process.env[INDEX_ENV] = "sk,de";
		expect(liveMarkets()).toEqual(["sk"]);
		expect(indexableMarkets()).toEqual(["sk"]);
	});

	it("returns CHANNEL_MAP order, not the order somebody typed", () => {
		process.env[ENV] = "de,cz,sk";
		process.env[INDEX_ENV] = "de,cz,sk";
		expect(indexableMarkets()).toEqual(["sk", "cz", "de"]);
	});

	it("drops names that are not markets rather than inventing them", () => {
		process.env[ENV] = "sk,cz";
		process.env[INDEX_ENV] = "sk,atlantis,cz";
		expect(indexableMarkets()).toEqual(["sk", "cz"]);
	});

	it("falls back to the default when the override resolves to nothing", () => {
		process.env[ENV] = "sk,cz";
		process.env[INDEX_ENV] = "atlantis";
		expect(indexableMarkets()).toEqual(["sk"]);
	});

	it("answers the same question for a Saleor channel slug", () => {
		expect(isChannelIndexable(CHANNEL_MAP.sk.saleorSlug)).toBe(true);
		expect(isChannelIndexable(CHANNEL_MAP.de.saleorSlug)).toBe(false);
		expect(isChannelIndexable("not-a-channel")).toBe(false);
	});

	it("reports the gap so a live-but-invisible market is never silent", () => {
		process.env[ENV] = "sk,de";
		const state = describeMarketState();
		expect(state.live).toEqual(["sk", "de"]);
		expect(state.indexable).toEqual(["sk"]);
		expect(state.liveNotIndexable).toEqual(["de"]);
	});

	it("has no gap to report when the two agree", () => {
		expect(describeMarketState().liveNotIndexable).toEqual([]);
	});
});

describe("the sitemap and hreflang follow the indexable gate, not the live one", () => {
	it("keeps a live-but-not-cleared market out of the hreflang cluster", () => {
		process.env[ENV] = "sk,cz";
		// cz sells, but no index GO was given: a cluster of one, which is no cluster.
		expect(buildHreflangAlternates("/kontakt")).toEqual([]);
	});
});
