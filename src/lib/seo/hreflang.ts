/**
 * SEO helpers for multi-market hreflang, canonical URLs, and alternates.
 *
 * Used by generateMetadata() in layout/page files to produce
 * proper <link rel="alternate" hreflang="..."> tags for all 12 markets.
 */

import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { LOCALE_MAP } from "@/config/locale";
import { liveMarkets } from "@/lib/market-state";
import { getBaseUrl } from "./config";

type HreflangEntry = {
	hreflang: string;
	url: string;
};

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

	// Only markets that are actually indexable. This used to list all twelve
	// unconditionally, which pointed the cluster at eleven `noindex` storefronts
	// with no catalogue — and hreflang annotations that are not reciprocated get
	// the WHOLE cluster ignored, not just the bad entry, so it was working against
	// the one market that is real.
	const markets = liveMarkets();

	// A cluster of one says nothing: hreflang describes alternates, and a page has
	// no alternate to itself. Emitting `x-default` alone is worse than emitting
	// nothing, because it invites a crawler to treat a single-market site as an
	// international one. As markets go live this starts producing tags on its own.
	if (markets.length < 2) return [];

	const alternates: HreflangEntry[] = markets.map((market) => {
		const config = CHANNEL_MAP[market];
		const localeConfig = LOCALE_MAP[config.locale];

		// Use full locale for markets sharing a language (de-AT, en-US, en-CA)
		let hreflang: string;
		if (market === "at") {
			hreflang = "de-AT";
		} else if (market === "us") {
			hreflang = "en-US";
		} else if (market === "ca") {
			hreflang = "en-CA";
		} else {
			hreflang = localeConfig.htmlLang;
		}

		return {
			hreflang,
			url: `${base}/${market}${normalizedPath}`,
		};
	});

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
