import { cacheTag } from "next/cache";
import { cache } from "react";

import { getLocaleConfigByLocale } from "@/config/locale";
import { TypedDocumentString } from "@/gql/graphql";
import { CACHE_PROFILES, applyCacheProfile, buildTag } from "@/lib/cache-manifest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL, type GraphQLResult } from "@/lib/graphql";
import { liveMarkets } from "@/lib/market-state";
import { isSourceLocale, resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { productMissTagFor } from "@/lib/saleor/product-cache-tags";
import {
	catchUpstreamError,
	logUpstreamError,
	refuseToCacheUpstreamError,
	upstreamError,
	type AuthoritativeOutcome,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";

/**
 * Where one product exists: every live market, in ONE Saleor request.
 *
 * The product page used to find its hreflang cluster and its market-switcher targets by
 * running the full product lookup once per other live market — eleven heavy `ProductDetails`
 * queries (price, media, variants) to learn eleven booleans and eleven slugs. Worse, each miss
 * went on to ask again by translated slug, and for the ten products with an old-slug mapping
 * twice more: 11 requests for a product sold everywhere, 22 for one sold only in Slovakia and
 * 44 for a mapped one, repeated every 60 s because that is how long Next's in-memory cache
 * keeps an entry (measured on a production build, 2026-09-23).
 *
 * This asks once, with one alias per live market, for exactly the fields the exact-locale
 * check reads, and puts the answer through that same check — `resolveExactLocaleProduct` —
 * so the two cannot disagree about whether a market has the product.
 *
 * - **Identity is the Saleor product id.** `product(id:, channel:)` cannot return a different
 *   product; an alias that nevertheless answers with another id is treated as absent. There is
 *   no translated-slug retry and no old-slug fallback here: those belong to resolving the
 *   page's own URL, and asked by base slug they could only ever find nothing or a DIFFERENT
 *   product whose translated slug happened to match.
 * - **A fault is the whole map.** HTTP, network, GraphQL errors — partial ones included — or an
 *   alias missing from the answer: the result is `upstream-error`, it is not cached, it is
 *   logged, and the page falls back to naming only itself. One market that could not be asked
 *   is never reported as a market that does not have the product.
 * - **One attempt, one deadline.** It only decides hreflang and the switcher, so a slow or
 *   failing Saleor costs at most `PRESENCE_DEADLINE_MS`, never the transport's 1 + 2 + 4 s
 *   retry ladder.
 * - **Invalidation needs nothing new.** The entry carries `product:{channel}:{locale}:{base}`
 *   for every live channel, the miss tag for every foreign channel where the product is not
 *   (yet) there, and the category tag of every channel where it is — so the product,
 *   translation and category events `/api/revalidate` already sends reach it unchanged.
 */

/** How long a product page waits for the other markets' answer before leaving them out. */
export const PRESENCE_DEADLINE_MS = 1_500;

export type MarketPresence = { status: "found"; slug: string } | { status: "not-found" };

/** By friendly market slug (`sk`, `cz`, …), one entry per market that was asked. */
export type PresenceMap = Readonly<Record<string, MarketPresence>>;

type Named = { name?: string | null; slug?: string | null };
type Translatable = Named & {
	translation?:
		| (Named & { description?: string | null; seoTitle?: string | null; seoDescription?: string | null })
		| null;
};
type PresenceAttribute = { attribute: Translatable; values: readonly Translatable[] };

/** One alias of the answer. Only what `resolveExactLocaleProduct` reads, plus the id. */
export type PresenceProduct = Translatable & {
	id: string;
	category?: Translatable | null;
	attributes?: readonly PresenceAttribute[] | null;
	variants?:
		| readonly {
				selectionAttributes?: readonly PresenceAttribute[] | null;
				nonSelectionAttributes?: readonly PresenceAttribute[] | null;
		  }[]
		| null;
};

type PresenceData = Record<string, PresenceProduct | null>;

const named = (lang: string) => `name slug translation(languageCode: ${lang}) { name }`;
const attributes = (lang: string) => `attribute { ${named(lang)} } values { ${named(lang)} }`;

/**
 * The selection for one market. The source market reads the base row and is held only to a
 * name and a slug, exactly as `resolveExactLocaleProduct` holds it, so it asks for nothing more.
 */
function selectionFor(market: string): string {
	const locale = CHANNEL_MAP[market]!.locale;
	if (isSourceLocale(locale)) return "id name slug";
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	return [
		"id name slug",
		`translation(languageCode: ${lang}) { name slug description seoTitle seoDescription }`,
		`category { ${named(lang)} }`,
		`attributes { ${attributes(lang)} }`,
		`variants { selectionAttributes: attributes(variantSelection: VARIANT_SELECTION) { ${attributes(
			lang,
		)} } nonSelectionAttributes: attributes(variantSelection: NOT_VARIANT_SELECTION) { ${attributes(
			lang,
		)} } }`,
	].join(" ");
}

/** The document for these markets: `query ProductMarketPresence($id: ID!) { sk: product(id: $id, channel: "sk-eur") { … } … }`. */
export function presenceDocument(markets: readonly string[]): string {
	const aliases = markets.map(
		(market) =>
			`${market}: product(id: $id, channel: ${JSON.stringify(
				CHANNEL_MAP[market]!.saleorSlug,
			)}) { ${selectionFor(market)} }`,
	);
	return `query ProductMarketPresence($id: ID!) { ${aliases.join(" ")} }`;
}

/**
 * The transport answer, read market by market through the exact-locale boundary.
 *
 * Exported for the parity test: whatever this decides must be what the page's own lookup
 * would decide about the same Saleor data.
 */
export function readPresence(
	result: GraphQLResult<PresenceData>,
	productId: string,
	markets: readonly string[],
): ResourceOutcome<PresenceMap> {
	if (!result.ok) return upstreamError(result);
	const data = result.data;
	const presence: Record<string, MarketPresence> = {};
	for (const market of markets) {
		// An alias the response does not carry at all is not an answer about that market.
		if (!data || !(market in data)) {
			return {
				status: "upstream-error",
				type: "graphql",
				retryable: true,
				message: `presence answer carried no ${market} alias`,
			};
		}
		const product = data[market];
		const localized =
			product && product.id === productId
				? resolveExactLocaleProduct(product, CHANNEL_MAP[market]!.locale)
				: null;
		presence[market] = localized?.slug ? { status: "found", slug: localized.slug } : { status: "not-found" };
	}
	return { status: "found", resource: presence };
}

async function getProductMarketPresenceCached(
	productId: string,
	baseSlug: string,
	markets: readonly string[],
): Promise<AuthoritativeOutcome<PresenceMap>> {
	"use cache";
	// Same lifetime as the product entries it sits beside, and every live channel's product tag:
	// a product event for any market re-asks all of them.
	for (const [index, market] of markets.entries()) {
		const identity = {
			channel: CHANNEL_MAP[market]!.saleorSlug,
			locale: CHANNEL_MAP[market]!.locale,
			slug: baseSlug,
		};
		if (index === 0) applyCacheProfile(CACHE_PROFILES.products, identity);
		else cacheTag(buildTag(CACHE_PROFILES.products, identity));
	}

	const result = await executePublicGraphQL(
		new TypedDocumentString<PresenceData, { id: string }>(presenceDocument(markets)),
		{
			variables: { id: productId },
			// No fetch cache underneath: this entry and its tags are the whole invalidation story,
			// as for every foreign product answer (see `fetchProductOutcome`).
			revalidate: 0,
			signal: AbortSignal.timeout(PRESENCE_DEADLINE_MS),
			retry: false,
		},
	);
	const answer = refuseToCacheUpstreamError(readPresence(result, productId, markets));

	if (answer.status === "found" && result.ok) {
		for (const market of markets) {
			const { saleorSlug: channel, locale } = CHANNEL_MAP[market]!;
			if (answer.resource[market]?.status === "not-found") {
				// A miss abroad waits for a translation, a listing or a category translation — the
				// events that expire this channel's misses are exactly those.
				const missTag = productMissTagFor(channel, locale);
				if (missTag) cacheTag(missTag);
			} else {
				// Found: a category translation disappearing takes the product out of the market.
				const categorySlug = result.data[market]?.category?.slug;
				if (categorySlug)
					cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: categorySlug }));
			}
		}
	}

	return answer;
}

/**
 * The presence map for one product, or `upstream-error` — never a throw.
 *
 * `cache()` makes the sharing explicit: `generateMetadata` (hreflang) and the page's market
 * switcher ask the same question in the same request and get the same answer, fault included.
 */
export const getProductMarketPresence = cache(
	async (productId: string, baseSlug: string): Promise<ResourceOutcome<PresenceMap>> => {
		const markets = [...liveMarkets()];
		const outcome = await catchUpstreamError(() =>
			getProductMarketPresenceCached(productId, baseSlug, markets),
		);
		if (outcome.status === "upstream-error")
			logUpstreamError("product-presence", outcome, { productId, baseSlug });
		return outcome;
	},
);
