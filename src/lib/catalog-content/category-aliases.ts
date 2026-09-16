import { LOCALIZED_CATEGORIES, mappedCategoryFor } from "@/config/category-routes";
import { catalogLanguageForMarket } from "./language";
import { isBorrowedCatalogPath } from "./borrowed-routes";
import { catalogRedirectTarget } from "./redirects";

/**
 * Where a category URL spelled the other way lives, or `null` when it is already canonical.
 *
 * Two spellings reach the same page in a foreign market, and only one of them may answer:
 *
 *   `/cz/stresne-nosice/skoda/octavia`   the Slovak root, which every link used to build
 *   `/cz/stresni-nosice/skoda/octavia`   the Czech root CFM publishes the page under
 *
 * The first is answered with a 301 to the second — except for the pages the Czech catalogue
 * itself still publishes under the Slovak root (`borrowed-routes.json`), which are real there.
 * For those the reverse holds, and the Czech spelling is what gets redirected.
 *
 * `rest` is the normalized path after the market, split into segments. The result is
 * market-relative. A target that is itself a retired page is resolved through the redirect
 * table first, so nothing is sent through two hops.
 *
 * Slovakia never aliases: its segment IS the base slug. And a segment from another language
 * (`/cz/dachtraeger`) is not recognised at all — that is not a URL this market has.
 */
export function categoryAliasTarget(market: string, rest: readonly string[]): string | null {
	const language = catalogLanguageForMarket(market);
	if (!language || rest.length === 0) return null;

	const first = rest[0]!;
	const category = mappedCategoryFor(market, first);
	if (!category || category.placement !== "root") return null;

	const segment = category.segments[language as keyof typeof category.segments];
	if (!segment || segment === category.baseSlug) return null;

	const tail = rest.slice(1);
	const basePath = "/" + [category.baseSlug, ...tail].join("/");
	const localizedPath = "/" + [segment, ...tail].join("/");

	if (first === category.baseSlug) {
		if (isBorrowedCatalogPath(market, basePath)) return null;
		return catalogRedirectTarget(market, localizedPath) ?? localizedPath;
	}

	// The market's own spelling. Canonical, unless this exact page is one the catalogue
	// still publishes under the Slovak root.
	return tail.length > 0 && isBorrowedCatalogPath(market, basePath) ? basePath : null;
}

/**
 * The canonical `/categories/{segment}` for a LISTING category spelled the other way.
 *
 * `/cz/categories/nordrive-stresne-nosice` → the Czech spelling, still under `/categories/`. Root
 * categories are handled by the retired-category-URL redirect instead, which already sends
 * `/categories/{slug}` to the root.
 */
export function listingCategoryAliasTarget(market: string, segment: string): string | null {
	const language = catalogLanguageForMarket(market);
	const category = mappedCategoryFor(market, segment);
	if (!language || !category || category.placement !== "listing") return null;
	const canonical = category.segments[language as keyof typeof category.segments];
	return canonical && canonical !== segment ? `/categories/${canonical}` : null;
}

/** Every mapped root segment in every language, for tests and the acceptance check. */
export const MAPPED_ROOT_CATEGORIES = LOCALIZED_CATEGORIES.filter(
	(category) => category.placement === "root",
);
