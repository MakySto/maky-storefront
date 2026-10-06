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

import type { ProductKind } from "@/lib/fitment/contract";
import { shelfFitmentKind } from "./fitment-shelves";

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
	// In the desktop row since the 2026-09 redesign's second pass: the approved header links
	// the roof tents and the fridges directly (`header.config.ts` decides from which width).
	{ slug: "stresne-stany", key: "roofTents", surfaces: ["nav", "home"] },
	{ slug: "autochladnicky", key: "carFridges", surfaces: ["nav", "home"] },
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

/**
 * Every OTHER category Saleor held when this list was last written — the ones this catalogue does
 * not name.
 *
 * Saleor holds 30 categories (30 on 2026-09-07 too; the list is the one CFM read from `api.maky.store`
 * for its catalogue-pages import): the 8 above and these 22 —
 * Saleor's own `default-category`, the accessory and spare-part sub-categories of the catalogue
 * ones, their other sub-categories (bike carriers on the roof, the tow bar or the rear door,
 * dog cages, …) and the Thule and Nordrive roof-rack shelves. No menu or tile links to them, so
 * they have no entry above (an entry is a menu slot, `surfaces` and an i18n key), but every one
 * of them has the same public URL as a catalogue category: root-level, no `/categories/` segment
 * (owner, 2026-10-06).
 *
 * This list plus `STOREFRONT_CATEGORIES` is the FLOOR of the set the proxy tells a category from a
 * product with, no longer the whole of it. The running server also loads the categories Saleor
 * holds (`src/lib/live-categories.ts`), so a category created after this list was written gets
 * its root URL from that, with no edit here and no deploy (owner, 2026-10-06). The floor is what
 * the proxy and every link fall back on when Saleor cannot be asked — a cold start, an outage —
 * so the root URLs that exist today never stop routing. Nothing has to be added here when a
 * category is created; `pnpm check:nav` lists the ones that are not, as information.
 *
 * One slug per line and no comments inside the array: `scripts/checks/nav-links.mjs` reads it.
 */
export const OTHER_CATEGORY_SLUGS: readonly string[] = [
	"default-category",
	"autodoplnky",
	"nosice-kajakov-a-surfov",
	"preprava-zvierat",
	"drziaky-a-stojany-na-bicykle",
	"nahradne-diely-k-nosicom-bicyklov",
	"nahradne-diely-k-stresnym-boxom",
	"nordrive-stresne-nosice",
	"nosice-bicyklov-na-strechu",
	"nosice-bicyklov-na-tazne-zariadenie",
	"nosice-bicyklov-na-zadne-dvere",
	"ochranne-mreze-a-bariery",
	"ochranne-potahy-do-auta",
	"opravne-sady",
	"prepravne-klietky-pre-psov-do-auta",
	"prislusenstvo-k-nosicom-bicyklov",
	"prislusenstvo-k-nosicom-lyzi",
	"prislusenstvo-k-prepravnym-klietkam",
	"prislusenstvo-k-stresnym-boxom",
	"prislusenstvo-k-stresnym-stanom",
	"thule-stresne-nosice",
	"vanicky-do-kufra",
];

/**
 * The Saleor product type CFM gives every accessory and spare part — bags, covers, adapters,
 * locks, mounting kits — as opposed to the product a shopper came for (a roof box, a bike
 * carrier, a car fridge). Measured on sk-eur 2026-09-24: every product in the accessory and
 * spare-part sub-categories has this type, and no product in a main category does.
 *
 * A category listing's recommended order shows the other types first and this one after
 * them (`src/lib/listing/grouped-listing.ts`). The type is looked up by this slug, never by
 * an id typed here; when Saleor has no type with it, listings keep Saleor's own order, so a
 * renamed type costs the grouping and never the page.
 *
 * Which group a product lands in is catalogue data. A product filed under the wrong type is
 * corrected in CFM, not worked around by reading its name or its price here.
 */
export const ACCESSORY_PRODUCT_TYPE_SLUG = "automotive-accessory-spare-part";

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
 * product now holds the slug of ANY category — the 8 here, `OTHER_CATEGORY_SLUGS` and whatever
 * Saleor holds beyond them.
 */
export function categoryHref(category: StorefrontCategory): string {
	return `/${category.slug}`;
}

/**
 * Public, channel-relative URL for ANY Saleor category slug — catalogue or not.
 *
 * Every category Saleor holds has a root URL (`/sk/prislusenstvo-k-stresnym-boxom`,
 * `/sk/nosice-bicyklov-na-tazne-zariadenie`), not only the 8 this file names: the owner asked
 * for category URLs without the `/categories/` segment on 2026-10-06, for all of them. Nothing in
 * the site's own navigation links to the other 22, but a product's breadcrumb does, and so does
 * its card on a listing, from whatever category Saleor put it in.
 *
 * The one URL that still carries `/categories/` is a category the running server does not know
 * yet: created in Saleor within the last minute (the live list looks again at most once a minute,
 * and at once on a category event), or while Saleor cannot be asked, or refused because a product
 * already holds its slug. The proxy resolves the root namespace from the floor below plus that
 * live list, with no upstream call on the request path, so a slug it does not know would fall
 * through to `[productSlug]` and soft-404; until it learns the slug, the category keeps the URL it
 * has, which works. Each category has exactly ONE canonical URL at any time, which is the property
 * that matters to a crawler.
 *
 * The earlier split — root URLs for the catalogue only, `/categories/` for the rest — is
 * recorded in docs/design/category-root-urls-20260907.md, with why this was the harder option
 * of the two it names (a set resolved without a request-time lookup), and how the set is kept
 * current now that nobody has to write it by hand.
 */
export function categoryUrl(slug: string): string {
	return isCategorySlug(slug) ? `/${slug}` : categoryRoutePath(slug);
}

/** The internal path the proxy rewrites a public category URL onto. */
export function categoryRoutePath(slug: string): string {
	return `/${CATEGORY_ROUTE_PREFIX}/${slug}`;
}

/**
 * The category slugs this build was written with: the FLOOR of the set the proxy uses.
 *
 * The proxy needs the set at the edge to tell `/sk/stresne-nosice` (a category) from
 * `/sk/stresny-nosic-nordrive-…` (a product) without asking Saleor on every request. The floor
 * is written down so that it is there on the first request of a fresh process and while Saleor
 * is unreachable; `categories.test.ts` fails if a slug is ever written anywhere else. The
 * catalogue categories and `OTHER_CATEGORY_SLUGS` together were all 30 that Saleor held when
 * this was written. What the running server has learned since is `isCategorySlug`'s other half.
 */
export const CATEGORY_SLUGS: ReadonlySet<string> = new Set([
	...STOREFRONT_CATEGORIES.map((c) => c.slug),
	...OTHER_CATEGORY_SLUGS,
]);

/**
 * Where `src/lib/live-categories.ts` publishes the categories the running server has learned
 * from Saleor, on `globalThis`.
 *
 * On `globalThis` for the reason `route-existence.ts` keeps its state there: the proxy is one
 * bundle and the route handlers another, each with its own copy of every module, and under
 * `next start` they share one process and one realm. And a key rather than an import so that this
 * file, which client components import too, never pulls the live list's `fetch` code into the
 * browser: there the key is simply absent and the floor answers alone.
 */
export const LIVE_CATEGORY_SLUGS_KEY: unique symbol = Symbol.for("maky.live-categories.live.v1");

function liveCategorySlugs(): ReadonlySet<string> | undefined {
	return (globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> })[
		LIVE_CATEGORY_SLUGS_KEY
	];
}

/**
 * Is this the first path segment of a public category URL?
 *
 * The floor above plus every category the running server has loaded from Saleor — a category
 * created after this build was written is answered by the second half, once the live list has
 * seen it. Never fewer than the floor: a failed or partial load can only add.
 *
 * Withheld categories answer `true` as well, deliberately. `surfaces` decides what the
 * site LINKS to; the URL keeps working either way, so `/sk/snehove-retaze` resolves to
 * its (empty, `noindex`) listing rather than 404-ing, and the old
 * `/sk/categories/snehove-retaze` still redirects to it. So does every other category
 * Saleor holds: the set is not "the catalogue" any more, it is all of them.
 */
export function isCategorySlug(slug: string): boolean {
	return CATEGORY_SLUGS.has(slug) || (liveCategorySlugs()?.has(slug) ?? false);
}

/**
 * The fitment product kind on this category's shelf, or `null` when the compatibility
 * programme makes no claim about it.
 *
 * The scope lives in `fitment-shelves.ts`, apart from this registry: this file decides what the
 * site links to and which root URLs exist, and the vehicle filter's scope must not depend on
 * either. Kept here as the name callers already import.
 */
export function categoryFitmentKind(slug: string): ProductKind | null {
	return shelfFitmentKind(slug);
}
