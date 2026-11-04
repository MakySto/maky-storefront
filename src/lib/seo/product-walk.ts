import { getLocaleConfigByLocale } from "@/config/locale";
import { SitemapProductsDocument } from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { indexableMarkets } from "@/lib/market-state";
import { isSourceLocale, resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { collectConnection, PAGE_SIZE, REVALIDATE_SECONDS, sitemapTag } from "@/lib/seo/catalogue-walk";
import { peekSnapshot, readSnapshot, warmSnapshot } from "@/lib/seo/sitemap-snapshot";

/**
 * The product walk behind the sitemap's product shards, and the snapshot it is kept in.
 *
 * Its own module so that `instrumentation.ts` can warm it at boot without loading the whole sitemap.
 * Why the result is kept in the process and not in Next's data cache: `sitemap-snapshot.ts`.
 */

export interface ProductEntry {
	slug: string;
	updatedAt: string | null;
}

const snapshotKey = (channel: string, locale: string): string => `${channel}\u0000${locale}`;

/**
 * Every product URL in one channel, in the market's OWN spelling — from the snapshot, or built once.
 *
 * Slovakia reads the base row, so its URL is `Product.slug` and the query stays two fields.
 * A foreign market's URL is the translated slug CFM allocates, and the product only exists
 * there when the exact-locale boundary accepts it — the same boundary the PDP, the listing
 * and the offers use. Anything it refuses is dropped here rather than published as a URL that
 * answers with the not-found body.
 *
 * Throws when the catalogue cannot be read in full and nothing complete is kept: an error, never
 * a short list. One walk per channel and language at a time, in this process — a second caller,
 * a crawler asking while the deploy's own check is still waiting, joins the walk already running.
 */
export function fetchProductSlugs(channel: string, locale: string): Promise<ProductEntry[]> {
	return readSnapshot(snapshotKey(channel, locale), channel, () => walkProductSlugs(channel, locale));
}

/** The kept list if there is one — no walk. The index counts from it when it can. */
export function peekProductSlugs(channel: string, locale: string): ProductEntry[] | undefined {
	return peekSnapshot(snapshotKey(channel, locale), channel, () => walkProductSlugs(channel, locale));
}

/**
 * Have every live market's list built before the first crawler asks.
 *
 * Two walks at a time (`MAX_BACKGROUND_BUILDS`), the default market first, so a restart costs Saleor
 * about a minute of two connections instead of twelve at once when the deploy's check and the crawlers
 * arrive together. Never rejects: a market that could not be built is built by the request that needs it.
 */
export async function prewarmProductWalks(): Promise<void> {
	const started = Date.now();
	const markets = indexableMarkets().filter((market) => CHANNEL_MAP[market]);
	const results = await Promise.all(
		markets.map((market) => {
			const { saleorSlug: channel, locale } = CHANNEL_MAP[market]!;
			return warmSnapshot(snapshotKey(channel, locale), channel, () => walkProductSlugs(channel, locale));
		}),
	);
	const built = results.filter(Boolean).length;
	console.log(
		`[sitemap] warm-up: ${built} of ${markets.length} product lists built in ${Math.round(
			(Date.now() - started) / 1000,
		)} s`,
	);
}

async function walkProductSlugs(channel: string, locale: string): Promise<ProductEntry[]> {
	const localized = !isSourceLocale(locale);
	const nodes = await collectConnection(`${channel}: product`, (after) =>
		fetchProductPage(channel, locale, after),
	);

	if (!localized) {
		return nodes
			.filter((node) => Boolean(node.slug))
			.map((node) => ({ slug: node.slug, updatedAt: node.updatedAt ?? null }));
	}

	const entries = localizedEntries(nodes, locale);
	const dropped = nodes.length - entries.length;
	if (dropped > 0) {
		console.log(
			`[sitemap] ${channel}: ${dropped} of ${nodes.length} products are not translated for ${
				getLocaleConfigByLocale(locale).graphqlLanguageCode
			}`,
		);
	}
	return entries;
}

type ProductNode = NonNullable<Awaited<ReturnType<typeof fetchProductPage>>>["edges"][number]["node"];

/**
 * One page of a channel's product walk.
 *
 * The WALK reads past Next's data cache (`no-store`): its result is kept whole by the snapshot, and a
 * foreign market's page is 0.5 to 1 MB, which the memory-only fetch cache held in the LRU every page
 * render shares. The INDEX's first-page look (`cached`, with a deadline) keeps the tag and the hour: it
 * is one page per market, read only while no snapshot exists, and `/api/revalidate` can still expire it.
 */
export async function fetchProductPage(
	channel: string,
	locale: string,
	after: string | null,
	options: { readonly deadlineMs?: number; readonly cached?: boolean } = {},
) {
	const localized = !isSourceLocale(locale);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const result = await executePublicGraphQL(SitemapProductsDocument, {
		variables: { channel, first: PAGE_SIZE, after, lang, localized },
		...(options.cached
			? { revalidate: REVALIDATE_SECONDS, tags: [sitemapTag(channel)] }
			: { cache: "no-store" as const }),
		// A bounded single attempt, for the index's look at the first page.
		...(options.deadlineMs ? { retry: false, signal: AbortSignal.timeout(options.deadlineMs) } : {}),
	});
	if (!result.ok) {
		logUpstreamError("sitemap-products", upstreamError(result), {
			channel,
			after: after ?? "start",
		});
		return null;
	}
	return result.data.products ?? null;
}

/** The products the exact-locale boundary accepts in this language, at their translated slug. */
export function localizedEntries(nodes: readonly ProductNode[], locale: string): ProductEntry[] {
	const entries: ProductEntry[] = [];
	for (const node of nodes) {
		const localizedNode = resolveExactLocaleProduct(node, locale);
		if (!localizedNode?.slug) continue;
		entries.push({ slug: localizedNode.slug, updatedAt: node.updatedAt ?? null });
	}
	return entries;
}
