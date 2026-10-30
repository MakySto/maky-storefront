/**
 * The two slugs of the Nordrive Kargo category, in a module with no imports on purpose: `fitment-shelves.ts` and
 * `quote-only.ts` use them as object keys while their module loads, and `category-routes.ts` sits in an import cycle
 * with them (via `categories.ts`). Held in `category-routes.ts` they were read before they were initialised and the
 * production build failed with "Cannot access … before initialization"; the test runner does not show it.
 */

/**
 * The slug the category had until 2026-10-30 (live on the Slovak shop for one night, 23:14 UTC on the 29th) and
 * the one it has since. Both are kept while Saleor and the shop catch up with each other (`KARGO_CATEGORY_SLUGS`).
 */
export const KARGO_BASE_SLUG = "kargo-stresne-nosice-a-stresne-kose-na-dodavky";
export const KARGO_PREVIOUS_SLUG = "stresne-nosice-a-kose-na-dodavky";
/** What a product's category can be called while the rename is under way; never one without the other. */
export const KARGO_CATEGORY_SLUGS: readonly string[] = [KARGO_BASE_SLUG, KARGO_PREVIOUS_SLUG];
