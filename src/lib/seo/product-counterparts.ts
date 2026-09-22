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
 *
 * The markets are asked CONCURRENTLY, and that is not a micro-optimisation. This used to be a
 * `for` loop with an `await` in it, which was free while Slovakia was the only live market —
 * the loop had nothing to iterate. Turning on twelve markets turned it into eleven Saleor
 * round trips in series on every product render, and every one of them sits in front of the
 * first byte because `generateMetadata` awaits it. Measured on the live catalogue, the eleven
 * lookups take 353 ms in series against 120 ms together, and in the app each is the heavier
 * localized product query rather than the bare one.
 *
 * Order is preserved deliberately: hreflang is a set, but a counterpart list that reshuffles
 * between renders makes two identical pages diff against each other for no reason.
 */
export async function productCounterparts(
	product: { slug: string; baseSlug: string },
	channel: string,
	lookup: (slug: string, channel: string) => Promise<ResourceOutcome<{ slug: string }>>,
): Promise<MarketCounterpart[]> {
	const market = REVERSE_MAP[channel] ?? channel;
	const others = liveMarkets().filter((other) => other !== market);

	const found = await Promise.all(
		others.map(async (other) => {
			const outcome = await lookup(product.baseSlug, CHANNEL_MAP[other]!.saleorSlug);
			return outcome.status === "found" ? { market: other, path: productPath(outcome.resource.slug) } : null;
		}),
	);

	return [
		{ market, path: productPath(product.slug) },
		...found.filter((entry): entry is MarketCounterpart => entry !== null),
	];
}
