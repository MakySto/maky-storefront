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
import { categoriesFor, categoryHref } from "@/config/categories";

export interface NavItem {
	readonly key: string;
	readonly href: string;
}

export const HEADER_PRIMARY_NAV: readonly NavItem[] = [
	...categoriesFor("nav").map((category) => ({
		key: category.key,
		href: categoryHref(category),
	})),
	{ key: "advice", href: "/poradna" },
];
