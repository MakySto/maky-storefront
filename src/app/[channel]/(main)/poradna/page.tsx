import { cmsPageRoute } from "@/lib/cms/page-route";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { PoradnaBootstrap } from "@/ui/components/cms/poradna-bootstrap";

/**
 * `/sk/poradna` — the second CMS-backed route, and the point of M.2.
 *
 * Not because the storefront needs a second page today, but because one page could always
 * have been served by a reader quietly hard-wired to `o-nas`. Two pages through one
 * `cmsPageRoute` is the proof that it is not.
 *
 * ## This route already resolved to something
 *
 * `/sk/poradna` was not a free URL. It was being absorbed by the `[productSlug]`
 * catch-all from the root-product-URL release and answering HTTP 200 with
 * „Produkt nenájdený" and a `noindex`. A static segment beats a dynamic one in Next's
 * matcher, so this folder takes precedence — but that is worth stating, because the
 * catch-all is untouched and would silently take the URL back if this route were removed.
 *
 * ## In the sitemap; still not in the navigation
 *
 * The condition this note originally set — "until a real `poradna` document is published
 * in Payload" — is met: /sk/poradna serves that document, so it is in SK_ONLY_PATHS. It
 * had been live, HTTP 200 and `index, follow`, while orphaned from the sitemap. A nav
 * link is a separate, editorial decision and is still outstanding.
 *
 * No `CompanyDetails` here: CLAUDE.md §9 puts the statutory identifiers on `/kontakt`,
 * `/obchodne-podmienky` and `/reklamacie-a-vratenie`, and Poradňa is not one of them.
 */
const route = cmsPageRoute({
	slug: "poradna",
	staticTitle: "Poradňa",
	staticDescription:
		"Poradňa MAKY.STORE — praktické rady k výberu strešných nosičov, boxov, nosičov bicyklov a ďalšieho auto-moto príslušenstva.",
	Bootstrap: PoradnaBootstrap,
	Shell: LegalPage,
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
