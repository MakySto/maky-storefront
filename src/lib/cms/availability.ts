import "server-only";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { fetchCmsPage } from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel } from "@/lib/cms/markets";
import { isContentReady } from "@/lib/cms/content-readiness";
import { liveMarkets } from "@/lib/market-state";
import { isMarketRootSegment, marketHasRoute, routePolicyFor } from "@/lib/route-policy";
import { languageAlternatesFor } from "@/lib/seo/hreflang";

/**
 * Whether a CMS-backed route should be advertised in navigation right now.
 *
 * Two different questions used to be answered by one: `marketHasRoute()` says the
 * APPLICATION offers the route in this market, which is a static decision in
 * `route-policy.ts`. It says nothing about whether an editor has published anything.
 * The footer's own comment claimed `/o-nas` "follows the CMS" while the code read only
 * the static table, so publishing or unpublishing a document changed the page and left
 * the navigation pointing wherever it had pointed before.
 *
 * ## Why this costs nothing on eleven markets
 *
 * The static gate is checked FIRST and short-circuits. A market whose policy does not
 * offer the route never reaches the CMS at all, so today — with `o-nas` still `sk` only —
 * this adds exactly one call on one market and none on the other eleven.
 *
 * That call is `fetchCmsPage`, the same cached read the page itself performs, with the
 * same `cms:page:<slug>` tag. So it is a Data Cache hit rather than a second origin
 * request, and the revalidation webhook that invalidates the page invalidates this at the
 * same moment — which is what makes an unpublish reach the navigation at all.
 *
 * ## An outage is not an unpublish
 *
 * Only an AUTHORITATIVE absence hides the link. On an upstream fault the route still
 * renders a page — the approved bootstrap where the market has one, otherwise the
 * localised "temporarily unavailable" — so removing the link would turn a transient CMS
 * problem into a navigation that looks permanently different. That distinction is the
 * whole point of the four outcomes in `page-route.tsx`.
 */
export async function cmsRouteAvailable(channel: string, slug: string): Promise<boolean> {
	if (!marketHasRoute(REVERSE_MAP[channel] ?? "", slug)) return false;

	const locale = payloadLocaleForChannel(channel);
	const market = marketForChannel(channel);
	// No Payload mapping is a configuration fault, not an editorial decision. Treat it
	// like an outage and keep the link, which matches what the route itself will render.
	if (!locale || !market) return true;

	const outcome = await fetchCmsPage(slug, locale, market);
	if (outcome.status === "not-found" || outcome.status === "market-mismatch") return false;
	// Published but with no body for this market is an authoritative absence too, and the
	// contract is explicit that it is not a valid navigation, sitemap or hreflang target.
	if (outcome.status === "found" && !isContentReady(slug, outcome.page.layout)) return false;
	return true;
}

/** Whether `segment` is a CMS-backed route, and so needs the check above. */
export function isCmsRoute(segment: string): boolean {
	return routePolicyFor(segment)?.kind === "cms";
}

/**
 * Filter a set of navigation links to the ones this market may actually show.
 *
 * One rule for the header and the footer, because they had two and they disagreed.
 * Task A taught the footer to hide a legal route a market does not have; the header
 * kept linking `/poradna` in all twelve markets while eleven of them answer 404 — a
 * dead link in the primary navigation of every page, on every market but Slovakia.
 *
 * A link is dropped only when this module is entitled to an opinion:
 *
 *   not a market-root segment  the category links (`/stresne-nosice`) are root
 *                              product-catalogue URLs, not entries in `route-policy`.
 *                              They are kept untouched — asking `marketHasRoute` about
 *                              them would answer "no" for every one and empty the menu.
 *   a static route             `marketHasRoute` decides.
 *   a CMS route                `marketHasRoute` first, then whether a document is
 *                              actually published — see `cmsRouteAvailable`.
 */
export async function visibleNavLinks<T extends { readonly href: string }>(
	channel: string,
	links: readonly T[],
): Promise<T[]> {
	const decisions = await Promise.all(
		links.map(async (link) => {
			const segment = link.href.replace(/^\//, "").split("/")[0] ?? "";
			if (!isMarketRootSegment(segment)) return true;
			if (!marketHasRoute(REVERSE_MAP[channel] ?? "", segment)) return false;
			return isCmsRoute(segment) ? cmsRouteAvailable(channel, segment) : true;
		}),
	);
	return links.filter((_, index) => decisions[index]);
}

/**
 * The live markets that have this CMS route AND a published, content-ready document.
 *
 * Route support and publication are different questions, and `route-policy.ts` only
 * answers the first. A market can support `/o-nas`, be live, and have nothing
 * published — or have a document with no body for it. Neither is an hreflang alternate
 * or a sitemap entry, and until now both were.
 *
 * ## Why this is affordable
 *
 * It asks only about markets the static policy already allows, and only for CMS
 * routes. Today `o-nas` is `sk` alone, so it is one question. When more markets open
 * it is one question per market — but `fetchCmsPage` is keyed by (slug, locale) in the
 * Data Cache, so the twelve markets collapse to at most ten reads, all cache hits
 * after the first, all carrying the `cms:page:<slug>` tag that the publish webhook
 * already invalidates. That is the existing cached read, not a second availability
 * table and not twelve uncached requests per page.
 */
export async function publishedCmsMarkets(slug: string): Promise<readonly string[]> {
	const candidates = liveMarkets().filter((market) => marketHasRoute(market, slug));
	const available = await Promise.all(
		candidates.map(async (market) => {
			const channel = CHANNEL_MAP[market]?.saleorSlug;
			return channel && (await cmsRouteAvailable(channel, slug)) ? market : null;
		}),
	);
	return available.filter((market): market is string => market !== null);
}

/**
 * `hreflang` map for a CMS route, filtered to markets that really serve it.
 *
 * Reuses `languageAlternatesFor` so the URL shape, the locale mapping and the
 * "a cluster of one says nothing" rule are the same ones the static routes use.
 */
export async function cmsLanguageAlternates(slug: string): Promise<Record<string, string> | undefined> {
	return languageAlternatesFor(await publishedCmsMarkets(slug), `/${slug}`);
}
