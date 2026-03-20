/**
 * SEO helpers for multi-market hreflang, canonical URLs, and alternates.
 *
 * Used by generateMetadata() in layout/page files to produce
 * proper <link rel="alternate" hreflang="..."> tags for all 12 markets.
 */

import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { LOCALE_MAP } from "@/config/locale";
import { getBaseUrl } from "./config";

/**
 * All 12 markets (Wave 1 + Wave 2).
 */
const ALL_MARKETS = [
	"sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "gb", "us", "ca",
] as const;

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
 *   //   { hreflang: "en-GB", url: "https://maky.store/gb/products" },
 *   //   { hreflang: "en-US", url: "https://maky.store/us/products" },
 *   //   { hreflang: "en-CA", url: "https://maky.store/ca/products" },
 *   //   { hreflang: "x-default", url: "https://maky.store/sk/products" },
 *   // ]
 */
export function buildHreflangAlternates(path: string = ""): HreflangEntry[] {
	const base = getBaseUrl();
	const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;

	const alternates: HreflangEntry[] = ALL_MARKETS.map((market) => {
		const config = CHANNEL_MAP[market];
		const localeConfig = LOCALE_MAP[config.locale];

		// Use full locale for markets sharing a language (de-AT, en-GB, en-US, en-CA)
		let hreflang: string;
		if (market === "at") {
			hreflang = "de-AT";
		} else if (market === "gb") {
			hreflang = "en-GB";
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

	// x-default → primary market (sk)
	alternates.push({
		hreflang: "x-default",
		url: `${base}/sk${normalizedPath}`,
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
): { alternates: { canonical: string; languages: Record<string, string> } } {
	const market = REVERSE_MAP[channelSlug] || channelSlug;
	const hreflangs = buildHreflangAlternates(path);

	const languages: Record<string, string> = {};
	for (const entry of hreflangs) {
		languages[entry.hreflang] = entry.url;
	}

	return {
		alternates: {
			canonical: buildCanonicalUrl(market, path),
			languages,
		},
	};
}