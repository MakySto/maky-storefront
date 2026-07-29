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
 * Content comes from Payload; the hand-written JSX stays as the fallback. Whenever
 * the CMS cannot be trusted — timeout, a 3xx from Cloudflare Access, a 5xx, a
 * response that fails validation, or a page filtered out for this market — the
 * original component renders instead. That fallback is code, so it survives a
 * build, a `pm2 restart` and a git rollback without any snapshot directory.
 *
 * An authoritative `docs: []` is handled differently and deliberately does NOT fall
 * back: the CMS is stating that no published page exists at this slug, and honouring
 * an editor's unpublish is the point of putting the page in a CMS. Worth knowing:
 * unpublishing `o-nas` in Payload takes this route down rather than reverting it to
 * the old copy.
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

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;

	// Canonical stays storefront-owned. The CMS does not know the market prefix, and
	// letting it supply a canonical would let a content edit change indexing.
	const canonical = marketHref(channel, `/${CMS_SLUG}`);

	if (!isSlovakChannel(channel)) {
		return buildPageMetadata({ title: STATIC_TITLE, description: STATIC_DESCRIPTION, url: canonical });
	}

	const outcome = await loadPage(channel);
	const page = outcome.status === "found" ? outcome.page : null;

	return buildPageMetadata({
		// CMS meta first, then the document's own title/summary, then the static copy.
		title: page?.meta.title ?? page?.title ?? STATIC_TITLE,
		description: page?.meta.description ?? page?.summary ?? STATIC_DESCRIPTION,
		image: page?.meta.image ?? undefined,
		url: canonical,
	});
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (!isSlovakChannel(channel)) notFound();

	const market = marketForChannel(channel);
	const outcome = await loadPage(channel);

	if (outcome.status === "not-found") {
		// Not a fallback case: the CMS says there is no published page here. Under
		// `cacheComponents` the shell is already flushed by now, so this is a soft 404
		// (200 + noindex) rather than a real status — the documented PPR constraint.
		console.error("[cms] page-unpublished", JSON.stringify({ slug: CMS_SLUG, channel }));
		notFound();
	}

	const cmsPage =
		outcome.status === "found" && isVisibleInMarket(outcome.page.markets, market) ? outcome.page : null;

	if (outcome.status === "found" && !cmsPage) {
		console.warn(
			"[cms] page-filtered-by-market",
			JSON.stringify({ slug: CMS_SLUG, market, markets: outcome.page.markets }),
		);
	}

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
