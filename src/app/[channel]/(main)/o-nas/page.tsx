import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCmsPage, type CmsPageOutcome } from "@/lib/cms/client";
import { isVisibleInMarket, marketForChannel, payloadLocaleForChannel } from "@/lib/cms/markets";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { buildPageMetadata } from "@/lib/seo";
import { CmsBlocks } from "@/ui/components/cms/cms-blocks";
import { CompanyDetails } from "@/ui/components/legal/company-details";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { ONasStaticContent } from "@/ui/components/legal/o-nas-static";

/**
 * `/sk/o-nas` — the first CMS-backed route.
 *
 * Two kinds of bad news arrive from the CMS and they must never be confused:
 *
 *   upstream fault      the CMS could not answer, or answered something we cannot
 *                       trust — timeout, DNS, a 3xx from Cloudflare Access, a 5xx,
 *                       a contract violation. The hand-written JSX renders.
 *
 *   authoritative       the CMS answered, and the answer is "not here" — `docs: []`
 *   absence             after an unpublish, or a document whose markets exclude this
 *                       one. The route 404s. Falling back would override an editorial
 *                       decision with stale code, which is the opposite of what
 *                       putting the page in a CMS was for.
 *
 * The fallback is a BOOTSTRAP: the copy that shipped in the build, not the last good
 * CMS render. It survives a deploy, a `pm2 restart` and a rollback because it is
 * code — and for the same reason it cannot know about anything an editor published
 * since. See `docs/design/cms-o-nas-pilot-handoff.md`.
 *
 * Legal identifiers never come from the CMS — `<CompanyDetails />` reads
 * `@/config/company` on both paths.
 */

const CMS_SLUG = "o-nas";
const STATIC_TITLE = "O nás";
const STATIC_DESCRIPTION =
	"MAKY.STORE — slovenský e-shop s auto-moto príslušenstvom: strešné nosiče, strešné boxy, nosiče bicyklov a lyží, snehové reťaze, ťažné zariadenia a ďalšie vybavenie pre auto a cestovanie.";

/** Slovak-only, as it was before the CMS. */
function isSlovakChannel(channel: string): boolean {
	return REVERSE_MAP[channel] === "sk";
}

async function loadPage(channel: string): Promise<CmsPageOutcome> {
	const locale = payloadLocaleForChannel(channel);
	if (!locale) return { status: "error", reason: `no Payload locale for channel ${channel}` };
	return fetchCmsPage(CMS_SLUG, locale);
}

/**
 * Metadata for a request this route is about to 404.
 *
 * Under `cacheComponents` the shell — `<head>` included — is flushed before the page
 * component can call `notFound()`, so the response is a soft 404: HTTP 200 with the
 * not-found body. That makes this function, not the status line, the only thing
 * standing between a crawler and an indexed page that does not exist. It therefore
 * carries `noindex` and, crucially, NO canonical: a self-canonical would actively
 * nominate the absent URL for indexing.
 *
 * No title either — the metadata merges with `[channel]/(main)/layout.tsx`, which
 * supplies the site name.
 */
function absentPageMetadata(): Metadata {
	return { robots: { index: false, follow: false } };
}

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;

	// Every branch here must agree with the page component below about whether this
	// URL exists. A disagreement is how a 404 ends up with a self-canonical.
	if (!isSlovakChannel(channel)) return absentPageMetadata();

	const outcome = await loadPage(channel);
	if (outcome.status === "not-found") return absentPageMetadata();

	const market = marketForChannel(channel);
	if (outcome.status === "found" && !isVisibleInMarket(outcome.page.markets, market)) {
		return absentPageMetadata();
	}

	const page = outcome.status === "found" ? outcome.page : null;

	return buildPageMetadata({
		// CMS meta first, then the document's own title/summary, then the static copy.
		title: page?.meta.title ?? page?.title ?? STATIC_TITLE,
		description: page?.meta.description ?? page?.summary ?? STATIC_DESCRIPTION,
		image: page?.meta.image ?? undefined,
		// Canonical stays storefront-owned. The CMS does not know the market prefix, and
		// letting it supply a canonical would let a content edit change indexing.
		url: marketHref(channel, `/${CMS_SLUG}`),
	});
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (!isSlovakChannel(channel)) notFound();

	const market = marketForChannel(channel);
	const outcome = await loadPage(channel);

	// The CMS says there is no published page here. Honouring an unpublish is the
	// point of the CMS; reverting to the bootstrap copy would silently undo it.
	if (outcome.status === "not-found") {
		console.error("[cms] page-unpublished", JSON.stringify({ slug: CMS_SLUG, channel }));
		notFound();
	}

	// A document that excludes this market is also an authoritative absence, not a
	// fault. Rendering the Slovak bootstrap copy because the CMS said "this page is
	// for CZ" would publish content the editor deliberately withheld.
	if (outcome.status === "found" && !isVisibleInMarket(outcome.page.markets, market)) {
		console.warn(
			"[cms] page-filtered-by-market",
			JSON.stringify({ slug: CMS_SLUG, market, markets: outcome.page.markets }),
		);
		notFound();
	}

	const cmsPage = outcome.status === "found" ? outcome.page : null;

	return (
		<LegalPage title={cmsPage?.title ?? STATIC_TITLE}>
			{cmsPage ? (
				<CmsBlocks blocks={cmsPage.layout} channel={channel} market={market} />
			) : (
				<ONasStaticContent />
			)}
			<CompanyDetails />
		</LegalPage>
	);
}
