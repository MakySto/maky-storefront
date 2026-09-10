/**
 * SEO helpers for multi-market hreflang, canonical URLs, and alternates.
 *
 * Used by generateMetadata() in layout/page files to produce
 * proper <link rel="alternate" hreflang="..."> tags for all 12 markets.
 */

import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { marketHasRoute, routePolicyFor } from "@/lib/route-policy";
import { getBaseUrl } from "./config";

type HreflangEntry = {
	hreflang: string;
	url: string;
};

/**
 * The live markets that actually have the page at `path`.
 *
 * Derived from `route-policy.ts` — the same table the proxy 404s on and the footer
 * links from — so an alternate can never name a URL the proxy would refuse.
 *
 * Catalogue and private routes deliberately get NOTHING. A product slug existing under
 * `/sk` says nothing about whether the same slug exists under `/de`: that needs a
 * stable identity and a per-market publication state, which live in Saleor and are not
 * this function's to guess. Emitting twelve product alternates on faith is how a whole
 * cluster gets discarded. When those identities are available, pass the markets in
 * explicitly rather than widening this rule.
 */
function eligibleMarkets(normalizedPath: string): readonly string[] {
	const live = liveMarkets();

	// The market homepage. It exists wherever the market does, by construction.
	const segment = normalizedPath.replace(/^\//, "").split("/")[0] ?? "";
	if (!segment) return live;

	const policy = routePolicyFor(segment);
	// Not a market-root segment at all — a product slug, or something unknown. Say
	// nothing rather than assert a translation that may not exist.
	if (!policy) return [];
	if (policy.kind === "catalogue" || policy.kind === "private") return [];
	// A page nobody may index has no business nominating alternates.
	if (!policy.indexable) return [];

	return live.filter((market) => marketHasRoute(market, segment));
}

/**
 * Build hreflang alternates for a given path.
 *
 * @param path - Path AFTER the market prefix, e.g. "/products/stresny-nosic" or ""
 * @returns Array of { hreflang, url } for all 12 markets + x-default
 *
 * @example
 *   buildHreflangAlternates("/products")
 *   // → [
 *   //   { hreflang: "sk", url: "https://maky.store/sk/products" },
 *   //   { hreflang: "cs", url: "https://maky.store/cz/products" },
 *   //   { hreflang: "de", url: "https://maky.store/de/products" },
 *   //   { hreflang: "de-AT", url: "https://maky.store/at/products" },
 *   //   ...
 *   //   { hreflang: "en-US", url: "https://maky.store/us/products" },
 *   //   { hreflang: "en-CA", url: "https://maky.store/ca/products" },
 *   //   { hreflang: "x-default", url: "https://maky.store/sk/products" },
 *   // ]
 */
export function buildHreflangAlternates(path: string = ""): HreflangEntry[] {
	const base = getBaseUrl();
	const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;

	// Only markets that are actually indexable AND actually have this page. Being
	// indexable was already required — listing all twelve pointed the cluster at
	// eleven `noindex` storefronts, and hreflang annotations that are not
	// reciprocated get the WHOLE cluster ignored rather than just the bad entry.
	//
	// Having the page is the half that was missing, and it only became reachable when
	// this helper stopped being the homepage's alone. `/sk/o-nas` is a real page and
	// `/cz/o-nas` is a 404; annotating them as translations of each other is the same
	// non-reciprocal defect in a new place.
	const markets = eligibleMarkets(normalizedPath);

	// A cluster of one says nothing: hreflang describes alternates, and a page has
	// no alternate to itself. Emitting `x-default` alone is worse than emitting
	// nothing, because it invites a crawler to treat a single-market site as an
	// international one. As markets go live this starts producing tags on its own.
	if (markets.length < 2) return [];

	const alternates: HreflangEntry[] = markets.map((market) => ({
		// The MARKET's locale, not its language. `LOCALE_MAP[...].htmlLang` is a bare
		// language for all twelve — "de" for both Germany and Austria, "en" for both
		// the US and Canada — so it was patched with a hardcoded list of the three
		// markets that happened to collide today. That produced a real asymmetry:
		// Germany was annotated as generic "de" while Austria got "de-AT", though
		// they are separate storefronts on separate channels with their own pricing.
		//
		// `CHANNEL_MAP[market].locale` is already language-REGION for all twelve, so
		// taking it from the market's own identity is both correct and closed: a
		// thirteenth market that shares a language needs no new branch here. Under
		// the old rule it would silently have emitted a duplicate bare language, and
		// a cluster with two pages claiming the same hreflang is ignored wholesale.
		hreflang: CHANNEL_MAP[market].locale,
		url: `${base}/${market}${normalizedPath}`,
	}));

	// x-default → the first live market, not a hardcoded `sk`. If sk is ever taken
	// out of the live set, an x-default pointing at a noindex page would be the
	// single worst entry in the cluster.
	alternates.push({
		hreflang: "x-default",
		url: `${base}/${markets[0]}${normalizedPath}`,
	});

	return alternates;
}

/**
 * Build canonical URL for a specific market and path.
 */
export function buildCanonicalUrl(market: string, path: string = ""): string {
	const base = getBaseUrl();
	const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;
	return `${base}/${market}${normalizedPath}`;
}

/**
 * Just the `languages` map, for callers that already own their canonical.
 *
 * `buildAlternatesMetadata` also builds the canonical, and it builds an ABSOLUTE one
 * via `getBaseUrl()`. The legal and CMS routes have always emitted a relative canonical
 * (`marketHref`), which Next resolves against `metadataBase` — so using the full helper
 * there would silently rewrite the canonical on every one of those pages as a side
 * effect of adding hreflang. Two separate decisions; only one of them is being made.
 *
 * Returns `undefined` rather than `{}` when there is nothing to say, so the caller can
 * spread it away entirely instead of emitting an empty annotation.
 */
export function buildLanguageAlternates(path: string = ""): Record<string, string> | undefined {
	const entries = buildHreflangAlternates(path);
	if (entries.length === 0) return undefined;
	return Object.fromEntries(entries.map((entry) => [entry.hreflang, entry.url]));
}

/**
 * Build Next.js Metadata `alternates` object with languages map.
 * This is the format Next.js expects for generateMetadata().
 *
 * @example
 *   // In generateMetadata():
 *   return {
 *     title: "Products",
 *     ...buildAlternatesMetadata("sk", "/products"),
 *   };
 */
export function buildAlternatesMetadata(
	channelSlug: string,
	path: string = "",
): { alternates: { canonical: string; languages?: Record<string, string> } } {
	const market = REVERSE_MAP[channelSlug] || channelSlug;
	const hreflangs = buildHreflangAlternates(path);

	const languages: Record<string, string> = {};
	for (const entry of hreflangs) {
		languages[entry.hreflang] = entry.url;
	}

	return {
		alternates: {
			canonical: buildCanonicalUrl(market, path),
			// Omitted rather than emitted empty while fewer than two markets are
			// live — `languages: {}` is a shape Next is free to render as an empty
			// annotation, and there is nothing to say yet.
			...(hreflangs.length > 0 ? { languages } : {}),
		},
	};
}
