import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";

const LEGAL_PAGES = {
	terms: "obchodne-podmienky",
	privacy: "ochrana-osobnych-udajov",
	withdrawal: "odstupenie-od-zmluvy",
} as const;

export type OrderLegalLinks = Record<keyof typeof LEGAL_PAGES, string>;

/**
 * The three pages the order sentence links, for the market of this checkout, or `null` when the market does not
 * serve all of them (`route-policy`, the same answer the footer and the proxy go by): a sentence with a link to a
 * 404 is worse than no sentence.
 */
export function orderLegalLinks(channelSlug: string): OrderLegalLinks | null {
	const market = REVERSE_MAP[channelSlug] ?? "";
	const segments = Object.values(LEGAL_PAGES);
	if (!market || !segments.every((segment) => marketHasRoute(market, segment))) return null;
	return {
		terms: marketHref(channelSlug, `/${LEGAL_PAGES.terms}`),
		privacy: marketHref(channelSlug, `/${LEGAL_PAGES.privacy}`),
		withdrawal: marketHref(channelSlug, `/${LEGAL_PAGES.withdrawal}`),
	};
}
