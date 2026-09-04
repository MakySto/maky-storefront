/** Why a listing came back with nothing to show. */
type ListingEmptyReason =
	/** Filters are active and excluded everything. The only actionable case. */
	| "filtered-out"
	/** This market genuinely has nothing here. */
	| "empty"
	/** There is stock, but none of it carries content for this locale. */
	| "untranslated";

interface ListingEmptyInput {
	/** From the connection, AFTER any server-side filter. */
	totalCount: number;
	/** Rows this page lost to locale eligibility. */
	localeDropped: number;
	hasActiveFilters: boolean;
}

/**
 * The branch order here is the whole point, so it lives in a pure function with
 * a test rather than inside JSX.
 *
 * `totalCount` is read off the FILTERED connection —
 * `products(filter: $filter) { totalCount }` — so an active filter that matches
 * nothing reports `0` for a category that is not remotely empty. Verified on
 * live Saleor: `stresne-boxy` reports 101 unfiltered and 0 under
 * `price: {gte: 99999}`. Checking emptiness before filters would therefore tell
 * a visitor a well-stocked category is empty, which is how the original
 * one-size-fits-all message got it wrong in the other direction.
 */
export function listingEmptyReason({
	totalCount,
	localeDropped,
	hasActiveFilters,
}: ListingEmptyInput): ListingEmptyReason {
	if (hasActiveFilters) return "filtered-out";
	if (totalCount > 0 && localeDropped > 0) return "untranslated";
	return "empty";
}
