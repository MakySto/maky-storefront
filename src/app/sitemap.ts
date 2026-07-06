import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { LOCALE_MAP } from "@/config/locale";

/**
 * All 13 markets for sitemap generation.
 */
const ALL_MARKETS = ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "gb", "us", "ca"] as const;

/**
 * Paths that resolve for every market (real routes only — the old demo English
 * placeholders like /contact, /faq, /terms had no route on disk and are dropped;
 * /categories has no index page, only /categories/[slug], so it is dropped too).
 * Product/category detail pages are added later via the Saleor API.
 */
const SHARED_PATHS = [
	"",           // homepage
	"/products",  // product listing (PLP)
];

/**
 * SK-only content pages (legal/info) — gated to the `sk` market in code
 * (`if (REVERSE_MAP[channel] !== "sk") notFound()`), so they exist only under /sk
 * and must NOT be advertised for other markets.
 */
const SK_ONLY_PATHS = [
	"/obchodne-podmienky",
	"/reklamacie-a-vratenie",
	"/odstupenie-od-zmluvy",
	"/ochrana-osobnych-udajov",
	"/cookies",
	"/doprava-a-platba",
	"/kontakt",
	"/o-nas",
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

	// Cross-market real routes (homepage + product listing) for every market.
	for (const path of SHARED_PATHS) {
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

	// SK-only legal/info pages — no cross-market alternates (they 404 elsewhere).
	for (const path of SK_ONLY_PATHS) {
		entries.push({
			url: `${base}/sk${path}`,
			lastModified: now,
			changeFrequency: "monthly",
			priority: 0.3,
		});
	}

	return entries;
}