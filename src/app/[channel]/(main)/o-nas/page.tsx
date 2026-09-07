import { type ReactNode } from "react";
import { cmsPageRoute } from "@/lib/cms/page-route";
import { CompanyDetails } from "@/ui/components/legal/company-details";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { ONasStaticContent } from "@/ui/components/legal/o-nas-static";

/**
 * `/sk/o-nas` — the first CMS-backed route, live in production since 2026-07-30.
 *
 * Everything that used to live here is now in `cmsPageRoute`, unchanged in behaviour: the
 * three-outcome split, the agreement between `generateMetadata` and the page component,
 * the soft-404 handling. What is left is the four things that were ever specific to this
 * page — its slug, its static copy, its bootstrap, and the company block.
 *
 * That is the milestone, not a tidy-up. A single CMS route can always be one the reader is
 * hard-wired to; two routes sharing this factory cannot be.
 *
 * The bootstrap is a BOOTSTRAP: the copy that shipped in the build, not the last good CMS
 * render. It survives a deploy, a restart and a rollback because it is code, and for the
 * same reason it cannot know about anything an editor published since. It renders on an
 * upstream fault and never on an authoritative absence.
 *
 * Legal identifiers never come from the CMS — `<CompanyDetails />` reads `@/config/company`
 * on both paths.
 */
const route = cmsPageRoute({
	slug: "o-nas",
	staticTitle: "O nás",
	staticDescription:
		"MAKY.STORE je slovenský obchod s výbavou pre auto a cesty. Strešné nosiče, boxy, nosiče bicyklov aj pomoc s výberom správneho príslušenstva.",
	Bootstrap: ONasStaticContent,
	Shell: LegalPage,
	Footer: CompanyDetails as () => ReactNode,
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
