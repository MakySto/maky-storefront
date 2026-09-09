import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "./channel-map";
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
	 * Markets with no approved copy of any kind.
	 *
	 * The relay is now over: `de` → `pl` → `it`/`fr` → `es`/`ro` → `us`/`ca`, and `us` and
	 * `ca` are the LAST two uncovered markets in `CHANNEL_MAP`. There is nowhere to move
	 * this fixture next.
	 *
	 * So whoever lands English copy cannot do what the last four threads did. Deleting the
	 * list leaves five green tests asserting nothing over an empty loop; adding a market
	 * that does have copy inverts what they check. The assertion has to be rethought — the
	 * obvious shape is a synthetic channel wired into a test-only map, which tests the
	 * mechanism ("a market absent from `APPROVED_COPY` 404s") instead of borrowing whichever
	 * real market happens to be untranslated this month. That is a design decision for that
	 * thread, and it must not be settled by quietly emptying this array.
	 */
	const NO_COPY = ["us", "ca"];

	/** Markets whose legal copy a human has approved. */
	const WITH_COPY = ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro"];

	it("serves the legal pages in every market whose copy is approved", () => {
		for (const segment of LEGAL_PAGES) {
			for (const market of WITH_COPY) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(true);
				expect(isRouteMissingInMarket(market, segment), `${market}/${segment}`).toBe(false);
			}
		}
	});

	it("still 404s the legal pages in a market with no approved copy", () => {
		// The original bug: /de/kontakt answered 200 with an indexable Slovak <head>
		// over a 404-ed body. Selling into Germany on Slovak terms is a compliance
		// problem before it is an SEO one, and adding Czech must not have reopened it.
		for (const segment of LEGAL_PAGES) {
			for (const market of NO_COPY) {
				expect(marketHasRoute(market, segment), `${market}/${segment}`).toBe(false);
				expect(isRouteMissingInMarket(market, segment), `${market}/${segment}`).toBe(true);
			}
		}
	});

	it("keeps the CMS pages on sk, because Payload has no translated document", () => {
		for (const segment of CMS_PAGES) {
			expect(marketHasRoute("sk", segment), `sk/${segment}`).toBe(true);
			for (const market of [...WITH_COPY.filter((m) => m !== "sk"), ...NO_COPY]) {
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
