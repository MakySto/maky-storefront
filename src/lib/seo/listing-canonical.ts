/**
 * The canonical address of one page of a listing (a category, a brand).
 *
 * Every page of a listing used to name the first page as its canonical. Google's guidance for paginated
 * listings is the opposite ("Don't use the first page of a paginated sequence as the canonical page",
 * "give each page its own canonical URL"): a page that points at another is read as a copy of it, and
 * the products it links to are left to the sitemap alone. Measured 2026-11-15: a category's first page
 * links 12 products, and page 2 pointed back at page 1.
 *
 * So a page reached by "next" is its own canonical, in exactly the form the pagination links have
 * (`?cursor=…&direction=next`). Everything else still points at the bare address:
 *
 * - a narrowed or re-ordered list (`sort`, `price`, `brand`, `vehicle`, `tyreSize`, …): the same
 *   products in another selection, never a page of its own;
 * - a page reached by "previous": it shows what a "next" page already shows under another address, and
 *   one of the two has to be the copy.
 *
 * One exception: a selection that has a page of its own. The snow-chain shelf narrowed by a tyre size
 * shows what that size's page shows (`/snehove-retaze/205-60-r16`), so that page is its canonical, on
 * any page of the list and in any order. The caller says which page it is (`ownPage`,
 * `tyreListingCanonicalPath`); this is still the one place that decides where a listing's canonical goes.
 */
const NARROWING_PARAMS = [
	"sort",
	"price",
	"colors",
	"sizes",
	"vehicle",
	"tyres",
	"tyreSize",
	"brand",
	"volume",
] as const;

export type ListingSearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The cursor of a page reached by "next" on an otherwise untouched listing, or `null`. */
export function forwardPageCursor(searchParams: ListingSearchParams): string | null {
	const cursor = searchParams.cursor;
	if (typeof cursor !== "string" || cursor === "") return null;
	if (searchParams.direction === "prev") return null;
	if (NARROWING_PARAMS.some((key) => searchParams[key] !== undefined)) return null;
	return cursor;
}

/**
 * `canonical` for the first page and for every variant of it; the page's own address for a later page;
 * `ownPage`, when the selection the address makes has a page of its own.
 */
export function listingCanonical(
	canonical: string,
	searchParams: ListingSearchParams,
	ownPage?: string | null,
): string {
	if (ownPage) return ownPage;
	const cursor = forwardPageCursor(searchParams);
	if (cursor === null) return canonical;
	// URLSearchParams, as `Pagination` builds its links: the canonical is the address that was followed.
	return `${canonical}?${new URLSearchParams({ cursor, direction: "next" }).toString()}`;
}
