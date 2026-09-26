import { SitemapCategoriesDocument } from "@/gql/graphql";
import { getLocaleConfigByLocale } from "@/config/locale";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { isSourceLocale, resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";

/**
 * The Saleor catalogue walks the sitemap is built from, and the one the storefront's own
 * navigation shares with it (`fetchStockedCategorySlugs`).
 *
 * Separate from `sitemap.ts` so the navigation can ask the sitemap's question without importing
 * the sitemap — which itself imports the navigation's CMS availability rule.
 */

/** Saleor's `products` is a cursor connection; 100 is a comfortable page. */
export const PAGE_SIZE = 100;

/** Re-read the catalogue at most hourly; a sitemap is not a live view. */
export const REVALIDATE_SECONDS = 3600;

/** The data-cache tag every Saleor read behind one channel's shards carries. */
export function sitemapTag(channel: string): string {
	return buildTag(CACHE_PROFILES.sitemap, { channel, locale: "" });
}

export interface Page<T> {
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
export class SitemapIncompleteError extends Error {}

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
export async function collectConnection<T>(
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

/**
 * The base slugs of the categories that are a real, stocked page in this channel: holding at
 * least one product here and — abroad — translated in full for the market's language.
 *
 * The ONE definition of "this market offers the category". The sitemap lists exactly these,
 * and the storefront's own promotion — the menus, the footer, the homepage tiles and texts —
 * asks the same question through `lib/market-assortment.ts`, so a shelf is never linked from
 * the page while the sitemap leaves it out, or the reverse. Stock does not enter into it: a
 * product that can be ordered is in the count whether or not it is on the shelf today.
 *
 * Throws when the catalogue cannot be read in full. A caller that must not wait on Saleor
 * passes `deadlineMs`: one attempt, cut off at that time, instead of the retry ladder.
 */
export async function fetchStockedCategorySlugs(
	channel: string,
	locale: string,
	options: { readonly deadlineMs?: number } = {},
): Promise<string[]> {
	const localized = !isSourceLocale(locale);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	const nodes = await collectConnection(`${channel}: category`, async (after) => {
		const result = await executePublicGraphQL(SitemapCategoriesDocument, {
			variables: { channel, first: PAGE_SIZE, after, lang, localized },
			revalidate: REVALIDATE_SECONDS,
			tags: [sitemapTag(channel)],
			...(options.deadlineMs ? { retry: false, signal: AbortSignal.timeout(options.deadlineMs) } : {}),
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
	//
	// Abroad it must also BE a page in that market: the category's own translation carries
	// the four fields the boundary requires, or the page is not-found there. The base slug is
	// what comes back either way — `categoryUrlFor` turns it into the market's segment.
	return nodes
		.filter((node) => (node.products?.totalCount ?? 0) > 0)
		.filter((node) => !localized || resolveExactLocaleCategory(node, locale) !== null)
		.map((node) => node.slug);
}
