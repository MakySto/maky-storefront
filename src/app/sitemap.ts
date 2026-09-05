import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { executePublicGraphQL } from "@/lib/graphql";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { SitemapProductsDocument, SitemapCategoriesDocument } from "@/gql/graphql";

/**
 * The sitemap used to advertise 32 URLs: eleven market homepages, their
 * /products, and the Slovak legal pages. Zero of the 453 products and zero
 * categories — and eleven of those markets had an empty catalogue, verified
 * against the API rather than assumed.
 *
 * A sitemap is a list of preferred canonical URLs, and empty storefronts are
 * thin content, so it then listed only `sk`. That hardcoded "sk is the only
 * stocked market", which is about to stop being true: the market list now comes
 * from `liveMarkets()`, so a market is advertised exactly when it is live.
 */

/**
 * The market whose Slovak-only static routes exist. They call notFound() for
 * every other channel, so they belong to `sk` alone until each market has its
 * own translated set.
 */
const SK_LEGAL_MARKET = "sk";

/** Saleor's `products` is a cursor connection; 100 is a comfortable page. */
const PAGE_SIZE = 100;

const SK_ONLY_PATHS = [
	"/obchodne-podmienky",
	"/reklamacie-a-vratenie",
	"/odstupenie-od-zmluvy",
	"/ochrana-osobnych-udajov",
	"/cookies",
	"/doprava-a-platba",
	"/kontakt",
	"/o-nas",
	// Held back until the Payload document existed, per the note in
	// poradna/page.tsx: a sitemap entry for a page serving only its own fallback
	// advertises nothing. That document is published — /sk/poradna answers 200
	// with "Ako vybrať strešný nosič" — so the condition it named is met, and the
	// page was otherwise live, indexable and orphaned from the sitemap.
	"/poradna",
];

/** Re-read the catalogue at most hourly; a sitemap is not a live view. */
export const revalidate = 3600;

interface ProductEntry {
	slug: string;
	updatedAt: string | null;
}

interface Page<T> {
	edges: readonly { node: T }[];
	pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

/**
 * Raised when the catalogue could not be enumerated in full.
 *
 * A short sitemap is indistinguishable from a complete one, and Google reads the
 * difference as "these URLs are gone". This turns silent truncation into a
 * visible failure — see the note on `sitemap()` for why that is the safer of the
 * two.
 */
class SitemapIncompleteError extends Error {}

/**
 * Walk a Saleor cursor connection to its end, or fail loudly.
 *
 * There is deliberately NO page ceiling. There used to be one — MAX_PAGES = 20,
 * sized against a 458-product catalogue — and it was a truncation waiting for a
 * bigger catalogue to arrive. 9 192 Slovak products at 100 a page is 92, so the
 * cap would have thrown on every single build the moment they were published.
 *
 * What replaces it is a guard on the thing the cap was actually defending
 * against: a connection that never terminates. `hasNextPage` ends the loop; a
 * cursor that repeats or fails to advance ends it with an error. Those are the
 * only two ways out, and the second one is loud on purpose.
 *
 * Shared by products and categories because the guarantee has to be the same for
 * both. It previously was not: the product walk had all of this and the category
 * walk was a bare `first: 100` with no `pageInfo` selected at all, so it could
 * not even detect that it had truncated. Thirty categories exist today, so that
 * was latent rather than live — which is precisely the shape of the product cap
 * it replaced.
 */
async function collectConnection<T>(
	label: string,
	fetchPage: (after: string | null) => Promise<Page<T> | null>,
): Promise<T[]> {
	const out: T[] = [];
	let after: string | null = null;
	// Every cursor already followed. Saleor's are opaque, so the only thing that
	// can be said about one is whether it has been seen before — which is exactly
	// the question. A repeat means the connection is cycling, and without this the
	// loop would spin forever building an ever-growing array.
	const seen = new Set<string>();

	for (let page = 1; ; page++) {
		const connection = await fetchPage(after);
		// `null` here is any failure at all — transport, HTTP, GraphQL — because
		// the fetchers collapse them. Previously this `break` returned whatever had
		// been collected so far: one blip on page 3 of 5 silently dropped ~200
		// products with no error anywhere.
		if (!connection) {
			throw new SitemapIncompleteError(`${label} page ${page} did not resolve`);
		}

		for (const edge of connection.edges) out.push(edge.node);

		if (!connection.pageInfo.hasNextPage) return out;

		const next: string | null = connection.pageInfo.endCursor ?? null;
		if (!next) {
			throw new SitemapIncompleteError(`${label}: hasNextPage with no cursor`);
		}
		if (next === after) {
			throw new SitemapIncompleteError(
				`${label}: cursor did not advance past ${next} on page ${page} (${out.length} so far)`,
			);
		}
		if (seen.has(next)) {
			throw new SitemapIncompleteError(
				`${label}: cursor ${next} repeated on page ${page} (${out.length} so far)`,
			);
		}

		seen.add(next);
		after = next;
	}
}

/** Every product slug in one channel, paginated to the end of the connection. */
async function fetchProductSlugs(channel: string): Promise<ProductEntry[]> {
	const nodes = await collectConnection(`${channel}: product`, async (after) => {
		const result = await executePublicGraphQL(SitemapProductsDocument, {
			variables: { channel, first: PAGE_SIZE, after },
			revalidate,
		});
		if (!result.ok) {
			logUpstreamError("sitemap-products", upstreamError(result), {
				channel,
				after: after ?? "start",
			});
			return null;
		}
		return result.data.products ?? null;
	});

	return nodes
		.filter((node) => Boolean(node.slug))
		.map((node) => ({ slug: node.slug, updatedAt: node.updatedAt ?? null }));
}

async function fetchStockedCategorySlugs(channel: string): Promise<string[]> {
	const nodes = await collectConnection(`${channel}: category`, async (after) => {
		const result = await executePublicGraphQL(SitemapCategoriesDocument, {
			variables: { channel, first: PAGE_SIZE, after },
			revalidate,
		});
		if (!result.ok) {
			logUpstreamError("sitemap-categories", upstreamError(result), {
				channel,
				after: after ?? "start",
			});
			return null;
		}
		return result.data.categories ?? null;
	});

	// Categories exist globally in Saleor but hold products per channel, so an
	// empty one is real everywhere and stocked nowhere. Listing it would advertise
	// an empty page; on the live Slovak catalogue eleven of the thirty are in that
	// state, including `stresne-nosice`, which sits first in the main navigation.
	return nodes.filter((node) => (node.products?.totalCount ?? 0) > 0).map((node) => node.slug);
}

/**
 * One market's entries. Throws if the catalogue could not be read in full.
 */
async function marketEntries(market: string): Promise<MetadataRoute.Sitemap> {
	const base = getBaseUrl();
	const channel = CHANNEL_MAP[market].saleorSlug;

	const [products, categories] = await Promise.all([
		fetchProductSlugs(channel),
		fetchStockedCategorySlugs(channel),
	]);

	// No `lastModified` on these. It is a claim about when the content last
	// changed, and the only timestamp available here is the moment this file ran —
	// which would mark every URL as freshly modified on every build and export,
	// including the ones nobody has touched in months. Google treats a lastmod it
	// finds unreliable as noise for the whole site, so omitting it is strictly
	// better than asserting the build time. Products keep theirs because Saleor
	// gives a real one.
	const entries: MetadataRoute.Sitemap = [
		{ url: `${base}/${market}`, changeFrequency: "daily", priority: 1.0 },
		{ url: `${base}/${market}/products`, changeFrequency: "daily", priority: 0.8 },
	];

	for (const slug of categories) {
		entries.push({
			url: `${base}/${market}/categories/${slug}`,
			changeFrequency: "weekly",
			priority: 0.7,
		});
	}

	for (const product of products) {
		entries.push({
			// Root-level product URL. /{market}/products/{slug} has 308'd here since
			// 62657e7 and the canonical points at this form.
			url: `${base}/${market}/${product.slug}`,
			// Saleor's own timestamp, or nothing — never the build time.
			...(product.updatedAt ? { lastModified: new Date(product.updatedAt) } : {}),
			changeFrequency: "weekly",
			priority: 0.6,
		});
	}

	// Slovak-only by construction: these routes call notFound() for any other
	// channel. They join a market's sitemap when that market has its own
	// translated legal pages, which is a launch-checklist item, not a code one.
	if (market === SK_LEGAL_MARKET) {
		for (const path of SK_ONLY_PATHS) {
			entries.push({
				url: `${base}/${market}${path}`,
				changeFrequency: "monthly",
				priority: 0.3,
			});
		}
	}

	return entries;
}

/**
 * The sitemap covers every LIVE market — see `src/lib/market-state.ts`.
 *
 * It used to hardcode `sk`, which was true and is about to stop being true. A
 * market appears here the moment it goes live and not before, so a preview
 * market is never advertised to a crawler.
 *
 * On failure this now throws rather than serving what it managed to collect.
 * That is deliberate and it reverses the previous comment. Google keeps the last
 * successfully fetched sitemap when a fetch errors, and reports the error in
 * Search Console; a 200 carrying a short list is accepted as the truth and reads
 * as "the missing URLs are gone". A visible 500 for one hour is recoverable, a
 * silent deindexing signal is not.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const markets = liveMarkets();

	const perMarket = await Promise.all(markets.map((market) => marketEntries(market)));

	return perMarket.flat();
}
