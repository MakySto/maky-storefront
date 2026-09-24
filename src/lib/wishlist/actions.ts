"use server";

import { WishlistProductsDocument } from "@/gql/graphql";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { SALEOR_SLUGS } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { transformToProductCard } from "@/ui/components/plp/utils";
import type { ProductCardData } from "@/ui/components/plp/product-card";
import { WISHLIST_MAX, isWishlistProductId } from "./ids";

/**
 * The cards for the favourites page, in the order the shopper saved them.
 *
 * Read-only: one `products(filter: { ids })` query in the page's channel, so the price, the
 * availability and the translation are today's, and a product this market does not sell simply
 * does not come back (the list keeps its id; another market may still show it).
 *
 * The ids come from the browser, so they are validated and capped here, and an unknown channel
 * is refused before anything is asked of Saleor.
 */
export async function loadWishlistProducts(
	channel: string,
	ids: readonly string[],
): Promise<ProductCardData[]> {
	if (!SALEOR_SLUGS.has(channel)) return [];
	const wanted = [...new Set(ids.filter(isWishlistProductId))].slice(0, WISHLIST_MAX);
	if (wanted.length === 0) return [];

	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const result = await executePublicGraphQL(WishlistProductsDocument, {
		variables: { ids: wanted, channel, first: wanted.length, lang },
		// Short: the page shows prices, and a shopper comparing favourites expects today's.
		revalidate: 60,
	});
	if (!result.ok) {
		console.warn(`[Wishlist] products for ${channel} failed:`, result.error.message);
		throw new Error("wishlist-unavailable");
	}

	const nodes = result.data.products?.edges.map(({ node }) => node) ?? [];
	const { products } = resolveExactLocaleProducts(nodes, locale);
	const order = new Map(wanted.map((id, index) => [id, index]));
	return products
		.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
		.map((product) => transformToProductCard(product, channel, locale));
}
