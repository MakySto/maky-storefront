import "server-only";

import { baseSlugOfCategory } from "@/config/category-routes";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { ListingProductTypesDocument, SearchShelfProductsDocument } from "@/gql/graphql";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { liveMarkets } from "@/lib/market-state";
import { isSourceLocale, resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { collectConnection, PAGE_SIZE, SitemapIncompleteError } from "@/lib/seo/catalogue-walk";
import { peekSnapshot, warmSnapshot } from "@/lib/seo/sitemap-snapshot";
import { toShelfDoc } from "./shelf-docs";
import { buildShelfIndex, type ShelfDoc, type ShelfIndex } from "./shelf-index";

/**
 * Where the search index gets its products: one market's shelf, read from Saleor in the market's
 * own language and kept in this process.
 *
 * ## What is read
 *
 * Every product type except the roof-rack sets (`ROOF_RACK_SET_TYPE_SLUG`): 893 products in
 * Slovakia, 468 in the nine EU markets, a handful overseas (2026-11-27). A market's walk is five to
 * nine pages of a hundred and took 7 to 10 seconds from a browser; the sets, 22 000 to 28 000 per
 * market, are found by their car and never enter this index (`vehicle-intent.ts`).
 *
 * A foreign product passes the exact-locale boundary before it is indexed, the same one the
 * listing and the product page apply: what the shop would not show abroad is not found there.
 *
 * ## How it is kept
 *
 * In `sitemap-snapshot.ts`'s store, for the reasons written there: the answer is small (a few
 * hundred kilobytes of words), it is rebuilt in the background lane when it is an hour old or a
 * catalogue event arrived for the channel, and a failed rebuild replaces nothing. Prices and
 * availability shown on a result never come from here: the cards of a page are read fresh, by id.
 *
 * ## When it is not there
 *
 * A process that has just started has no index until the boot warm-up or the first search builds
 * it. A search waits `READY_WAIT_MS` for it and is then answered by Saleor's own search, as every
 * search was before this index existed. The build goes on, and the next search finds it.
 */

/** The product type of the per-car roof-rack sets: the one type the index leaves out. */
export const ROOF_RACK_SET_TYPE_SLUG = "roof-rack-bundle";

/** How long a search waits for an index that is still being built. */
export const READY_WAIT_MS = 2500;

const snapshotKey = (channel: string, locale: string): string => `search-shelf:${channel}\u0000${locale}`;

/** The index of one market's shelf, or `null` while there is none to answer from. */
export async function readShelfIndex(
	channel: string,
	options: { readonly waitMs?: number } = {},
): Promise<ShelfIndex | null> {
	const locale = getLocaleFromChannel(channel);
	const key = snapshotKey(channel, locale);
	const build = () => buildMarketIndex(channel, locale);

	const kept = peekSnapshot(key, channel, build);
	if (kept) return kept;

	let timer: ReturnType<typeof setTimeout> | undefined;
	const waited = new Promise<false>((resolve) => {
		timer = setTimeout(() => resolve(false), options.waitMs ?? READY_WAIT_MS);
	});
	try {
		const ready = await Promise.race([warmSnapshot(key, channel, build), waited]);
		return ready ? peekSnapshot(key, channel, build) ?? null : null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Have every live market's index built before the first customer searches. Never rejects: a market
 * that could not be built is built by the first search that needs it.
 */
export async function prewarmShelfIndexes(): Promise<void> {
	const started = Date.now();
	const markets = liveMarkets().filter((market) => CHANNEL_MAP[market]);
	let built = 0;
	// One market after another: a walk is short, and Saleor is asked for nothing in parallel here.
	for (const market of markets) {
		const { saleorSlug: channel, locale } = CHANNEL_MAP[market]!;
		const ready = await warmSnapshot(snapshotKey(channel, locale), channel, () =>
			buildMarketIndex(channel, locale),
		);
		if (ready) built += 1;
	}
	console.log(
		`[search] warm-up: ${built} of ${markets.length} shelf indexes built in ${Math.round(
			(Date.now() - started) / 1000,
		)} s`,
	);
}

async function buildMarketIndex(channel: string, locale: string): Promise<ShelfIndex> {
	const language = catalogLanguageForChannel(channel) ?? locale.split("-")[0]!.toLowerCase();
	const localized = !isSourceLocale(locale);
	const productTypes = await shelfProductTypes();
	if (productTypes.length === 0) return buildShelfIndex([], language);

	const nodes = await collectConnection(`${channel}: search shelf`, (after) =>
		fetchShelfPage(channel, locale, productTypes, after),
	);

	const docs: ShelfDoc[] = [];
	for (const node of nodes) {
		const product = resolveExactLocaleProduct(node, locale);
		if (!product) continue;
		docs.push(
			toShelfDoc(
				{
					...product,
					// The boundary swapped the translated slug into the product's category; the rules here
					// are keyed by BASE slug, so the category keeps Saleor's own row and takes the name only.
					category: node.category
						? { ...node.category, name: product.category?.name ?? node.category.name }
						: null,
				},
				{
					language,
					localized,
					baseSlugOf: (category) => baseSlugOfCategory(channel, { id: category.id, slug: category.slug }),
				},
			),
		);
	}
	if (docs.length < nodes.length) {
		console.log(
			`[search] ${channel}: ${nodes.length - docs.length} of ${
				nodes.length
			} shelf products are not translated for ${getLocaleConfigByLocale(locale).graphqlLanguageCode}`,
		);
	}
	return buildShelfIndex(docs, language);
}

/** Every product type's id except the roof-rack sets'. Throws when Saleor cannot say. */
async function shelfProductTypes(): Promise<string[]> {
	const result = await executePublicGraphQL(ListingProductTypesDocument, { cache: "no-store" });
	if (!result.ok) {
		logUpstreamError("search-shelf-types", upstreamError(result), {});
		throw new SitemapIncompleteError("search shelf: product types did not resolve");
	}
	const connection = result.data.productTypes;
	// A partial list would silently leave whole kinds of product out of the search.
	if (!connection || connection.pageInfo.hasNextPage) {
		throw new SitemapIncompleteError("search shelf: the product types do not fit one page");
	}
	return connection.edges
		.map(({ node }) => node)
		.filter((type) => type.slug !== ROOF_RACK_SET_TYPE_SLUG)
		.map((type) => type.id);
}

async function fetchShelfPage(
	channel: string,
	locale: string,
	productTypes: readonly string[],
	after: string | null,
) {
	const result = await executePublicGraphQL(SearchShelfProductsDocument, {
		variables: {
			channel,
			first: PAGE_SIZE,
			after,
			lang: getLocaleConfigByLocale(locale).graphqlLanguageCode,
			localized: !isSourceLocale(locale),
			productTypes: [...productTypes],
		},
		// Kept whole by the snapshot; a foreign page is close to a megabyte and has no place in the
		// LRU every rendered page shares (`cache-handler.mjs`).
		cache: "no-store",
	});
	if (!result.ok) {
		logUpstreamError("search-shelf", upstreamError(result), { channel, after: after ?? "start" });
		return null;
	}
	return result.data.products ?? null;
}
