import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { LOCALE_MAP } from "@/config/locale";

/**
 * All 12 markets for sitemap generation.
 */
const ALL_MARKETS = ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "gb", "us", "ca"] as const;

/**
 * Static pages that exist for every market.
 * Product/category pages will be added later via Saleor API.
 */
const STATIC_PATHS = [
	"",                 // homepage
	"/products",
	"/categories",
	"/contact",
	"/faq",
	"/shipping",
	"/returns",
	"/about",
	"/terms",
	"/privacy",
	"/claims",
];

/**
 * Build language alternates for a path across all markets.
 */
function buildLanguageAlternates(path: string): Record<string, string> {
	const base = getBaseUrl();
	const alternates: Record<string, string> = {};

	for (const market of ALL_MARKETS) {
		const config = CHANNEL_MAP[market];
		const localeConfig = LOCALE_MAP[config.locale];

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

		alternates[hreflang] = `${base}/${market}${path}`;
	}

	// x-default → primary market
	alternates["x-default"] = `${base}/sk${path}`;

	return alternates;
}

export default function sitemap(): MetadataRoute.Sitemap {
	const base = getBaseUrl();
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [];

	for (const path of STATIC_PATHS) {
		for (const market of ALL_MARKETS) {
			entries.push({
				url: `${base}/${market}${path}`,
				lastModified: now,
				changeFrequency: path === "" ? "daily" : "weekly",
				priority: path === "" ? 1.0 : 0.7,
				alternates: {
					languages: buildLanguageAlternates(path),
				},
			});
		}
	}

	return entries;
}