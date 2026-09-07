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
