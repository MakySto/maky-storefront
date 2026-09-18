import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { productPath } from "@/lib/product-url";
import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";
import type { MarketCounterpart } from "@/lib/seo/hreflang";

/**
 * The same product in every LIVE market where it exists — published there and complete in
 * that market's language — each at ITS OWN URL. Feeds the PDP's hreflang and the market
 * switcher.
 *
 * Asked by the BASE slug (`Product.slug`). It used to be asked by the URL slug, which abroad
 * is the translated one: `/de/<german-slug>` looked for `<german-slug>` in Czechia, found
 * nothing, and the product lost every counterpart and every switcher target the moment it had
 * a translated slug. The base slug is known in every channel; the exact-locale boundary inside
 * `lookup` then hands back each market's own slug — the Slovak base slug in Slovakia, the
 * `CS` slug in Czechia, the `DE_AT` slug in Austria.
 */
export async function productCounterparts(
	product: { slug: string; baseSlug: string },
	channel: string,
	lookup: (slug: string, channel: string) => Promise<ResourceOutcome<{ slug: string }>>,
): Promise<MarketCounterpart[]> {
	const market = REVERSE_MAP[channel] ?? channel;
	const counterparts: MarketCounterpart[] = [{ market, path: productPath(product.slug) }];
	for (const other of liveMarkets()) {
		if (other === market) continue;
		const found = await lookup(product.baseSlug, CHANNEL_MAP[other]!.saleorSlug);
		if (found.status === "found")
			counterparts.push({ market: other, path: productPath(found.resource.slug) });
	}
	return counterparts;
}
