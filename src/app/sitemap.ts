import { type MetadataRoute } from "next";
import { categoryUrl } from "@/config/categories";
import { getBaseUrl } from "@/lib/seo/config";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { marketHasRoute, ROUTE_POLICY } from "@/lib/route-policy";
import { cmsRouteAvailable } from "@/lib/cms/availability";
import { indexabilityOf } from "@/lib/catalog-content/publication";
import { catalogServesMarket, loadCatalogView } from "@/lib/catalog-content/resolve";
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
 * The static, indexable routes a given market actually has.
 *
 * This used to be `SK_LEGAL_MARKET` plus a hand-written `SK_ONLY_PATHS`, with a comment
 * explaining that those routes "call notFound() for any other channel". That stopped
 * being true: seven of the eight now exist in all twelve markets with approved copy, so
 * the table said `sk` while the application said otherwise, and the disagreement would
 * have shipped straight into the first foreign launch as eleven sitemaps missing their
 * legal pages.
 *
 * `route-policy.ts` is the same table the proxy 404s on, the footer links from and
 * hreflang annotates, so deriving from it is what keeps the four in step. `indexable`
 * is honoured too — `/search`, `/cart` and the garage are routes but not sitemap
 * entries.
 *
 * `/o-nas` and `/poradna` follow along on their own: they are `cms` routes and
 * `route-policy` lists them for `sk` alone until Payload holds a translated document,
 * which is the one place that decision is recorded.
 *
 * Sub-routes are deliberately NOT derived. `MARKET_ROOT_SEGMENTS` only knows the first
 * segment, so `/odstupenie-od-zmluvy/vzorovy-formular` has to be named; it is listed
 * against its parent so it can never outlive it.
 */
const STATIC_SUBROUTES: Readonly<Record<string, readonly string[]>> = {
	"odstupenie-od-zmluvy": ["/odstupenie-od-zmluvy/vzorovy-formular"],
};

/**
 * Exported for the test, which used to keep its own copy of this logic. A mirror can
 * agree with a stale version of the thing it mirrors, which is how the CMS-availability
 * step was added without a single test noticing.
 */
export async function staticPathsFor(market: string): Promise<readonly string[]> {
	const paths: string[] = [];
	const channel = CHANNEL_MAP[market]?.saleorSlug;
	for (const policy of ROUTE_POLICY) {
		if (policy.kind !== "static" && policy.kind !== "cms") continue;
		if (!policy.indexable) continue;
		if (!marketHasRoute(market, policy.segment)) continue;
		// A CMS route needs the second half too. Supporting `/o-nas` says nothing about
		// whether a document is published for this market, or whether the one that is
		// published carries a body for it — and a sitemap entry for either is an
		// invitation to crawl a 404. This is the same cached read the page and the
		// navigation perform, tagged `cms:page:<slug>`, so an unpublish reaches all
		// three at once.
		if (policy.kind === "cms") {
			if (!channel || !(await cmsRouteAvailable(channel, policy.segment))) continue;
		}
		paths.push(`/${policy.segment}`);
		paths.push(...(STATIC_SUBROUTES[policy.segment] ?? []));
	}
	return paths;
}

/** Saleor's `products` is a cursor connection; 100 is a comfortable page. */
const PAGE_SIZE = 100;

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
 * The CFM vehicle pages — `/sk/stresne-nosice/bmw/x3/g01` and its 1 473 siblings.
 *
 * Three gates, and none of them is a re-implementation. The page decides whether it may
 * be indexed in `indexabilityOf`, and the sitemap asks that same function, because a
 * sitemap that computes indexability its own way is a second opinion waiting to disagree
 * with the `robots` tag on the page it advertises.
 *
 * `indexabilityOf` requires `state === "published"`, an explicit `indexable: true`, AND
 * editorial text. That last one is why the one page CFM deliberately held back cannot
 * arrive here: `/stresne-nosice/lynk-co/01` is `indexable: true` like all 1 475 — the
 * flag was never the gate — but it is `draft` and it has no text, so it fails twice.
 *
 * ## Why a missing snapshot yields nothing rather than throwing
 *
 * Unlike the Saleor walk above, which throws so a half-read catalogue can never look
 * complete, an absent snapshot is not a truncation: with no snapshot the routes do not
 * render either, so listing zero vehicle pages is an accurate description of what this
 * deployment serves. Throwing would take the whole sitemap — products included — down
 * with a feature that is simply switched off.
 *
 * ## Why the language has to match
 *
 * The snapshot carries exactly one language. CFM published nine translations and said
 * explicitly that their existence is not permission to index them: that waits on a
 * locale-aware source, hreflang and a per-market sitemap policy. So a market is served
 * from this snapshot only when the snapshot's language IS that market's language —
 * `de-DE` takes a `de` snapshot and never an `sk` one. Until the loader is locale-aware
 * that means Slovak only, which is the intended state, not a limitation to work around.
 */
async function catalogEntriesFor(market: string): Promise<MetadataRoute.Sitemap> {
	const view = await loadCatalogView();
	if (!view.ready || !catalogServesMarket(view, market)) return [];

	const base = getBaseUrl();
	const entries: MetadataRoute.Sitemap = [];
	for (const node of view.tree.byUrlPath.values()) {
		if (!node.page || !indexabilityOf(node.page).indexable) continue;
		entries.push({
			// `urlPath` is language-agnostic and already absolute: `/stresne-nosice/bmw`.
			url: `${base}/${market}${node.page.urlPath}`,
			// No `lastModified`: the snapshot carries one timestamp for the whole export,
			// so using it would mark all 1 474 as changed together every time CFM
			// re-exports anything. Same reasoning as the category entries above.
			changeFrequency: "monthly",
			priority: 0.5,
		});
	}
	return entries;
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
			url: `${base}/${market}${categoryUrl(slug)}`,
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

	entries.push(...(await catalogEntriesFor(market)));

	// Whatever static and CMS routes this market actually has, per route-policy.
	for (const path of await staticPathsFor(market)) {
		entries.push({
			url: `${base}/${market}${path}`,
			changeFrequency: "monthly",
			priority: 0.3,
		});
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
