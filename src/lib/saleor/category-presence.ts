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
	type UpstreamError,
} from "@/lib/saleor/resource-outcome";

/**
 * Where one category is a real page: every live market, in two small Saleor requests.
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
 * This asks with one alias per market for exactly what the two conditions read — the exact-locale
 * boundary and whether the market holds a product — and puts the answer through that same boundary
 * (`resolveExactLocaleCategory`), so it cannot disagree with the page's own lookup, nor with
 * `fetchStockedCategorySlugs`, which the sitemap and the menus use for the same question.
 *
 * - **Identity is the slug.** Categories are global in Saleor; only their products are per
 *   channel. `category(slug:)` therefore names one category in every alias, and the aliases differ
 *   in the translation they ask for and in the channel they look into. There is no translated-slug
 *   retry: the slug here is the base slug the caller already holds.
 * - **A listed market is translated AND stocked.** The two conditions under which the page there is
 *   indexable too. The own market is not decided here — the page knows it from its own fresh read.
 * - **Two requests, the second only where the first let a market through.** The first asks the
 *   translations of every live market and no product; the second asks for the first product
 *   (`products(channel:, first: 1)`) in the translated markets and nowhere else. Whether a market
 *   holds a product is asked, never how many. One request for every market was measured on the
 *   production server on 2026-10-20 (32 categories, one at a time) and has no shape that stays
 *   short: the count took up to 1.7 s (`stresne-nosice`, 25 110 products in the Slovak channel)
 *   against the 1.5 s deadline below, the first product in all twelve markets up to 1.1 s, because
 *   where a category holds nothing Saleor looks through the channel's products before it can say
 *   so (80 to 100 ms for each such alias). 28 of the 32 categories are translated in the source
 *   market only, so for them the second request has one alias. Asked in two steps, no category
 *   took more than 0.23 s (one repeat of `stresne-nosice` took 0.70 s). The shape this does not
 *   like is a category translated in many markets and stocked in few: each empty market costs 80
 *   to 100 ms in the second request.
 * - **A fault is the whole answer.** HTTP, network, GraphQL errors — partial ones included — or an
 *   alias missing from either response: `upstream-error`, remembered for seconds (`cachedOutcome`),
 *   logged under the scope `category-presence` with the name of the request that failed. A market
 *   that could not be asked is never reported as a market that does not have the category; the page
 *   names only itself instead.
 * - **One attempt, one deadline for both requests.** This only decides hreflang and the switcher, so
 *   a slow Saleor costs at most `CATEGORY_PRESENCE_DEADLINE_MS` in all, never the transport's
 *   1 + 2 + 4 s retry ladder and never that deadline twice.
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

/** One alias of the first answer. Only what `resolveExactLocaleCategory` reads. */
export type TranslatedCategory = {
	name?: string | null;
	slug?: string | null;
	translation?: PresenceTranslation | null;
};

/** One alias of the second answer: the first product of the category in the alias's channel, if any. */
export type StockedCategory = {
	products?: { edges?: readonly unknown[] | null } | null;
};

type TranslatedData = Record<string, TranslatedCategory | null>;
type StockedData = Record<string, StockedCategory | null>;

/**
 * The first selection for one market. The source market reads the base row and is held only to a
 * name and a slug, exactly as `resolveExactLocaleCategory` holds it, so it asks for no translation.
 */
function translationSelection(market: string): string {
	const { locale } = CHANNEL_MAP[market]!;
	if (isSourceLocale(locale)) return "name slug";
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	return `name slug translation(languageCode: ${lang}) { name slug description seoTitle seoDescription }`;
}

/** The second selection for one market: whether its channel holds a product of the category. */
function stockSelection(market: string): string {
	return `products(channel: ${JSON.stringify(
		CHANNEL_MAP[market]!.saleorSlug,
	)}, first: 1) { edges { node { id } } }`;
}

function aliases(markets: readonly string[], selection: (market: string) => string): string {
	return markets.map((market) => `${market}: category(slug: $slug) { ${selection(market)} }`).join(" ");
}

/** The first document: `query CategoryMarketTranslations($slug: String!) { sk: category(slug: $slug) { name slug } cz: … }`. */
export function categoryTranslationsDocument(markets: readonly string[]): string {
	return `query CategoryMarketTranslations($slug: String!) { ${aliases(markets, translationSelection)} }`;
}

/** The second document, for the markets the first one let through: `query CategoryMarketStock($slug: String!) { … }`. */
export function categoryStockDocument(markets: readonly string[]): string {
	return `query CategoryMarketStock($slug: String!) { ${aliases(markets, stockSelection)} }`;
}

/** An alias the response does not carry at all is not an answer about that market. */
function missingAlias(market: string): UpstreamError {
	return {
		status: "upstream-error",
		type: "graphql",
		retryable: true,
		message: `category presence answer carried no ${market} alias`,
	};
}

/**
 * The first answer, read market by market through the exact-locale boundary: the markets where the
 * category is translated (or, for the source market, has a name).
 */
function readTranslatedMarkets(
	result: GraphQLResult<TranslatedData>,
	markets: readonly string[],
): ResourceOutcome<readonly string[]> {
	if (!result.ok) return upstreamError(result);
	const data = result.data;
	const translated: string[] = [];
	for (const market of markets) {
		if (!data || !(market in data)) return missingAlias(market);
		if (resolveExactLocaleCategory(data[market], CHANNEL_MAP[market]!.locale)) translated.push(market);
	}
	return { status: "found", resource: translated };
}

/** The second answer: the markets, of those asked, whose channel holds at least one product. */
function readStockedMarkets(
	result: GraphQLResult<StockedData>,
	markets: readonly string[],
): ResourceOutcome<readonly string[]> {
	if (!result.ok) return upstreamError(result);
	const data = result.data;
	const stocked: string[] = [];
	for (const market of markets) {
		if (!data || !(market in data)) return missingAlias(market);
		if ((data[market]?.products?.edges?.length ?? 0) > 0) stocked.push(market);
	}
	return { status: "found", resource: stocked };
}

/** The friendly slugs of the markets where the category is translated and holds at least one product. */
async function readPresence(
	baseSlug: string,
	markets: readonly string[],
): Promise<ResourceOutcome<readonly string[]>> {
	// One deadline for both requests: the page waits for the answer, not for the answer twice.
	const signal = AbortSignal.timeout(CATEGORY_PRESENCE_DEADLINE_MS);
	const ask = <Data>(document: string) =>
		executePublicGraphQL(new TypedDocumentString<Data, { slug: string }>(document), {
			variables: { slug: baseSlug },
			// No fetch cache underneath: this entry and its tags are the whole invalidation story, as for
			// the category entry itself (`getCategoryOutcomeCached`) and for every foreign product answer.
			cache: "no-store",
			signal,
			retry: false,
		});

	const translated = readTranslatedMarkets(
		await ask<TranslatedData>(categoryTranslationsDocument(markets)),
		markets,
	);
	// A fault, or a category that is translated nowhere (or does not exist): nothing left to ask.
	if (translated.status !== "found" || translated.resource.length === 0) return translated;
	return readStockedMarkets(
		await ask<StockedData>(categoryStockDocument(translated.resource)),
		translated.resource,
	);
}

async function getCategoryMarketPresenceCached(
	baseSlug: string,
	markets: readonly string[],
): Promise<ResourceOutcome<readonly string[]>> {
	"use cache";
	// The life of the category entries it replaces, and every live channel's category tag: a product
	// or category event for any market re-asks all of them, in the same two requests.
	for (const [index, market] of markets.entries()) {
		const identity = {
			channel: CHANNEL_MAP[market]!.saleorSlug,
			locale: CHANNEL_MAP[market]!.locale,
			slug: baseSlug,
		};
		if (index === 0) applyCacheProfile(CACHE_PROFILES.categories, identity);
		else cacheTag(buildTag(CACHE_PROFILES.categories, identity));
	}

	// A fault is the `upstream-error` outcome, remembered for seconds (`cachedOutcome`), not thrown.
	return cachedOutcome(() => readPresence(baseSlug, markets));
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
