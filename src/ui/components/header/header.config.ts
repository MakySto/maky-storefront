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

export const HEADER_PRIMARY_NAV: readonly NavItem[] = [
	...categoriesFor("nav").map((category) => ({
		key: category.key,
		href: categoryHref(category),
	})),
	ADVICE_NAV,
];

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
