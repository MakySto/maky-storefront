import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import {
	fetchCmsPage,
	isPreviewTokenRefusal,
	resolveCmsPreview,
	type CmsPageOutcome,
} from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel, type MarketCode } from "@/lib/cms/markets";
import { isContentReady } from "@/lib/cms/content-readiness";
import { type CmsPage } from "@/lib/cms/page-schema";
import { CMS_PREVIEW_COPY } from "@/lib/cms/preview-copy";
import { readCmsPreviewSession } from "@/lib/cms/preview-session";
import { marketHasRoute } from "@/lib/route-policy";
import { buildPageMetadata } from "@/lib/seo";
import { cmsLanguageAlternates } from "@/lib/cms/availability";
import { cmsRevisionMetadata } from "@/lib/cms/revision";
import { CmsBlocks } from "@/ui/components/cms/cms-blocks";
import { CmsPreviewBanner, cmsPreviewExitHref } from "@/ui/components/cms/cms-preview-banner";

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
 * ## Draft preview (`__fixtures__/provider-v3/preview-v1.md`)
 *
 * When Next's Draft Mode is on AND the `maky-cms-preview` cookie holds a token, the route does
 * not read the published REST at all: it resolves the token through the CMS
 * (`resolveCmsPreview`, `no-store`) and renders exactly the version the token names, with the
 * same parser and the same block components, under a "Náhľad konceptu" banner. It is
 * `noindex, nofollow`, carries the draft's revision marker, and — being a Draft Mode request —
 * is rendered per request and served `private, no-store` by Next itself.
 *
 * The preview answers only for its own page in its own market. A token for another slug leaves
 * this page to its published path; a token for another market is an invalid preview, never
 * someone else's language. Inside that, the preview works in every one of the twelve markets
 * whether or not the market is live or the route policy offers the page there — the proxy lets
 * a CMS route through for a preview session (`src/proxy.ts`), and nothing else changes: no
 * market opens, no link appears, no sitemap entry.
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

/** A preview is never indexed or followed, by any crawler (`preview-v1.md`). */
const PREVIEW_ROBOTS: Metadata["robots"] = {
	index: false,
	follow: false,
	googleBot: { index: false, follow: false },
};

/**
 * One resolve per request: `generateMetadata` and the page both need the draft, and React's
 * request-scoped `cache` lets them share one `no-store` call instead of making two.
 */
const resolvePreviewOnce = cache(resolveCmsPreview);

/** What a preview request renders, decided once for metadata and page alike. */
type PreviewRender =
	| { readonly kind: "page"; readonly page: CmsPage; readonly exitHref: string }
	| { readonly kind: "status"; readonly message: string; readonly exitHref: string };

export function cmsPageRoute(config: CmsRouteConfig): CmsRoute {
	const { slug, copy, Shell, Footer } = config;

	/** Whether the application offers this route here — never whether content exists. */
	function routeOffered(channel: string): boolean {
		return marketHasRoute(REVERSE_MAP[channel] ?? "", slug);
	}

	/**
	 * The draft this request previews, or `null` for the published path.
	 *
	 * `null` also when the preview belongs to another page: an editor who follows a link out
	 * of a preview sees every other page exactly as the public does.
	 */
	async function previewFor(channel: string): Promise<PreviewRender | null> {
		const session = await readCmsPreviewSession();
		const market = marketForChannel(channel);
		if (!session || !market) return null;

		const exitHref = cmsPreviewExitHref(marketHref(channel, `/${slug}`));
		const status = (message: string): PreviewRender => ({ kind: "status", message, exitHref });

		const outcome = await resolvePreviewOnce(session.token);
		switch (outcome.status) {
			case "not-configured":
				return status(CMS_PREVIEW_COPY.notConfigured);
			case "rejected":
				return status(
					isPreviewTokenRefusal(outcome) ? CMS_PREVIEW_COPY.invalid : CMS_PREVIEW_COPY.notConfigured,
				);
			case "error":
				return status(CMS_PREVIEW_COPY.unavailable);
		}

		const { preview, content } = outcome;
		if (preview.slug !== slug) return null;
		// The token was issued for one market and resolved in its language. Showing it under
		// another market's URL would show one market's draft in another's place.
		if (preview.market !== market) return status(CMS_PREVIEW_COPY.invalid);

		if (content.kind === "not-in-market") return status(CMS_PREVIEW_COPY.notInMarket);
		if (content.kind === "invalid") return status(CMS_PREVIEW_COPY.unrenderable);
		// The same body contract the published page is held to, so a preview never shows a page
		// the public would get as a 404.
		if (!isContentReady(slug, content.page.layout)) return status(CMS_PREVIEW_COPY.notReady);
		return { kind: "page", page: content.page, exitHref };
	}

	function previewMetadata(preview: PreviewRender, channel: string): Metadata {
		if (preview.kind === "status") return { title: CMS_PREVIEW_COPY.title, robots: PREVIEW_ROBOTS };
		const { page } = preview;
		const revision = cmsRevisionMetadata(page);
		return {
			// No `url`, so no canonical and no hreflang: a draft is nobody's canonical page.
			...buildPageMetadata({
				channel,
				title: page.meta.title ?? page.title,
				description: page.meta.description ?? page.summary ?? "",
				image: page.meta.image ?? undefined,
			}),
			robots: PREVIEW_ROBOTS,
			...(revision ? { other: revision } : {}),
		};
	}

	function PreviewPage({
		preview,
		channel,
		market,
	}: {
		preview: PreviewRender;
		channel: string;
		market: MarketCode | null;
	}): ReactNode {
		return (
			<>
				<CmsPreviewBanner exitHref={preview.exitHref} />
				{preview.kind === "page" ? (
					<Shell title={preview.page.title}>
						<CmsBlocks blocks={preview.page.layout} channel={channel} market={market} />
						{Footer ? <Footer /> : null}
					</Shell>
				) : (
					<Shell title={CMS_PREVIEW_COPY.title}>
						<p>{preview.message}</p>
					</Shell>
				)}
			</>
		);
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

		// Before the route gate: a preview renders in markets the public route does not reach.
		const preview = await previewFor(channel);
		if (preview) return previewMetadata(preview, channel);

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
			channel,
			// CMS meta first, then the document's own title/summary, then this market's
			// static copy. Never another market's.
			title: page?.meta.title ?? page?.title ?? marketCopy?.staticTitle ?? "",
			description: page?.meta.description ?? page?.summary ?? marketCopy?.staticDescription ?? "",
			image: page?.meta.image ?? undefined,
			// Canonical stays storefront-owned. The CMS does not know the market prefix, and
			// letting it supply a canonical would let a content edit change indexing.
			url: marketHref(channel, `/${slug}`),
		});

		// The revision marker (pages contract v3 §3) — only when a CMS document is what the
		// page renders. A bootstrap served on an outage carries none, so the CMS verifier can
		// never mistake the code copy for its new revision.
		const revision = page ? cmsRevisionMetadata(page) : undefined;
		const withRevision: Metadata = revision ? { ...metadata, other: revision } : metadata;

		// Alternates are the markets that support this route AND actually serve it right
		// now. Route support alone is not enough: a market can be live, support `/o-nas`
		// and have nothing published — or a document with no body for it — and an
		// hreflang entry pointing at that 404 gets the WHOLE cluster discarded, not just
		// the bad entry. `publishedCmsMarkets` asks only the markets the static policy
		// already allows, through the same cached read the page performs.
		//
		// Only `languages` is added; the canonical `buildPageMetadata` already produced
		// stays exactly as it was.
		const languages = await cmsLanguageAlternates(slug);
		if (!languages) return withRevision;
		return { ...withRevision, alternates: { ...withRevision.alternates, languages } };
	}

	async function Page({ params }: { params: Promise<{ channel: string }> }): Promise<ReactNode> {
		const { channel } = await params;
		const market = marketForChannel(channel);

		const preview = await previewFor(channel);
		if (preview) return <PreviewPage preview={preview} channel={channel} market={market} />;

		if (!routeOffered(channel)) notFound();
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
