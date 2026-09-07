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

/**
 * The internal route segment the category page still lives under in `src/app`.
 *
 * Public category URLs are root-level (`/sk/stresne-nosice`), but the page file stays
 * at `app/[channel]/(main)/categories/[slug]`. `src/proxy.ts` rewrites the public URL
 * onto this path; nothing outside the proxy should build a URL with it.
 *
 * Moving the file to a root-level dynamic segment was the alternative, and it is worse:
 * `[productSlug]` already owns `/{market}/{slug}`, so the category page would have had
 * to become a branch inside the most trafficked route in the app. A rewrite leaves that
 * route, its cache profile and its tests untouched.
 */
export const CATEGORY_ROUTE_PREFIX = "categories";

/**
 * Public, channel-relative href for a category — root-level, no `/categories/` segment.
 * The channel prefix is added at render time.
 *
 * The root is a namespace shared with product slugs, and nothing in Saleor stops a
 * product being given a category's slug. `pnpm check:nav` asks Saleor whether any
 * product now holds one of these slugs; today none does, out of 9,587.
 */
export function categoryHref(category: StorefrontCategory): string {
	return `/${category.slug}`;
}

/**
 * Public, channel-relative URL for ANY Saleor category slug — catalogue or not.
 *
 * Saleor holds 30 categories; this file names 8. The other 22 are accessory and
 * spare-part buckets (`prislusenstvo-k-stresnym-boxom`, `nahradne-diely-k-nosicom-bicyklov`)
 * plus brand-filtered duplicates of the main listings, and nothing in the site's own
 * navigation links to them — a product's breadcrumb does, and so does its card on a
 * listing, from whatever category Saleor put it in.
 *
 * Only catalogue categories get a root URL. The proxy resolves the root namespace
 * from a build-time set with no upstream call, so a slug it does not know falls
 * through to `[productSlug]` and soft-404s. Handing every Saleor category a root URL
 * therefore needs a different mechanism, not a longer list — see
 * docs/design/category-root-urls-20260907.md.
 *
 * The split is not only a workaround. `/sk/prislusenstvo-k-stresnym-boxom` claims
 * top-level standing for an accessory bucket; `/sk/categories/…` says what it is.
 * Each category still has exactly ONE canonical URL, which is the property that
 * matters to a crawler.
 */
export function categoryUrl(slug: string): string {
	return isCategorySlug(slug) ? `/${slug}` : categoryRoutePath(slug);
}

/** The internal path the proxy rewrites a public category URL onto. */
export function categoryRoutePath(slug: string): string {
	return `/${CATEGORY_ROUTE_PREFIX}/${slug}`;
}

/**
 * Every category slug, for the proxy.
 *
 * The proxy needs this at the edge to tell `/sk/stresne-nosice` (a category) from
 * `/sk/stresny-nosic-nordrive-…` (a product) without asking Saleor on every request.
 * It is a build-time set because the catalogue is a build-time list — and
 * `categories.test.ts` fails if a slug is ever written anywhere else.
 */
export const CATEGORY_SLUGS: ReadonlySet<string> = new Set(STOREFRONT_CATEGORIES.map((c) => c.slug));

/**
 * Is this the first path segment of a public category URL?
 *
 * Withheld categories answer `true` as well, deliberately. `surfaces` decides what the
 * site LINKS to; the URL keeps working either way, so `/sk/snehove-retaze` resolves to
 * its (empty, `noindex`) listing rather than 404-ing, and the old
 * `/sk/categories/snehove-retaze` still redirects to it.
 */
export function isCategorySlug(slug: string): boolean {
	return CATEGORY_SLUGS.has(slug);
}
