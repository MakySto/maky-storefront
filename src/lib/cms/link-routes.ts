/**
 * Root-level routes a populated Payload Page relationship can actually reach today.
 *
 * Unknown slugs must not be emitted blindly: the root `[productSlug]` catch-all would
 * accept them and answer with the product-not-found experience, which is not a CMS Page
 * route. Keep this registry next to the CMS reader so adding a new editorial route and
 * making it linkable is one explicit change.
 */
const ROUTABLE_PAGE_SLUGS: ReadonlySet<string> = new Set([
	"cookies",
	"doprava-a-platba",
	"kontakt",
	"o-nas",
	"obchodne-podmienky",
	"ochrana-osobnych-udajov",
	"odstupenie-od-zmluvy",
	"poradna",
	"reklamacie-a-vratenie",
]);

export type CmsRelationshipCollection = "pages" | "posts";

/**
 * Storefront path for a populated CMS relationship, without the market prefix.
 *
 * Posts deliberately return `null`. V2 describes their relationship wire shape, but the
 * storefront has no Post route and the provider pack contains no direct-Post read
 * contract from which one could be implemented safely. The renderer therefore keeps the
 * published label as non-interactive text and logs the missing route; it never guesses a
 * path that could collide with the product catch-all.
 */
export function cmsPathForRelationship(collection: CmsRelationshipCollection, slug: string): string | null {
	if (collection === "posts") return null;
	return ROUTABLE_PAGE_SLUGS.has(slug) ? `/${slug}` : null;
}

export function isRoutableCmsPageSlug(slug: string): boolean {
	return ROUTABLE_PAGE_SLUGS.has(slug);
}
