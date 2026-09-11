import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { fetchCmsPage, type CmsPageOutcome } from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel, type MarketCode } from "@/lib/cms/markets";
import { isContentReady } from "@/lib/cms/content-readiness";
import { marketHasRoute } from "@/lib/route-policy";
import { buildPageMetadata } from "@/lib/seo";
import { buildLanguageAlternates } from "@/lib/seo/hreflang";
import { CmsBlocks } from "@/ui/components/cms/cms-blocks";

/**
 * One CMS-backed route, given a slug and a per-market bootstrap.
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
 * ## The four outcomes, and which one gets the bootstrap
 *
 *   upstream fault     timeout, DNS, Access 3xx, 5xx, malformed JSON, contract
 *                      violation. The CMS could not answer, or answered something we
 *                      cannot trust → BOOTSTRAP where the market has one, otherwise a
 *                      localised "temporarily unavailable" that is explicitly NOT a
 *                      claim the page does not exist.
 *
 *   authoritative      `docs: []` after an unpublish, or a document whose markets
 *   absence            exclude this one. The CMS answered "not here" → 404, never the
 *                      bootstrap. Falling back would override an editorial decision with
 *                      stale code, which is the opposite of what a CMS is for.
 *
 *   route unsupported  this market does not have this route at all → 404, without ever
 *                      asking the CMS.
 *
 *   found              render it.
 *
 * ## Two gates, deliberately separate
 *
 * `marketHasRoute()` answers whether the APPLICATION offers this route in this market.
 * The CMS answers whether there is PUBLISHED CONTENT for it right now. Collapsing the two
 * is what the old `isSlovakChannel()` did: it hard-coded one market, so an editor
 * publishing a Czech document changed nothing and an editor unpublishing the Slovak one
 * still left the route advertised. Opening a market is now a single edit in
 * `route-policy.ts`, and publication is the CMS's to decide from there on.
 *
 * ## No market may fall back to another market's language
 *
 * `staticTitle`, `staticDescription` and `Bootstrap` are per market. A market with no
 * entry gets the localised unavailable state, never Slovak prose under a foreign URL —
 * which is what a single shared bootstrap would have produced the moment this route
 * opened beyond `sk`.
 */
export interface CmsRouteMarketCopy {
	/** Shown when the CMS gives no title of its own. */
	readonly staticTitle: string;
	readonly staticDescription: string;
	/**
	 * Rendered on an upstream fault, never on an authoritative absence.
	 *
	 * A bootstrap survives a deploy, a restart and a rollback because it is code, and for
	 * the same reason it cannot know about anything published since. It is a floor, not a
	 * snapshot. Optional: only a market with approved in-code copy has one, and a market
	 * without one shows the localised unavailable state instead of someone else's text.
	 */
	readonly Bootstrap?: () => ReactNode;
}

export interface CmsRouteConfig {
	/** Payload page slug, and the last segment of the storefront path. */
	readonly slug: string;
	/** Per-market static copy. Markets absent here still 404 via `marketHasRoute`. */
	readonly copy: Partial<Record<MarketCode, CmsRouteMarketCopy>>;
	/** Wrapper supplying the page chrome. Kept per-route: the legal pages want prose. */
	readonly Shell: (props: { title: string; children: ReactNode }) => ReactNode;
	/** Rendered after the body on routes that carry statutory identifiers. */
	readonly Footer?: () => ReactNode;
}

export interface CmsRoute {
	generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<Metadata>;
	Page: (props: { params: Promise<{ channel: string }> }) => Promise<ReactNode>;
}

/**
 * Metadata for a request the route is about to 404, and for an upstream fault.
 *
 * Under `cacheComponents` the shell — `<head>` included — is flushed before the page
 * component can call `notFound()`, so the response is a soft 404: HTTP 200 with the
 * not-found body. That makes this function, not the status line, the only thing standing
 * between a crawler and an indexed page that does not exist. It carries `noindex` and,
 * crucially, NO canonical: a self-canonical would actively nominate the absent URL.
 *
 * The same applies to an outage. A "temporarily unavailable" page must not be indexed and
 * must not be nominated as the canonical version of the real page.
 *
 * No title either — the metadata merges with `[channel]/(main)/layout.tsx`, which supplies
 * the site name.
 */
function unindexedMetadata(): Metadata {
	return { robots: { index: false, follow: false } };
}

export function cmsPageRoute(config: CmsRouteConfig): CmsRoute {
	const { slug, copy, Shell, Footer } = config;

	/** Whether the application offers this route here — never whether content exists. */
	function routeOffered(channel: string): boolean {
		return marketHasRoute(REVERSE_MAP[channel] ?? "", slug);
	}

	async function load(channel: string): Promise<CmsPageOutcome> {
		const locale = payloadLocaleForChannel(channel);
		const market = marketForChannel(channel);
		if (!locale || !market)
			return { status: "error", reason: `no Payload market/locale for channel ${channel}` };
		return fetchCmsPage(slug, locale, market);
	}

	async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> {
		const { channel } = await params;
		if (!routeOffered(channel)) return unindexedMetadata();

		const market = marketForChannel(channel);
		const outcome = await load(channel);

		// The CMS answered "not here". All three are authoritative absences: the document
		// is unpublished, excluded from this market, or published with no body for it.
		// The third is the one that used to slip through as a success.
		if (
			outcome.status === "not-found" ||
			outcome.status === "market-mismatch" ||
			(outcome.status === "found" && !isContentReady(slug, outcome.page.layout))
		) {
			return unindexedMetadata();
		}

		const marketCopy = market ? copy[market] : undefined;

		// An upstream fault in a market with no bootstrap must not borrow another
		// market's title and description — that is how Slovak SEO ends up on /de.
		if (outcome.status === "error" && !marketCopy?.Bootstrap) {
			return unindexedMetadata();
		}

		const page = outcome.status === "found" ? outcome.page : null;

		const metadata = buildPageMetadata({
			// CMS meta first, then the document's own title/summary, then this market's
			// static copy. Never another market's.
			title: page?.meta.title ?? page?.title ?? marketCopy?.staticTitle ?? "",
			description: page?.meta.description ?? page?.summary ?? marketCopy?.staticDescription ?? "",
			image: page?.meta.image ?? undefined,
			// Canonical stays storefront-owned. The CMS does not know the market prefix, and
			// letting it supply a canonical would let a content edit change indexing.
			url: marketHref(channel, `/${slug}`),
		});

		// Alternates come from `route-policy.ts`, which is where a market is recorded as
		// having this CMS route at all — and it is only opened there once P has evidenced
		// a published document. So the cluster stays reciprocal without this function
		// asking Payload about eleven other markets on every render, which is the cost
		// the brief rules out. Today `o-nas` is `sk` alone, so it emits nothing.
		//
		// Only `languages` is added; the canonical `buildPageMetadata` already produced
		// stays exactly as it was.
		const languages = buildLanguageAlternates(`/${slug}`);
		if (!languages) return metadata;
		return { ...metadata, alternates: { ...metadata.alternates, languages } };
	}

	async function Page({ params }: { params: Promise<{ channel: string }> }): Promise<ReactNode> {
		const { channel } = await params;
		if (!routeOffered(channel)) notFound();

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

		// Published, allowed in this market, and carrying no body for it. An authoritative
		// absence — NOT an outage, so it never reaches the bootstrap, and never borrows
		// another market's text. Logged under its own name because the operator question
		// ("is the CMS down?" vs "did someone forget the German paragraph?") is different.
		if (outcome.status === "found" && !isContentReady(slug, outcome.page.layout)) {
			console.error(
				"[cms] content-not-ready",
				JSON.stringify({ slug, channel, market, documentId: outcome.page.id }),
			);
			notFound();
		}

		const marketCopy = market ? copy[market] : undefined;

		// Upstream fault, and this market has no approved in-code copy to fall back on.
		// Say so in the reader's own language rather than serving another market's text or
		// claiming the page does not exist.
		if (outcome.status === "error" && !marketCopy?.Bootstrap) {
			console.error(
				"[cms] unavailable-no-bootstrap",
				JSON.stringify({ slug, channel, market, reason: outcome.reason }),
			);
			const t = await getTranslations("cms");
			return (
				<Shell title={t("unavailableTitle")}>
					<p>{t("unavailableBody")}</p>
				</Shell>
			);
		}

		const cmsPage = outcome.status === "found" ? outcome.page : null;
		const Bootstrap = marketCopy?.Bootstrap;

		return (
			<Shell title={cmsPage?.title ?? marketCopy?.staticTitle ?? ""}>
				{cmsPage ? (
					<CmsBlocks blocks={cmsPage.layout} channel={channel} market={market} />
				) : Bootstrap ? (
					<Bootstrap />
				) : null}
				{Footer ? <Footer /> : null}
			</Shell>
		);
	}

	return { generateMetadata, Page };
}
