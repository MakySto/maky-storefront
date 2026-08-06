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
	const SK_ONLY = [
		"cookies",
		"doprava-a-platba",
		"kontakt",
		"obchodne-podmienky",
		"ochrana-osobnych-udajov",
		"odstupenie-od-zmluvy",
		"reklamacie-a-vratenie",
		"o-nas",
		"poradna",
	];

	it("keeps the Slovak legal and CMS pages on sk", () => {
		for (const segment of SK_ONLY) {
			expect(marketHasRoute("sk", segment), `sk/${segment}`).toBe(true);
			for (const market of ["de", "cz", "fr", "us"]) {
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
