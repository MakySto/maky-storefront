/**
 * Storefront category catalogue — the single source of truth for which categories
 * the storefront links to, what their Saleor slug is, and where they are surfaced.
 *
 * ## Why this file exists
 *
 * The slug used to be typed by hand in two places. The homepage grid pointed at
 * `nosice-lyz` and the header nav at `nosice-lyzi`, and only the second one is a
 * category in Saleor. Because a category page renders at HTTP 200 whether or not
 * the category resolves (streaming/PPR cannot set a 404 after the shell flushes),
 * the broken tile answered 200 with a "Stránka nenájdená" body — invisible to every
 * status-code check, visible to every customer who clicked "Nosiče lyží" on the
 * homepage. One slug, written once, is the fix; `categories.test.ts` and
 * `pnpm check:nav` are the guards.
 *
 * ## Surfacing rules
 *
 * `surfaces: []` means the category is known and reachable by URL but is NOT linked
 * from the homepage or the menu. That is a deliberate state, not a leftover: a tile
 * that leads to an empty listing is the "empty section" CLAUDE.md §6 forbids, and
 * the category page itself already answers `noindex, follow` while it holds nothing.
 * Give a category products in Saleor, add its surface here, done — no other file.
 */

export type CategorySurface = "nav" | "home";

export interface StorefrontCategory {
	/** Saleor category slug. `pnpm check:nav` asserts it resolves and is non-empty. */
	readonly slug: string;
	/** Key in the `nav` i18n namespace. Present in all 12 locale files. */
	readonly key: string;
	/** Where this category is linked from. Empty = defined, not surfaced. */
	readonly surfaces: readonly CategorySurface[];
	/** Why a category is not surfaced. Required when `surfaces` is empty. */
	readonly withheldReason?: string;
}

/**
 * Order is display order: the nav renders its subset in this order, the homepage
 * grid renders its own subset in this order.
 */
export const STOREFRONT_CATEGORIES: readonly StorefrontCategory[] = [
	{ slug: "stresne-nosice", key: "roofRacks", surfaces: ["nav", "home"] },
	{ slug: "stresne-boxy", key: "roofBoxes", surfaces: ["nav", "home"] },
	{ slug: "nosice-bicyklov", key: "bikeCarriers", surfaces: ["nav", "home"] },
	{ slug: "nosice-lyzi", key: "skiCarriers", surfaces: ["nav", "home"] },
	{ slug: "stresne-stany", key: "roofTents", surfaces: ["home"] },
	{ slug: "autochladnicky", key: "carFridges", surfaces: ["home"] },
	{
		slug: "snehove-retaze",
		key: "snowChains",
		surfaces: [],
		withheldReason: "0 products in sk-eur — the tile would lead to an empty listing",
	},
	{
		slug: "tazne-zariadenia",
		key: "towBars",
		surfaces: [],
		withheldReason:
			"CLAUDE.md §6: towbars stay off the homepage until the business model and " +
			"the installation partner are confirmed. Also 0 products in sk-eur.",
	},
];

/** Categories linked from `surface`, in display order. */
export function categoriesFor(surface: CategorySurface): readonly StorefrontCategory[] {
	return STOREFRONT_CATEGORIES.filter((category) => category.surfaces.includes(surface));
}

/** Channel-relative href for a category. The channel prefix is added at render time. */
export function categoryHref(category: StorefrontCategory): string {
	return `/categories/${category.slug}`;
}
