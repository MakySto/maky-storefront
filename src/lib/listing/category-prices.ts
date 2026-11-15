import { cacheLife, cacheTag } from "next/cache";
import {
	CategoryPricesDocument,
	type CategoryPricesQuery,
	type OrderDirection,
	type ProductOrder,
	type ProductOrderField,
} from "@/gql/graphql";
import { getLocaleFromChannel } from "@/config/locale";
import { createKeptRead } from "@/lib/cache/kept-read";
import { settle, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
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

/** The most products a category may hold for every price to be read (`category-facets.ts` reads the same). */
export const READ_ALL_LIMIT = 300;
const PAGE = 100;
/**
 * The bands are a convenience; a visitor never waits for them longer than this, and only when the process
 * holds no answer for the category yet (see `@/lib/cache/kept-read`).
 */
const WAIT_MS = 2_000;
/** What one load may take in all. Nobody waits for it: the roof-rack sets need 1.5 to 1.9 s per read. */
const LOAD_DEADLINE_MS = 8_000;
/**
 * The bands are cut points between the cheapest and the dearest (or quartiles): ten minutes old they are as
 * good as new. Every refresh of the roof-rack sets is two price-sorted queries over 26 000 products, which
 * Saleor keeps computing after a client has given up, so it is not repeated every minute in every market.
 */
const FRESH_MS = 10 * 60_000;
const PAUSE_MS = 10_000;

type Products = NonNullable<NonNullable<CategoryPricesQuery["category"]>["products"]>;

/**
 * Throws on a fault to the caller: an outage must not become "no price filter" for minutes. Inside
 * the cache it is a value that is remembered for seconds only (`@/lib/cache-fault`).
 */
export async function getCategoryPriceBands(
	baseSlug: string,
	channel: string,
	/** What the caller already knows: the category holds more than `READ_ALL_LIMIT` products here. */
	large = false,
): Promise<CategoryPriceBands | null> {
	return valueOrThrow(await readCategoryPriceBands(baseSlug, channel, large));
}

interface BandsRequest {
	readonly baseSlug: string;
	readonly channel: string;
	readonly large: boolean;
}

const keptBands = createKeptRead<BandsRequest, CategoryPriceBands | null>({
	name: "price-bands",
	freshMs: FRESH_MS,
	pauseMs: PAUSE_MS,
	loadDeadlineMs: LOAD_DEADLINE_MS,
	load: ({ baseSlug, channel, large }, signal) => computeCategoryPriceBands(baseSlug, channel, large, signal),
});

const bandsKey = (baseSlug: string, channel: string) => `${channel}\u0000${baseSlug}`;

/**
 * Reads the bands of one category into the process, waiting for all of it. For the boot warm-up of the
 * categories whose first read is the slow one; resolves to whether the process now holds an answer.
 */
export function prewarmCategoryPriceBands(
	baseSlug: string,
	channel: string,
	large: boolean,
): Promise<boolean> {
	return keptBands.prewarm(bandsKey(baseSlug, channel), { baseSlug, channel, large });
}

/** For tests. */
export function __forgetCategoryPriceBands(): void {
	keptBands.forget();
}

async function readCategoryPriceBands(
	baseSlug: string,
	channel: string,
	large: boolean,
): Promise<CachedRead<CategoryPriceBands | null>> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	return settle(() => keptBands.read(bandsKey(baseSlug, channel), { baseSlug, channel, large }, WAIT_MS));
}

async function computeCategoryPriceBands(
	baseSlug: string,
	channel: string,
	large: boolean,
	signal: AbortSignal,
): Promise<CategoryPriceBands | null> {
	const read = async (variables: { first: number; after?: string | null; sortBy?: ProductOrder }) => {
		const result = await executePublicGraphQL(CategoryPricesDocument, {
			variables: { slug: baseSlug, channel, ...variables },
			revalidate: 0,
			retry: false,
			signal,
		});
		if (!result.ok) throw new Error(`[Listing] prices unavailable for ${baseSlug}: ${result.error.message}`);
		return result.data.category?.products ?? null;
	};

	// A category the caller knows to be big goes straight to its two ends. The page used to be read first
	// only to learn the total, which for the roof-rack sets was a hundred products with their prices read
	// for nothing, one whole round trip in front of the two that count.
	const firstPage = large ? null : await read({ first: PAGE });
	if (!large && !firstPage) return null;

	const gross = (products: Products) =>
		products.edges.flatMap(({ node }) =>
			node.pricing?.priceRange?.start?.gross ? [node.pricing.priceRange.start.gross] : [],
		);

	if (firstPage && (firstPage.totalCount ?? 0) <= READ_ALL_LIMIT) {
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
