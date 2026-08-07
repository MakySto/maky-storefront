import { MARKET_ROOT_SEGMENTS } from "./routing.generated";

/**
 * What each static route directly under the market prefix actually is.
 *
 * `MARKET_ROOT_SEGMENTS` is generated from the filesystem and answers "does this
 * segment exist". It cannot answer "in which markets", or "may Google index it" —
 * those are decisions, not facts about the tree, so they live here and the drift
 * test in `route-policy.test.ts` keeps the two in step.
 *
 * Why it matters: `[productSlug]` is a catch-all at this level, so every one of
 * these is indistinguishable from a product slug by shape. A route-existence gate
 * that asks Saleor about "poradna", gets null and 404s would take a live legal
 * page off the site. `/sk/odstupenie-od-zmluvy` is in the sitemap and carries
 * statutory obligations; that is not a mistake worth risking on a hand-written
 * list somebody has to remember to update.
 */
export type RouteKind =
	/** Hard-coded page, one per market that has it. */
	| "static"
	/** Payload CMS page. */
	| "cms"
	/** A Saleor-backed listing or a prefix for one (`categories/…`). */
	| "catalogue"
	/** Behind a session, or otherwise never for a crawler. */
	| "private";

export interface MarketRoutePolicy {
	readonly segment: string;
	readonly kind: RouteKind;
	/** `"all"`, or the markets where this route exists at all. */
	readonly markets: "all" | readonly string[];
	/** Whether the route may appear in search results when it does exist. */
	readonly indexable: boolean;
}

/**
 * The seven Slovak legal pages plus the two CMS pages exist only for `sk` — every
 * one calls `notFound()` for another channel, and the CMS factory hard-gates on
 * the Slovak market. Until each market has its own translated set, serving Slovak
 * terms under `/de` is a compliance problem before it is an SEO one.
 */
const SK_ONLY = ["sk"] as const;

export const ROUTE_POLICY: readonly MarketRoutePolicy[] = [
	// --- Slovak-only static pages -----------------------------------------------
	{ segment: "cookies", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "doprava-a-platba", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "kontakt", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "obchodne-podmienky", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "ochrana-osobnych-udajov", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "odstupenie-od-zmluvy", kind: "static", markets: SK_ONLY, indexable: true },
	{ segment: "reklamacie-a-vratenie", kind: "static", markets: SK_ONLY, indexable: true },

	// --- Slovak-only CMS pages ---------------------------------------------------
	{ segment: "o-nas", kind: "cms", markets: SK_ONLY, indexable: true },
	{ segment: "poradna", kind: "cms", markets: SK_ONLY, indexable: true },

	// --- Catalogue ----------------------------------------------------------------
	{ segment: "products", kind: "catalogue", markets: "all", indexable: true },
	{ segment: "categories", kind: "catalogue", markets: "all", indexable: true },
	{ segment: "collections", kind: "catalogue", markets: "all", indexable: true },
	{ segment: "pages", kind: "catalogue", markets: "all", indexable: true },
	// Search result pages are thin and infinite; crawling them wastes budget.
	{ segment: "search", kind: "catalogue", markets: "all", indexable: false },

	// --- Private -------------------------------------------------------------------
	{ segment: "account", kind: "private", markets: "all", indexable: false },
	{ segment: "cart", kind: "private", markets: "all", indexable: false },
	{ segment: "login", kind: "private", markets: "all", indexable: false },
	{ segment: "orders", kind: "private", markets: "all", indexable: false },
	{ segment: "signup", kind: "private", markets: "all", indexable: false },
];

const BY_SEGMENT: ReadonlyMap<string, MarketRoutePolicy> = new Map(
	ROUTE_POLICY.map((entry) => [entry.segment, entry]),
);

/** The policy for a market-root segment, or undefined if it is not one. */
export function routePolicyFor(segment: string): MarketRoutePolicy | undefined {
	return BY_SEGMENT.get(segment);
}

/** Whether `segment` is a real route rather than something to look up in Saleor. */
export function isMarketRootSegment(segment: string): boolean {
	return MARKET_ROOT_SEGMENTS.has(segment);
}

/**
 * Whether this market has this route at all.
 *
 * `/de/kontakt` today answers HTTP 200 with an indexable Slovak `<head>` over a
 * 404-ed body — the page component calls `notFound()` for a non-Slovak channel,
 * but `export const metadata` has no such branch. This is the question that turns
 * it into an honest 404, and it needs no upstream call.
 */
export function marketHasRoute(market: string, segment: string): boolean {
	const policy = BY_SEGMENT.get(segment);
	if (!policy) return false;
	return policy.markets === "all" || policy.markets.includes(market);
}

/**
 * A market-root segment that exists somewhere but not in THIS market.
 *
 * Distinct from "not a route at all": the latter is a product-slug candidate and
 * belongs to the existence gate, this one is a static decision the proxy can make
 * on its own.
 */
export function isRouteMissingInMarket(market: string, segment: string): boolean {
	return isMarketRootSegment(segment) && !marketHasRoute(market, segment);
}
