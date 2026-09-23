import { REVERSE_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { productPath } from "@/lib/product-url";
import type { PresenceMap } from "@/lib/saleor/product-presence";
import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";
import type { MarketCounterpart } from "@/lib/seo/hreflang";

/**
 * The same product in every LIVE market where it exists — published there and complete in
 * that market's language — each at ITS OWN URL. Feeds the PDP's hreflang and the market
 * switcher.
 *
 * Answered by ONE presence query per product (`getProductMarketPresence`), keyed by the
 * Saleor product id. It used to run the full product lookup once per other live market —
 * eleven heavy queries, and up to four each for a product missing abroad — which is why a
 * product sold only in Slovakia cost 25 Saleor requests cold and 23 again every minute. The
 * exact-locale boundary still decides each market, inside the presence query, and each market
 * still comes back at its own slug: the Slovak base slug in Slovakia, the `CS` slug in
 * Czechia, the `DE_AT` slug in Austria.
 *
 * A fault is not an answer about any market: the page then names only itself, which says
 * nothing rather than something unverified. With Slovakia alone live nothing is asked.
 *
 * Order is preserved deliberately: hreflang is a set, but a counterpart list that reshuffles
 * between renders makes two identical pages diff against each other for no reason.
 */
export async function productCounterparts(
	product: { id: string; slug: string; baseSlug: string },
	channel: string,
	presence: (productId: string, baseSlug: string) => Promise<ResourceOutcome<PresenceMap>>,
): Promise<MarketCounterpart[]> {
	const market = REVERSE_MAP[channel] ?? channel;
	const self: MarketCounterpart = { market, path: productPath(product.slug) };
	const others = liveMarkets().filter((other) => other !== market);
	if (others.length === 0) return [self];

	const outcome = await presence(product.id, product.baseSlug);
	if (outcome.status !== "found") return [self];

	const found = others.flatMap((other): MarketCounterpart[] => {
		const answer = outcome.resource[other];
		return answer?.status === "found" ? [{ market: other, path: productPath(answer.slug) }] : [];
	});
	return [self, ...found];
}
