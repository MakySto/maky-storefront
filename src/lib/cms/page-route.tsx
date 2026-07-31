import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { fetchCmsPage, type CmsPageOutcome } from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel } from "@/lib/cms/markets";
import { buildPageMetadata } from "@/lib/seo";
import { CmsBlocks } from "@/ui/components/cms/cms-blocks";

/**
 * One CMS-backed route, given a slug and a bootstrap.
 *
 * This exists because M.2's point is not "a second page" but "the reader was never
 * hard-wired to the first one", and the only way to show that is to serve both pages
 * through the same code. Copying `o-nas/page.tsx` and editing the slug would have proved
 * the opposite.
 *
 * It also makes an invariant structural that used to be a comment. `generateMetadata` and
 * the page component must agree, branch for branch, about whether the URL exists — a
 * disagreement is how a soft-404 acquires a self-canonical and gets indexed. Two functions
 * built from one config cannot drift; two functions in a file maintained by hand can, and
 * the drift is invisible until a crawler finds it.
 *
 * ## The three outcomes, and which one gets the bootstrap
 *
 * The distinction the pilot was built around, unchanged:
 *
 *   upstream fault     timeout, DNS, Access 3xx, 5xx, malformed JSON, contract
 *                      violation. The CMS could not answer, or answered something we
 *                      cannot trust → BOOTSTRAP.
 *
 *   authoritative      `docs: []` after an unpublish, or a document whose markets
 *   absence            exclude this one. The CMS answered "not here" → 404, never the
 *                      bootstrap. Falling back would override an editorial decision with
 *                      stale code, which is the opposite of what a CMS is for.
 *
 *   found              render it.
 */
export interface CmsRouteConfig {
	/** Payload page slug, and the last segment of the storefront path. */
	readonly slug: string;
	/** Shown when the CMS gives no title of its own, and in the absent-page metadata. */
	readonly staticTitle: string;
	readonly staticDescription: string;
	/**
	 * Rendered on an upstream fault, never on an authoritative absence.
	 *
	 * A bootstrap survives a deploy, a restart and a rollback because it is code, and for
	 * the same reason it cannot know about anything published since. It is a floor, not a
	 * snapshot.
	 */
	readonly Bootstrap: () => ReactNode;
	/** Wrapper supplying the page chrome. Kept per-route: the legal pages want prose. */
	readonly Shell: (props: { title: string; children: ReactNode }) => ReactNode;
	/** Rendered after the body on routes that carry statutory identifiers. */
	readonly Footer?: () => ReactNode;
}

export interface CmsRoute {
	generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<Metadata>;
	Page: (props: { params: Promise<{ channel: string }> }) => Promise<ReactNode>;
}

/** Slovak-only, as every CMS route is until a second locale is published. */
function isSlovakChannel(channel: string): boolean {
	return REVERSE_MAP[channel] === "sk";
}

/**
 * Metadata for a request the route is about to 404.
 *
 * Under `cacheComponents` the shell — `<head>` included — is flushed before the page
 * component can call `notFound()`, so the response is a soft 404: HTTP 200 with the
 * not-found body. That makes this function, not the status line, the only thing standing
 * between a crawler and an indexed page that does not exist. It carries `noindex` and,
 * crucially, NO canonical: a self-canonical would actively nominate the absent URL.
 *
 * No title either — the metadata merges with `[channel]/(main)/layout.tsx`, which supplies
 * the site name.
 */
function absentPageMetadata(): Metadata {
	return { robots: { index: false, follow: false } };
}

export function cmsPageRoute(config: CmsRouteConfig): CmsRoute {
	const { slug, staticTitle, staticDescription, Bootstrap, Shell, Footer } = config;

	async function load(channel: string): Promise<CmsPageOutcome> {
		const locale = payloadLocaleForChannel(channel);
		const market = marketForChannel(channel);
		if (!locale || !market)
			return { status: "error", reason: `no Payload market/locale for channel ${channel}` };
		return fetchCmsPage(slug, locale, market);
	}

	async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> {
		const { channel } = await params;

		if (!isSlovakChannel(channel)) return absentPageMetadata();

		const outcome = await load(channel);
		if (outcome.status === "not-found" || outcome.status === "market-mismatch") {
			return absentPageMetadata();
		}

		const page = outcome.status === "found" ? outcome.page : null;

		return buildPageMetadata({
			// CMS meta first, then the document's own title/summary, then the static copy.
			title: page?.meta.title ?? page?.title ?? staticTitle,
			description: page?.meta.description ?? page?.summary ?? staticDescription,
			image: page?.meta.image ?? undefined,
			// Canonical stays storefront-owned. The CMS does not know the market prefix, and
			// letting it supply a canonical would let a content edit change indexing.
			url: marketHref(channel, `/${slug}`),
		});
	}

	async function Page({ params }: { params: Promise<{ channel: string }> }): Promise<ReactNode> {
		const { channel } = await params;
		if (!isSlovakChannel(channel)) notFound();

		const market = marketForChannel(channel);
		const outcome = await load(channel);

		// The CMS says there is no published page here. Honouring an unpublish is the point
		// of the CMS; reverting to the bootstrap would silently undo it.
		if (outcome.status === "not-found") {
			console.error("[cms] page-unpublished", JSON.stringify({ slug, channel }));
			notFound();
		}

		// Market exclusion is resolved inside the parser before any block content is
		// validated, so an editor decision can never turn into a bootstrap.
		if (outcome.status === "market-mismatch") {
			console.warn(
				"[cms] page-filtered-by-market",
				JSON.stringify({ slug, market, markets: outcome.markets, documentId: outcome.documentId }),
			);
			notFound();
		}

		const cmsPage = outcome.status === "found" ? outcome.page : null;

		return (
			<Shell title={cmsPage?.title ?? staticTitle}>
				{cmsPage ? <CmsBlocks blocks={cmsPage.layout} channel={channel} market={market} /> : <Bootstrap />}
				{Footer ? <Footer /> : null}
			</Shell>
		);
	}

	return { generateMetadata, Page };
}
