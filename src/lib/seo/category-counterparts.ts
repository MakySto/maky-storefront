import { categoryUrlFor } from "@/config/category-routes";
import { REVERSE_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";
import type { MarketCounterpart } from "@/lib/seo/hreflang";

/**
 * Live markets where this category is a real page: translated there, and stocked there — each at
 * ITS OWN root URL. Feeds the category page's hreflang and the market switcher.
 *
 * LIVE, not indexable: this feeds the market switcher as well as hreflang, and a preview market is
 * somewhere you can still be sent by hand. `counterpartAlternates()` narrows the hreflang cluster to
 * indexable markets on its own.
 *
 * The other markets come from ONE presence read per category (`getCategoryMarketPresence`). The
 * page's own market does not: the page has just read it, fresh, to build its head, and that read
 * is what decides whether the page itself is a listed one (`listedHere`). So the head and the
 * cluster it names cannot disagree about the page itself, whatever the presence entry remembers.
 *
 * A fault is not an answer about any market: the page then names only itself, which says nothing
 * rather than something unverified. With the page's market alone live nothing is asked.
 *
 * Order is `liveMarkets()` order, as it always was: a list that reshuffles between renders makes
 * two identical pages diff against each other for no reason.
 */
export async function categoryCounterparts(
	baseSlug: string,
	channel: string,
	listedHere: boolean,
	presence: (baseSlug: string) => Promise<ResourceOutcome<readonly string[]>>,
): Promise<MarketCounterpart[]> {
	const market = REVERSE_MAP[channel] ?? channel;
	const live = liveMarkets();

	let listedElsewhere: ReadonlySet<string> = new Set();
	if (live.some((other) => other !== market)) {
		const outcome = await presence(baseSlug);
		if (outcome.status === "found") listedElsewhere = new Set(outcome.resource);
	}

	return live.flatMap((other): MarketCounterpart[] =>
		(other === market ? listedHere : listedElsewhere.has(other))
			? [{ market: other, path: categoryUrlFor(other, baseSlug) }]
			: [],
	);
}
