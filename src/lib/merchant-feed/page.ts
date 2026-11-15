import { getLocaleConfigByLocale } from "@/config/locale";
import { MerchantFeedProductsDocument } from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { isMarketIndexable } from "@/lib/market-state";
import { resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { type FeedItem, type FeedSkipReason, feedItemsFor } from "./item";

/**
 * One page of a market's catalogue as feed items, for the writer (`scripts/ops/merchant-feed.mjs`).
 *
 * The writer walks the catalogue page by page and this is one step of that walk: one Saleor request,
 * read past every cache (a feed states prices, and nothing may hand it an hour-old one), resolved by the
 * exact-locale boundary the product page uses, so abroad a product without its whole translation is not
 * in the feed, as it is not in the sitemap and has no page.
 */

/** Products per step. The nodes are the product page's own and heavy; 50 keeps one answer near a megabyte. */
export const FEED_PAGE_DEFAULT = 50;
export const FEED_PAGE_MAX = 100;

export type FeedSkipCounts = Partial<Record<FeedSkipReason | "untranslated", number>>;

export interface FeedPage {
	market: string;
	/** How many products Saleor returned for this step, before anything was left out. */
	read: number;
	items: FeedItem[];
	skipped: FeedSkipCounts;
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export type FeedPageResult = { ok: true; page: FeedPage } | { ok: false; status: 404 | 502; error: string };

export async function readFeedPage(
	market: string,
	after: string | null,
	first: number = FEED_PAGE_DEFAULT,
): Promise<FeedPageResult> {
	const config = CHANNEL_MAP[market];
	// A market that is not open to search engines has no feed either: the feed would advertise its pages.
	if (!config || !isMarketIndexable(market)) {
		return { ok: false, status: 404, error: "no such market, or the market is not indexable" };
	}
	const { saleorSlug: channel, locale } = config;

	const result = await executePublicGraphQL(MerchantFeedProductsDocument, {
		variables: {
			channel,
			first: Math.min(Math.max(1, Math.trunc(first) || FEED_PAGE_DEFAULT), FEED_PAGE_MAX),
			after,
			lang: getLocaleConfigByLocale(locale).graphqlLanguageCode,
		},
		cache: "no-store",
	});
	if (!result.ok) {
		logUpstreamError("merchant-feed", upstreamError(result), { channel, after: after ?? "start" });
		return { ok: false, status: 502, error: "the catalogue could not be read" };
	}
	const connection = result.data.products;
	if (!connection) return { ok: false, status: 502, error: "the catalogue answered without products" };

	const items: FeedItem[] = [];
	const skipped: FeedSkipCounts = {};
	const count = (reason: keyof FeedSkipCounts) => {
		skipped[reason] = (skipped[reason] ?? 0) + 1;
	};

	for (const { node } of connection.edges) {
		const product = resolveExactLocaleProduct(node, locale);
		if (!product) {
			count("untranslated");
			continue;
		}
		const outcome = feedItemsFor(product, channel);
		if (outcome.skipped) count(outcome.skipped);
		else items.push(...outcome.items);
	}

	return {
		ok: true,
		page: {
			market,
			read: connection.edges.length,
			items,
			skipped,
			pageInfo: {
				hasNextPage: connection.pageInfo.hasNextPage,
				endCursor: connection.pageInfo.endCursor ?? null,
			},
		},
	};
}
