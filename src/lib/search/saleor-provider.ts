/**
 * Saleor's own search.
 *
 * It reads the base-language (Slovak) text only, so it is no longer the first thing a search asks:
 * `search-answer.ts` answers from the shop's own index of the shelf and comes here for what that
 * index does not hold, the roof-rack sets above all, which are found by a car's name, a maker or
 * a code, the same in every language.
 */

import { executePublicGraphQL } from "@/lib/graphql";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import {
	SearchProductsDocument,
	OrderDirection,
	ProductOrderField,
	type ProductListItemFragment,
} from "@/gql/graphql";
import type { SearchProduct, SearchResult, SearchPagination } from "./types";
import { baseSlugOfCategory } from "@/config/category-routes";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { publishableProductImage } from "@/lib/product-image";
import { transformToProductCard } from "@/ui/components/plp/utils";

interface SearchOptions {
	query: string;
	channel: string;
	limit?: number;
	cursor?: string;
	direction?: "forward" | "backward";
	sortBy?: "relevance" | "price-asc" | "price-desc" | "name" | "newest";
}

/** One page of Saleor's answer to `query`, as the results the page renders. */
export async function searchProducts(options: SearchOptions): Promise<SearchResult> {
	const { query, channel, limit = 20, cursor, direction = "forward", sortBy = "relevance" } = options;
	const localeConfig = getLocaleConfigByLocale(getLocaleFromChannel(channel));

	const { field, order } = mapSortToSaleor(sortBy);

	// Build pagination - Saleor uses cursor-based pagination
	const isBackward = direction === "backward" && cursor;

	const result = await executePublicGraphQL(SearchProductsDocument, {
		variables: {
			search: query,
			channel,
			lang: localeConfig.graphqlLanguageCode,
			sortBy: field,
			sortDirection: order,
			first: isBackward ? undefined : limit,
			after: isBackward ? undefined : cursor,
			last: isBackward ? limit : undefined,
			before: isBackward ? cursor : undefined,
		},
		revalidate: 60,
	});

	// A Saleor outage used to be presented to the visitor as "your search found
	// nothing", with no error surface and no log line. Zero results and a broken
	// upstream are different answers; the caller now gets to tell them apart.
	if (!result.ok) {
		logUpstreamError("search", upstreamError(result), { channel });
		return { products: [], pagination: { totalCount: 0 }, unavailable: true };
	}

	if (!result.data.products) {
		return { products: [], pagination: { totalCount: 0 } };
	}

	const products = result.data.products;
	const { products: searchProducts, dropped } = toSearchProducts(
		products.edges.map(({ node }) => node),
		channel,
	);

	const pagination: SearchPagination = {
		totalCount: dropped > 0 ? searchProducts.length : products.totalCount ?? 0,
		totalCountIsEstimate: dropped > 0,
		hasNextPage: products.pageInfo.hasNextPage,
		hasPreviousPage: products.pageInfo.hasPreviousPage,
		nextCursor: products.pageInfo.endCursor ?? undefined,
		prevCursor: products.pageInfo.startCursor ?? undefined,
	};

	return {
		products: searchProducts,
		pagination,
	};
}

/**
 * Saleor's product rows as the results the page renders, in the market's own language. A row the
 * exact-locale boundary refuses is left out and counted. Shared with the shop's own search
 * (`search-answer.ts`), so a hit looks the same whichever of the two found it.
 */
export function toSearchProducts(
	nodes: readonly ProductListItemFragment[],
	channel: string,
): { products: SearchProduct[]; dropped: number } {
	const locale = getLocaleFromChannel(channel);
	const localeConfig = getLocaleConfigByLocale(locale);
	const localized = resolveExactLocaleProducts(nodes, locale);
	const products: SearchProduct[] = localized.products.map((node) => ({
		id: node.id,
		name: node.name,
		slug: node.slug,
		// Never the "no image" GIF — the result card has a localized state for that.
		thumbnailUrl: publishableProductImage(node.thumbnail?.url) ?? undefined,
		thumbnailAlt: node.thumbnail?.alt,
		price: node.pricing?.priceRange?.start?.gross.amount ?? 0,
		currency: node.pricing?.priceRange?.start?.gross.currency ?? localeConfig.fallbackCurrency,
		categoryName: node.category?.name,
		// The BASE slug: abroad the category carries its translated one, and the rules keyed by slug read the base.
		categorySlug: baseSlugOfCategory(channel, node.category) ?? undefined,
		isPurchasable: node.isAvailableForPurchase === true,
		card: transformToProductCard(node, channel, locale),
	}));
	return { products, dropped: localized.dropped };
}

function mapSortToSaleor(sortBy: SearchOptions["sortBy"]): {
	field: ProductOrderField;
	order: OrderDirection;
} {
	switch (sortBy) {
		case "price-asc":
			return { field: ProductOrderField.MinimalPrice, order: OrderDirection.Asc };
		case "price-desc":
			return { field: ProductOrderField.MinimalPrice, order: OrderDirection.Desc };
		case "name":
			return { field: ProductOrderField.Name, order: OrderDirection.Asc };
		case "newest":
			return { field: ProductOrderField.Date, order: OrderDirection.Desc };
		case "relevance":
		default:
			// Saleor's own rank of a search, best first. It was `Rating` until 2026-11-27, a field no
			// product of this shop carries, so "relevance" was no order at all: "kuga" listed straps
			// before the Kuga's own sets. `Rank` exists only beside the `search` filter, which this
			// query always sends.
			return { field: ProductOrderField.Rank, order: OrderDirection.Desc };
	}
}
