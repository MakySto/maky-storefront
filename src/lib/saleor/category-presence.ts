import { cacheTag } from "next/cache";
import { cache } from "react";

import { getLocaleConfigByLocale } from "@/config/locale";
import { TypedDocumentString } from "@/gql/graphql";
import { CACHE_PROFILES, applyCacheProfile, buildTag } from "@/lib/cache-manifest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL, type GraphQLResult } from "@/lib/graphql";
import { liveMarkets } from "@/lib/market-state";
import { isSourceLocale, resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";
import {
	cachedOutcome,
	catchUpstreamError,
	logUpstreamError,
	upstreamError,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";

/**
 * Where one category is a real page: every live market, in ONE Saleor request.
 *
 * The category page finds its hreflang cluster and its market-switcher targets by asking which
 * other live markets carry the same category. It used to run the full category read once per
 * live market — `ProductListByCategory` with a product card in it, twelve of them at once — and
 * since PR 46 an empty or untranslated market is remembered for seconds only (so that a head never
 * outlives its stock), which for a category that is empty in eight markets meant up to eight heavy
 * reads every few seconds while its pages were requested. For a question with a one-line answer
 * that is a lot to put through the page bundle's request queue, whose twelve slots
 * (`maxConcurrent` in `graphql.ts`) the header's own deadline-bound reads share.
 *
 * This asks once, with one alias per live market, for exactly the fields the two conditions read —
 * the exact-locale boundary and the product count — and puts the answer through that same
 * boundary (`resolveExactLocaleCategory`), so it cannot disagree with the page's own lookup, nor
 * with `fetchStockedCategorySlugs`, which the sitemap and the menus use for the same question.
 *
 * - **Identity is the slug.** Categories are global in Saleor; only their products are per
 *   channel. `category(slug:)` therefore names one category in every alias, and the aliases differ
 *   in the translation they ask for and in the channel they count. There is no translated-slug
 *   retry: the slug here is the base slug the caller already holds.
 * - **A listed market is translated AND stocked.** The two conditions under which the page there is
 *   indexable too. The own market is not decided here — the page knows it from its own fresh read.
 * - **A fault is the whole answer.** HTTP, network, GraphQL errors — partial ones included — or an
 *   alias missing from the response: `upstream-error`, remembered for seconds (`cachedOutcome`),
 *   logged under the scope `category-presence`. A market that could not be asked is never reported
 *   as a market that does not have the category; the page names only itself instead.
 * - **One attempt, one deadline.** This only decides hreflang and the switcher, so a slow Saleor
 *   costs at most `CATEGORY_PRESENCE_DEADLINE_MS`, never the transport's 1 + 2 + 4 s retry ladder.
 * - **It keeps the normal life of a category entry.** An empty market is not an urgent state here
 *   (the own market's head has its own short life); what the page needs is for a market to appear or
 *   leave when its stock does, and the entry carries every live channel's category tag, so the
 *   product and category events `/api/revalidate` already sends expire it unchanged.
 */

/** How long the category page waits for the other markets' answer before leaving them out. */
export const CATEGORY_PRESENCE_DEADLINE_MS = 1_500;

type PresenceTranslation = {
	name?: string | null;
	slug?: string | null;
	description?: string | null;
	seoTitle?: string | null;
	seoDescription?: string | null;
};

/** One alias of the answer. Only what `resolveExactLocaleCategory` and the emptiness check read. */
export type PresenceCategory = {
	name?: string | null;
	slug?: string | null;
	translation?: PresenceTranslation | null;
	products?: { totalCount?: number | null } | null;
};

type PresenceData = Record<string, PresenceCategory | null>;

/**
 * The selection for one market. The source market reads the base row and is held only to a name
 * and a slug, exactly as `resolveExactLocaleCategory` holds it, so it asks for no translation.
 */
function selectionFor(market: string): string {
	const { saleorSlug, locale } = CHANNEL_MAP[market]!;
	const products = `products(channel: ${JSON.stringify(saleorSlug)}) { totalCount }`;
	if (isSourceLocale(locale)) return `name slug ${products}`;
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	return `name slug translation(languageCode: ${lang}) { name slug description seoTitle seoDescription } ${products}`;
}

/** The document for these markets: `query CategoryMarketPresence($slug: String!) { sk: category(slug: $slug) { … } … }`. */
export function categoryPresenceDocument(markets: readonly string[]): string {
	const aliases = markets.map((market) => `${market}: category(slug: $slug) { ${selectionFor(market)} }`);
	return `query CategoryMarketPresence($slug: String!) { ${aliases.join(" ")} }`;
}

/**
 * The transport answer, read market by market through the exact-locale boundary: the friendly
 * slugs of the markets where the category is translated and holds at least one product.
 *
 * Exported for the parity test: whatever this decides must be what the page's own lookup, and the
 * sitemap's, would decide about the same Saleor data.
 */
export function readCategoryPresence(
	result: GraphQLResult<PresenceData>,
	markets: readonly string[],
): ResourceOutcome<readonly string[]> {
	if (!result.ok) return upstreamError(result);
	const data = result.data;
	const listed: string[] = [];
	for (const market of markets) {
		// An alias the response does not carry at all is not an answer about that market.
		if (!data || !(market in data)) {
			return {
				status: "upstream-error",
				type: "graphql",
				retryable: true,
				message: `category presence answer carried no ${market} alias`,
			};
		}
		const category = resolveExactLocaleCategory(data[market], CHANNEL_MAP[market]!.locale);
		if (category && (category.products?.totalCount ?? 0) > 0) listed.push(market);
	}
	return { status: "found", resource: listed };
}

async function getCategoryMarketPresenceCached(
	baseSlug: string,
	markets: readonly string[],
): Promise<ResourceOutcome<readonly string[]>> {
	"use cache";
	// The life of the category entries it replaces, and every live channel's category tag: a product
	// or category event for any market re-asks all of them, in the same one request.
	for (const [index, market] of markets.entries()) {
		const identity = {
			channel: CHANNEL_MAP[market]!.saleorSlug,
			locale: CHANNEL_MAP[market]!.locale,
			slug: baseSlug,
		};
		if (index === 0) applyCacheProfile(CACHE_PROFILES.categories, identity);
		else cacheTag(buildTag(CACHE_PROFILES.categories, identity));
	}

	const result = await executePublicGraphQL(
		new TypedDocumentString<PresenceData, { slug: string }>(categoryPresenceDocument(markets)),
		{
			variables: { slug: baseSlug },
			// No fetch cache underneath: this entry and its tags are the whole invalidation story, as for
			// the category entry itself (`getCategoryOutcomeCached`) and for every foreign product answer.
			cache: "no-store",
			signal: AbortSignal.timeout(CATEGORY_PRESENCE_DEADLINE_MS),
			retry: false,
		},
	);
	// A fault is the `upstream-error` outcome, remembered for seconds (`cachedOutcome`), not thrown.
	return cachedOutcome(async () => readCategoryPresence(result, markets));
}

/**
 * The live markets where this category is a real page, or `upstream-error` — never a throw.
 *
 * `cache()` makes the sharing explicit: `generateMetadata` (hreflang) and the page's market
 * switcher ask the same question in the same request and get the same answer, fault included, and
 * the fault is logged once per request.
 */
export const getCategoryMarketPresence = cache(
	async (baseSlug: string): Promise<ResourceOutcome<readonly string[]>> => {
		const markets = [...liveMarkets()];
		const outcome = await catchUpstreamError(() => getCategoryMarketPresenceCached(baseSlug, markets));
		if (outcome.status === "upstream-error")
			logUpstreamError("category-presence", outcome, { slug: baseSlug });
		return outcome;
	},
);
