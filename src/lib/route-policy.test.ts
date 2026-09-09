import { afterEach, describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "./channel-map";
import { UNCOVERED_MARKET, mockUncoveredMarket, restoreChannelMap } from "./legal/uncovered-market.testkit";
import { MARKET_ROOT_SEGMENTS } from "./routing.generated";
import {
	ROUTE_POLICY,
	isMarketRootSegment,
	isRouteMissingInMarket,
	marketHasRoute,
	routePolicyFor,
} from "./route-policy";

/**
 * The generated set is a fact about the filesystem; the policy is a set of
 * decisions about it. This keeps them in step, because a segment that exists on
 * disk but is missing from the policy is exactly the failure that would let the
 * existence gate ask Saleor about "poradna" and 404 a live legal page.
 */
describe("policy covers the route tree", () => {
	it("has an entry for every generated market-root segment", () => {
		const missing = [...MARKET_ROOT_SEGMENTS].filter((s) => !routePolicyFor(s));
		expect(
			missing,
			`Add these to ROUTE_POLICY in src/lib/route-policy.ts: ${missing.join(", ")}. ` +
				`Until then the existence gate would treat them as product slugs and 404 them.`,
		).toEqual([]);
	});

	it("has no entry for a segment that no longer exists", () => {
		const stale = ROUTE_POLICY.map((e) => e.segment).filter((s) => !MARKET_ROOT_SEGMENTS.has(s));
		expect(stale, `Remove these from ROUTE_POLICY: ${stale.join(", ")}`).toEqual([]);
	});

	it("names only real markets", () => {
		for (const entry of ROUTE_POLICY) {
			if (entry.markets === "all") continue;
			for (const market of entry.markets) {
				expect(Object.keys(CHANNEL_MAP), `${entry.segment} -> ${market}`).toContain(market);
			}
		}
	});

	it("lists no segment twice", () => {
		const segments = ROUTE_POLICY.map((e) => e.segment);
		expect(new Set(segments).size).toBe(segments.length);
	});
});

afterEach(() => restoreChannelMap());

describe("market scoping", () => {
	/** Static legal copy, approved in Slovak and Czech. */
	const LEGAL_PAGES = [
		"cookies",
		"doprava-a-platba",
		"kontakt",
		"obchodne-podmienky",
		"ochrana-osobnych-udajov",
		"odstupenie-od-zmluvy",
		"reklamacie-a-vratenie",
	];

	/** CMS-backed, and `cmsPageRoute` still hard-gates on the Slovak market. */
	const CMS_PAGES = ["o-nas", "poradna"];

	/**
	 * A market with no approved copy of any kind — now synthetic, because there is no
	 * longer a real one.
	 *
	 * The relay ended here: `de` → `pl` → `it`/`fr` → `es`/`ro` → `us`/`ca`, and English
	 * was the last uncovered pair in `CHANNEL_MAP`. Rather than empty the array — which
	 * would leave these tests looping over nothing and passing vacuously — the fixture now
	 * synthesises a market that is a real channel but has no entry in `APPROVED_COPY`.
	 * See `legal/uncovered-market.testkit.ts` for why the other three options are worse.
	 *
	 * The mock is what makes the assertion mean what it says. `route-policy.ts` never
	 * consults `CHANNEL_MAP` — `marketHasRoute` just asks whether the string is in the
	 * policy's market list — so any nonsense string would already return `false` here and
	 * the test would pass without proving anything about a *market*. Mocking the channel
	 * map makes `zz` a genuine market that simply has no copy, which is the case this is
	 * supposed to be about.
	 */
	const NO_COPY = [UNCOVERED_MARKET];

	/** Markets whose legal copy a human has approved — all twelve, as of English. */
	const WITH_COPY = ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"];

	it("serves the legal pages in every market whose copy is approved", () => {
		for (const segment of LEGAL_PAGES) {
			for (const market of WITH_COPY) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(true);
				expect(isRouteMissingInMarket(market, segment), `${market}/${segment}`).toBe(false);
			}
		}
	});

	it("still 404s the legal pages in a market with no approved copy", async () => {
		// The original bug: /de/kontakt answered 200 with an indexable Slovak <head>
		// over a 404-ed body. Selling into Germany on Slovak terms is a compliance
		// problem before it is an SEO one, and adding Czech must not have reopened it.
		//
		// Re-imported under the mock, because `LEGAL_COPY_MARKETS` is read from
		// `marketsWithLegalCopy()` once when `route-policy.ts` loads. The statically
		// imported copy at the top of this file was built before the mock existed.
		mockUncoveredMarket();
		const policy = await import("./route-policy");
		const { marketsWithLegalCopy } = await import("./legal/locale");
		expect(marketsWithLegalCopy(), "fixture is only meaningful for an uncovered market").not.toContain(
			UNCOVERED_MARKET,
		);
		for (const segment of LEGAL_PAGES) {
			for (const market of NO_COPY) {
				expect(policy.marketHasRoute(market, segment), `${market}/${segment}`).toBe(false);
				expect(policy.isRouteMissingInMarket(market, segment), `${market}/${segment}`).toBe(true);
			}
		}
	});

	it("serves those same pages in every market that does have copy", () => {
		// The positive half, stated against the twelve real markets rather than the nine
		// this used to name. If the negative case above ever started passing because the
		// policy 404s everything, this fails.
		for (const segment of LEGAL_PAGES) {
			for (const market of Object.keys(CHANNEL_MAP)) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(true);
			}
		}
	});

	it("keeps the CMS pages on sk, because Payload has no translated document", () => {
		for (const segment of CMS_PAGES) {
			expect(marketHasRoute("sk", segment), `sk/${segment}`).toBe(true);
			for (const market of WITH_COPY.filter((m) => m !== "sk")) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(false);
				expect(isRouteMissingInMarket(market, segment), `${market}/${segment}`).toBe(true);
			}
		}
	});

	it("keeps the catalogue and private routes in every market", () => {
		for (const segment of ["products", "categories", "collections", "pages", "search", "cart", "account"]) {
			for (const market of Object.keys(CHANNEL_MAP)) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(true);
				expect(isRouteMissingInMarket(market, segment)).toBe(false);
			}
		}
	});

	it("does not claim a product slug is a missing route", () => {
		// The distinction the existence gate depends on: "not a route here" and
		// "not a route at all" are different answers.
		for (const slug of ["stresny-box-thule", "seo-canary-neexistuje", "nieco-uplne-ine"]) {
			expect(isMarketRootSegment(slug)).toBe(false);
			expect(isRouteMissingInMarket("de", slug)).toBe(false);
		}
	});

	it("marks search and the private routes non-indexable", () => {
		for (const segment of ["search", "account", "cart", "login", "orders", "signup"]) {
			expect(routePolicyFor(segment)?.indexable, segment).toBe(false);
		}
	});
});
