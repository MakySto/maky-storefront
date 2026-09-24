import { cacheLife, cacheTag } from "next/cache";
import {
	CategoryPricesDocument,
	type CategoryPricesQuery,
	type OrderDirection,
	type ProductOrder,
	type ProductOrderField,
} from "@/gql/graphql";
import { getLocaleFromChannel } from "@/config/locale";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { priceBoundaries, spanBoundaries } from "@/ui/components/plp/price-ranges";

/**
 * Where the price filter's bands fall for a category in a channel, and in which currency.
 *
 * Up to `READ_ALL_LIMIT` products every price is read and the bands sit at the quartiles;
 * above it (the roof-rack sets) only the cheapest and dearest are, and the bands are spread
 * between them. The bands describe the category, not the page or the filters in force, so one
 * cached answer serves every visit.
 */
export interface CategoryPriceBands {
	readonly currency: string;
	/** Cut points, ascending. Empty when a price filter would not help. */
	readonly boundaries: readonly number[];
}

const READ_ALL_LIMIT = 300;
const PAGE = 100;
/** The bands are a convenience; they never hold the listing up. */
const DEADLINE_MS = 2_000;

type Products = NonNullable<NonNullable<CategoryPricesQuery["category"]>["products"]>;

export async function getCategoryPriceBands(
	baseSlug: string,
	channel: string,
): Promise<CategoryPriceBands | null> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	const read = async (variables: { first: number; after?: string | null; sortBy?: ProductOrder }) => {
		const result = await executePublicGraphQL(CategoryPricesDocument, {
			variables: { slug: baseSlug, channel, ...variables },
			revalidate: 0,
			retry: false,
			signal: AbortSignal.timeout(DEADLINE_MS),
		});
		// Thrown, never cached: an outage must not become "no price filter" for minutes.
		if (!result.ok) throw new Error(`[Listing] prices unavailable for ${baseSlug}: ${result.error.message}`);
		return result.data.category?.products ?? null;
	};

	const firstPage = await read({ first: PAGE });
	if (!firstPage) return null;

	const gross = (products: Products) =>
		products.edges.flatMap(({ node }) =>
			node.pricing?.priceRange?.start?.gross ? [node.pricing.priceRange.start.gross] : [],
		);

	if ((firstPage.totalCount ?? 0) <= READ_ALL_LIMIT) {
		const amounts = gross(firstPage);
		let page = firstPage;
		while (page.pageInfo.hasNextPage) {
			const next = await read({ first: PAGE, after: page.pageInfo.endCursor });
			if (!next) break;
			amounts.push(...gross(next));
			page = next;
		}
		const currency = amounts[0]?.currency;
		return currency ? { currency, boundaries: priceBoundaries(amounts.map((money) => money.amount)) } : null;
	}

	const [cheapest, dearest] = await Promise.all([
		read({ first: 1, sortBy: { field: "PRICE" as ProductOrderField, direction: "ASC" as OrderDirection } }),
		read({ first: 1, sortBy: { field: "PRICE" as ProductOrderField, direction: "DESC" as OrderDirection } }),
	]);
	const low = cheapest ? gross(cheapest)[0] : undefined;
	const high = dearest ? gross(dearest)[0] : undefined;
	if (!low || !high) return null;
	return { currency: low.currency, boundaries: spanBoundaries(low.amount, high.amount) };
}
