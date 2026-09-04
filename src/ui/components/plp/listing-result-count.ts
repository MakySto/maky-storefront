interface ListingResultCountInput {
	/** Rows this listing reports for the current server query, after server-side filters. */
	totalCount: number;
	/** How many cards are actually on screen after client-side filtering. */
	renderedCount: number;
	/** Rows this page lost to locale eligibility. */
	localeDropped: number;
	/** Colours/sizes — the filters applied in the browser, to THIS page only. */
	hasClientSideFilters: boolean;
}

/**
 * What "{count} produktov" is allowed to say.
 *
 * The filter bar used to be handed `filteredProducts.length`, which is the page
 * size. Live on production that read "12 produktov" on
 * /sk/categories/stresne-boxy, a category holding 101, and "12 produktov" on
 * /sk/products, where the store holds 414. Presented next to a filter bar, that
 * is not a page indicator — it is a claim about how much this shop sells.
 *
 * `totalCount` is the honest number whenever it describes the same set the
 * visitor is looking at. Two things break that:
 *
 *   - Colour and size filters run in the browser against the current page only
 *     (`filterProducts`), so upstream has never heard of them and its total
 *     still counts rows the visitor cannot see.
 *   - Locale eligibility drops rows after Saleor counted them, so on a foreign
 *     market the upstream total is larger than anything we will ever render.
 *
 * In both cases fall back to what is actually on screen, which is the same rule
 * `src/lib/search/saleor-provider.ts` already applies to its own pagination
 * total.
 */
export function listingResultCount({
	totalCount,
	renderedCount,
	localeDropped,
	hasClientSideFilters,
}: ListingResultCountInput): number {
	if (hasClientSideFilters || localeDropped > 0) return renderedCount;
	return totalCount;
}
