import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "./channel-map";
import {
	describeMarketState,
	isChannelLive,
	isMarketLive,
	liveMarkets,
	marketState,
	resetMarketStateWarningForTests,
} from "./market-state";
import { buildAlternatesMetadata, buildHreflangAlternates } from "./seo/hreflang";
import { getBaseUrl } from "./seo/config";

const ENV = "MAKY_LIVE_MARKETS";

// Read rather than hardcoded: the base URL comes from NEXT_PUBLIC_STOREFRONT_URL
// and is localhost under vitest. These tests are about which markets appear, not
// about which host they appear on.
const BASE = getBaseUrl();

afterEach(() => {
	delete process.env[ENV];
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

describe("hreflang follows the live set", () => {
	it("emits nothing while only one market is live", () => {
		// A cluster of one describes no alternate. It used to list all twelve
		// unconditionally, pointing at eleven empty, noindex storefronts — and a
		// non-reciprocated annotation gets the whole cluster ignored.
		expect(buildHreflangAlternates("/kontakt")).toEqual([]);
	});

	it("emits the live markets and an x-default once there are two", () => {
		process.env[ENV] = "sk,cz";
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
		const { live, unknown } = describeMarketState();
		expect(live).toEqual(["sk"]);
		expect(unknown).toEqual(["gb", "xx"]);
	});
});
