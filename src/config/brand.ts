/**
 * Brand Configuration — MAKY.STORE
 */

export const brandConfig = {
	siteName: "MAKY.STORE",
	copyrightHolder: "MAKY.STORE",
	organizationName: "MAKY.STORE",
	defaultBrand: "MAKY.STORE",
	// CLAUDE.md §6: no towbars and no electrical kits on consumer-facing copy until
	// the business model and the installation partner are confirmed — and neither
	// category holds a single product in sk-eur today. "10 európskych trhov" was
	// founder framing for a site that serves one live market.
	tagline: "Strešné nosiče, strešné boxy a príslušenstvo pre vaše auto",
	description:
		"Strešné nosiče, strešné boxy, nosiče bicyklov a lyží pre vaše auto. Kompletné zostavy vrátane montážneho kitu.",
	logoAriaLabel: "MAKY.STORE",
	titleTemplate: "%s | MAKY.STORE",
	social: {
		twitter: null as string | null,
		instagram: null as string | null,
		facebook: null as string | null,
	},
} as const;

export function formatPageTitle(title: string): string {
	return brandConfig.titleTemplate.replace("%s", title);
}

/**
 * `formatPageTitle` for a title that comes from data and may already name the shop.
 *
 * Saleor and CFM titles are edited by hand, and some arrive as "Strešné boxy | MAKY.STORE";
 * suffixing those again would print the brand twice. Any title that already contains the
 * site name (in any case) is returned as it is, trimmed; everything else gets the suffix.
 */
export function formatPageTitleOnce(title: string): string {
	const trimmed = title.trim();
	return trimmed.toLowerCase().includes(brandConfig.siteName.toLowerCase())
		? trimmed
		: formatPageTitle(trimmed);
}

/**
 * A title from data that says something besides the shop's name — trimmed — or `null`.
 *
 * CFM's category translations carried `seoTitle: "MAKY.STORE"` in all eleven foreign languages
 * (measured 2026-09-26), and `formatPageTitleOnce` keeps a title that already names the shop as
 * it is: the one real category of every foreign market was titled "MAKY.STORE". A title that is
 * nothing but the shop's name is a placeholder, not an approved SEO title, so the caller falls
 * back to the localized name — never to another language's text.
 */
export function meaningfulTitle(title: string | null | undefined): string | null {
	const trimmed = title?.trim();
	if (!trimmed) return null;
	const rest = trimmed
		.toLowerCase()
		.split(brandConfig.siteName.toLowerCase())
		.join("")
		.replace(/[\s|·•:\u2013\u2014-]+/g, "");
	return rest ? trimmed : null;
}
