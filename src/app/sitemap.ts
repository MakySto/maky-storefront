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
 * The market whose Slovak legal pages exist. The seven routes below call
 * notFound() for every other channel, so they belong to `sk` alone until each
 * market has its own translated set.
 */
const SK_LEGAL_MARKET = "sk";

/** Saleor's `products` is a cursor connection; 100 is a comfortable page. */
const PAGE_SIZE = 100;

/** Backstop against an unbounded loop if the API ever misreports `hasNextPage`. */
const MAX_PAGES = 20;

const SK_ONLY_PATHS = [
	"/obchodne-podmienky",
	"/reklamacie-a-vratenie",
	"/odstupenie-od-zmluvy",
	"/ochrana-osobnych-udajov",
	"/cookies",
	"/doprava-a-platba",
	"/kontakt",
	"/o-nas",
];

/** Re-read the catalogue at most hourly; a sitemap is not a live view. */
export const revalidate = 3600;

interface ProductEntry {
	slug: string;
	updatedAt: string | null;
}

/**
 * One page of the connection. Split out on purpose: with the cursor as a
 * parameter TypeScript has a declared type for it, whereas reassigning a local
 * cursor from the query result inside the loop makes the result's own inference
 * circular (TS7022).
 */
async function fetchProductPage(channel: string, after: string | null) {
	const result = await executePublicGraphQL(SitemapProductsDocument, {
		variables: { channel, first: PAGE_SIZE, after },
		revalidate,
	});
	if (!result.ok) {
		// Distinguished only for the log line: both arms are fatal here, because a
		// sitemap that is short is worse than one that is missing.
		logUpstreamError("sitemap-products", upstreamError(result), { channel, after: after ?? "start" });
		return null;
	}
	return result.data.products ?? null;
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

async function fetchProductSlugs(channel: string): Promise<ProductEntry[]> {
	const out: ProductEntry[] = [];
	let after: string | null = null;

	for (let page = 0; page < MAX_PAGES; page++) {
		const connection = await fetchProductPage(channel, after);
		// `null` here is any failure at all — transport, HTTP, GraphQL — because
		// fetchProductPage collapses them. Previously this `break` returned
		// whatever had been collected so far: one blip on page 3 of 5 silently
		// dropped ~200 products with no error anywhere.
		if (!connection) {
			throw new SitemapIncompleteError(`${channel}: product page ${page + 1} did not resolve`);
		}

		for (const edge of connection.edges) {
			if (edge.node.slug) {
				out.push({ slug: edge.node.slug, updatedAt: edge.node.updatedAt ?? null });
			}
		}

		if (!connection.pageInfo.hasNextPage) return out;
		after = connection.pageInfo.endCursor ?? null;
		if (!after) {
			throw new SitemapIncompleteError(`${channel}: hasNextPage with no cursor`);
		}
	}

	// Ran out of pages with more still to come. 458 products at 100 a page is 5;
	// hitting 20 means either the catalogue grew tenfold or hasNextPage is lying.
	throw new SitemapIncompleteError(`${channel}: more than ${MAX_PAGES} pages`);
}

async function fetchStockedCategorySlugs(channel: string): Promise<string[]> {
	const result = await executePublicGraphQL(SitemapCategoriesDocument, {
		variables: { channel, first: 100 },
		revalidate,
	});
	if (!result.ok) {
		logUpstreamError("sitemap-categories", upstreamError(result), { channel });
		throw new SitemapIncompleteError(`${channel}: categories did not resolve — ${result.error.message}`);
	}
	if (!result.data.categories) {
		throw new SitemapIncompleteError(`${channel}: categories connection was absent`);
	}

	// Categories exist globally in Saleor but hold products per channel, so an
	// empty one is real everywhere and stocked nowhere. Listing it would advertise
	// an empty page; twelve of the thirty are currently in that state.
	return result.data.categories.edges
		.filter((edge) => (edge.node.products?.totalCount ?? 0) > 0)
		.map((edge) => edge.node.slug);
}

/**
 * One market's entries. Throws if the catalogue could not be read in full.
 */
async function marketEntries(market: string, now: Date): Promise<MetadataRoute.Sitemap> {
	const base = getBaseUrl();
	const channel = CHANNEL_MAP[market].saleorSlug;

	const [products, categories] = await Promise.all([
		fetchProductSlugs(channel),
		fetchStockedCategorySlugs(channel),
	]);

	const entries: MetadataRoute.Sitemap = [
		{ url: `${base}/${market}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
		{ url: `${base}/${market}/products`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
	];

	for (const slug of categories) {
		entries.push({
			url: `${base}/${market}/categories/${slug}`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.7,
		});
	}

	for (const product of products) {
		entries.push({
			// Root-level product URL. /{market}/products/{slug} has 308'd here since
			// 62657e7 and the canonical points at this form.
			url: `${base}/${market}/${product.slug}`,
			lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
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
				lastModified: now,
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
	const now = new Date();
	const markets = liveMarkets();

	const perMarket = await Promise.all(markets.map((market) => marketEntries(market, now)));

	return perMarket.flat();
}
