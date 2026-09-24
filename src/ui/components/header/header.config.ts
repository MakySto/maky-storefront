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

/**
 * From which width a desktop-row link shows. The row is one line: at 1024px it holds the three
 * main shelves and Poradňa, at 1280px the tents and the fridges join, the skis at 1536px — the
 * approved header at 1440px draws exactly the row that fits there. Every category stays one
 * click away in "Všetky kategórie" at every width.
 */
export const NAV_VISIBLE_FROM: Readonly<Record<string, "xl" | "2xl">> = {
	roofTents: "xl",
	carFridges: "xl",
	brands: "xl",
	skiCarriers: "2xl",
};

/** `/poradna`. Linked only where the market has the page — see `visibleNavLinks`. */
export const ADVICE_NAV: NavItem = { key: "advice", href: "/poradna" };

/** `/znacky` — the makers this market sells, each to its own page (`lib/brands/catalog.ts`). */
export const BRANDS_NAV: NavItem = { key: "brands", href: "/znacky" };

export const HEADER_PRIMARY_NAV: readonly NavItem[] = [
	...categoriesFor("nav").map((category) => ({
		key: category.key,
		href: categoryHref(category),
	})),
	BRANDS_NAV,
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
