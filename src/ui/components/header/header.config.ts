/**
 * Header navigation config.
 *
 * Category slugs are NOT written here — they come from `@/config/categories`, the
 * single source of truth, so the menu and the homepage grid can no longer point the
 * same category at two different slugs (they did: `nosice-lyzi` here, `nosice-lyz`
 * on the homepage, and only one of them exists).
 *
 * Keys map to the `nav` namespace in the locale JSON files.
 * Hrefs are prefixed with /[channel] at render time.
 * TODO: When localized slugs are ready, these hrefs will use slug resolver.
 */
import { categoriesFor, categoryHref, isCategorySlug } from "@/config/categories";
import { categoryUrlFor } from "@/config/category-routes";

export interface NavItem {
	readonly key: string;
	readonly href: string;
}

/** `/poradna`. Linked only where the market has the page — see `visibleNavLinks`. */
export const ADVICE_NAV: NavItem = { key: "advice", href: "/poradna" };

/** `/znacky` — the makers this market sells, each to its own page (`lib/brands/catalog.ts`). */
export const BRANDS_NAV: NavItem = { key: "brands", href: "/znacky" };

/**
 * The desktop row, in order of priority (owner, 2026-09-25).
 *
 * One line: the catalogue's categories first, then "Značky" and "Poradňa" after a short rule.
 * When the row is short of width the links give way from the END — "Poradňa" first, then
 * "Značky", then the categories from the last (the fridges, the tents) — so a shelf that sells
 * never disappears to keep a secondary link in view. Both secondary links stay reachable at every
 * width: in the "Všetky kategórie" menu, the phone menu and on the homepage. Width is measured,
 * not guessed from the viewport: the page stops growing at 88rem and the labels differ by up to
 * 40% between markets, and a viewport breakpoint let the row run under the vehicle button (see
 * `header-primary-nav.tsx`).
 */
export const HEADER_CATEGORY_NAV: readonly NavItem[] = categoriesFor("nav").map((category) => ({
	key: category.key,
	href: categoryHref(category),
}));

export const HEADER_UTILITY_NAV: readonly NavItem[] = [BRANDS_NAV, ADVICE_NAV];

export const HEADER_PRIMARY_NAV: readonly NavItem[] = [...HEADER_CATEGORY_NAV, ...HEADER_UTILITY_NAV];

/**
 * Every surfaced category, for the lists that have room for all of them: the mobile menu,
 * the "Všetky kategórie" panel and the footer. The desktop nav row shows only the `nav`
 * subset because it has one line of width to spend; a vertical list does not, and a visitor
 * on a phone had no way at all to reach the fridges or the roof tents from the menu.
 * The homepage grid already shows exactly this set, so `home` is the right surface.
 */
export const ALL_CATEGORIES_NAV: readonly NavItem[] = categoriesFor("home").map((category) => ({
	key: category.key,
	href: categoryHref(category),
}));

/**
 * A category link is stored as `/{base slug}`; abroad its canonical segment differs —
 * `/cz/stresni-nosice`. Only a catalogue category is touched: `categoryUrlFor` would turn
 * any other slug into a `/categories/…` URL, and `/poradna` is not a category.
 */
export function localizedNavHref(channel: string, href: string): string {
	const slug = href.slice(1);
	return href.startsWith("/") && isCategorySlug(slug) ? categoryUrlFor(channel, slug) : href;
}
