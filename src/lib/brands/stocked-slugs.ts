/**
 * The makers each channel sells, as the running server last counted them, where the proxy can read them.
 *
 * `/{market}/znacky/{maker}` for a maker the market does not sell answered HTTP 200 with an empty
 * heading (audit of the live store, 2026-11-27, D7): the page asks `getBrand` inside a Suspense
 * boundary, and by then the status line is sent. It carried `noindex`, so no search engine kept it,
 * but a person or a link checker was told the page exists. Only the proxy can still say 404
 * (CLAUDE.md §11, the same reason the product gate lives there), and the proxy must not count makers
 * itself: that is twenty-odd queries per market (`catalog.ts`).
 *
 * So `catalog.ts` publishes each list it has counted here, on `globalThis` for the reason
 * `LIVE_CATEGORY_SLUGS_KEY` is there: the proxy is one bundle and the pages another, each with its
 * own copy of every module, and under `next start` they share one process. The proxy only reads.
 *
 * Unknown is not absent. Before the first count of a channel (a fresh process, a Saleor that did not
 * answer) there is no list, and the question below answers `false`: the page renders as it did.
 */
const STOCKED_BRANDS_KEY: unique symbol = Symbol.for("maky.brands.stocked.v1");

type Shared = typeof globalThis & { [STOCKED_BRANDS_KEY]?: Map<string, ReadonlySet<string>> };

/** Called by `catalog.ts` with every list Saleor has just counted for a channel. */
export function publishStockedBrands(channel: string, slugs: Iterable<string>): void {
	const shared = globalThis as Shared;
	(shared[STOCKED_BRANDS_KEY] ??= new Map()).set(channel, new Set(slugs));
}

/**
 * Whether this process KNOWS that the channel sells nothing of this maker: the channel's list has
 * been counted and the slug is not in it. `false` whenever the list is not known.
 */
export function isKnownAbsentBrand(channel: string, slug: string): boolean {
	const list = (globalThis as Shared)[STOCKED_BRANDS_KEY]?.get(channel);
	return list !== undefined && !list.has(slug);
}

/** For tests. */
export function __forgetStockedBrands(): void {
	delete (globalThis as Shared)[STOCKED_BRANDS_KEY];
}
