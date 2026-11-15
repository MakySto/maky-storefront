import "server-only";

import { categoryBaseSlug, categoryUrlFor, saleorSlugFor } from "@/config/category-routes";
import { TYRE_SHELF_MARKETS, TYRE_SHELF_SLUG, isTyreShelf } from "@/config/tyre-shelves";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { getShelfCodes, type ShelfCode } from "@/lib/listing/shelf-codes";
import { indexableMarkets } from "@/lib/market-state";
import type { MarketCounterpart } from "@/lib/seo/hreflang";
import {
	indexableTyrePageSlugs,
	tyreFamilyOffer,
	tyrePageOf,
	tyreSizeOffer,
	tyreSizePageOf,
	tyreSizePagesOfRim,
	type TyrePage,
} from "./size-pages";

/**
 * Where the tyre-size pages live and what a channel offers on them.
 *
 * `size-pages` knows the list; this knows the shop: which address is the snow-chain shelf in a market, whether the
 * market sells the shelf at all, and which of the list's codes the channel has on sale. The route, the proxy's
 * existence answer, the sitemap and the links all ask here, so they cannot disagree about what is a page.
 */

/**
 * What a path below a category names, as far as tyre pages go.
 *
 * `not-shelf`: not the snow-chain shelf, so nothing here applies and the caller carries on as before. On the shelf
 * the answer is final: `page` is a size, a rim or a family page, `absent` is an address the shelf does not have (a size the
 * list does not hold, a second spelling, or a market that does not sell the shelf).
 */
export type TyreRoute =
	| { readonly status: "not-shelf" }
	| { readonly status: "absent" }
	| { readonly status: "page"; readonly page: TyrePage };

export function tyreRouteOf(
	marketOrChannel: string,
	categorySegment: string,
	segments: readonly string[],
): TyreRoute {
	if (!isTyreShelf(categoryBaseSlug(marketOrChannel, categorySegment))) return { status: "not-shelf" };
	const market = REVERSE_MAP[marketOrChannel] ?? marketOrChannel;
	if (!TYRE_SHELF_MARKETS.has(market)) return { status: "absent" };
	const page = tyrePageOf(segments);
	return page ? { status: "page", page } : { status: "absent" };
}

/** The market-relative path of a tyre page: `/snehove-retaze/205-60-r16`, `/snehove-retezy/r16` abroad. */
export function tyrePagePath(marketOrChannel: string, slug: string): string {
	return `${categoryUrlFor(marketOrChannel, TYRE_SHELF_SLUG)}/${slug}`;
}

/** The market-relative path of a size's page, or `null` for a size without one or a market without the shelf. */
export function tyreSizePagePath(marketOrChannel: string, label: string | null | undefined): string | null {
	const market = REVERSE_MAP[marketOrChannel] ?? marketOrChannel;
	if (!TYRE_SHELF_MARKETS.has(market)) return null;
	const page = tyreSizePageOf(label);
	return page ? tyrePagePath(marketOrChannel, page.slug) : null;
}

export interface TyreShelfOffer {
	/** The shelf's products in this channel, by public code. */
	readonly products: readonly ShelfCode[];
	readonly onSale: ReadonlySet<string>;
}

/**
 * What the channel sells on the shelf. Throws when the shop cannot be asked: "nothing is on sale" is a claim, and a
 * fault is not one. `null` is the shelf too large to read whole, which the shelf-code reader refuses (it holds 145).
 */
export async function readTyreShelfOffer(channel: string): Promise<TyreShelfOffer | null> {
	const products = await getShelfCodes(saleorSlugFor(TYRE_SHELF_SLUG), channel);
	if (!products) return null;
	return { products, onSale: new Set(products.map((product) => product.code)) };
}

/**
 * The tyre pages of a market for its sitemap, as market-relative paths. Empty for a market that does not sell the
 * shelf. Throws when the shop cannot be asked; the sitemap decides what a fault costs.
 */
export async function indexableTyrePagePaths(market: string): Promise<string[]> {
	if (!TYRE_SHELF_MARKETS.has(market)) return [];
	const channel = CHANNEL_MAP[market]?.saleorSlug;
	if (!channel) return [];
	const offer = await readTyreShelfOffer(channel);
	if (!offer) return [];
	return indexableTyrePageSlugs(offer.onSale).map((slug) => tyrePagePath(market, slug));
}

/** May this page be indexed in a channel that sells these codes? A rim page: when one of its sizes may. */
export function isTyrePageIndexable(page: TyrePage, onSale: ReadonlySet<string>): boolean {
	if (page.kind === "size") return tyreSizeOffer(page.label, onSale).indexable;
	if (page.kind === "family") return tyreFamilyOffer(page.key, onSale).indexable;
	return tyreSizePagesOfRim(page.rim).some((size) => tyreSizeOffer(size.label, onSale).indexable);
}

/**
 * The same page in every market that is indexed, sells the shelf and offers enough for this page to be indexed
 * there: the hreflang cluster. Joined on the size, never on the URL (the shelf's segment is localized). A market
 * whose shop cannot be asked right now is left out of this answer rather than guessed.
 */
export async function tyrePageCounterparts(page: TyrePage): Promise<MarketCounterpart[]> {
	const counterparts = await Promise.all(
		indexableMarkets()
			.filter((market) => TYRE_SHELF_MARKETS.has(market))
			.map(async (market): Promise<MarketCounterpart | null> => {
				try {
					const offer = await readTyreShelfOffer(CHANNEL_MAP[market].saleorSlug);
					return offer && isTyrePageIndexable(page, offer.onSale)
						? { market, path: tyrePagePath(market, page.slug) }
						: null;
				} catch {
					return null;
				}
			}),
	);
	return counterparts.filter((counterpart): counterpart is MarketCounterpart => counterpart !== null);
}
