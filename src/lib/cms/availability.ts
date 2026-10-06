import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isCategorySlug } from "@/config/categories";
import { stockedBrandSlugs } from "@/lib/brands/catalog";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { CMS_PAGE_CACHE_LIFE } from "@/lib/cms/cache-life";
import { cmsCollectionTag, cmsPageTag } from "@/lib/cms/cache-tags";
import { fetchCmsPage } from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel, type MarketCode, type PayloadLocale } from "@/lib/cms/markets";
import { isContentReady } from "@/lib/cms/content-readiness";
import { liveMarkets } from "@/lib/market-state";
import { isMarketRootSegment, marketHasRoute, routePolicyFor } from "@/lib/route-policy";
import { getMarketAssortment, offersCategory, type MarketAssortment } from "@/lib/market-assortment";
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
 * The answer comes from the same CMS document the page itself reads, under the same
 * `cms:page:<slug>` tag (see `readCmsPublication`), so the revalidation webhook that
 * invalidates the page invalidates this at the same moment — which is what makes an
 * unpublish reach the navigation at all.
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

	return readCmsPublication(slug, locale, market);
}

/**
 * Whether the CMS holds a published, content-ready document for `slug` in this market — the
 * CMS half of `cmsRouteAvailable`.
 *
 * ## Why this read is a `"use cache"` function and not a bare `fetchCmsPage`
 *
 * The footer (every page) and the homepage's advice section ask this question inline, outside
 * any `<Suspense>`, so the answer has to be in hand when the static shell is decided. Next
 * decides it in two passes: the first runs the page and fills a resume cache, the second
 * renders again from that cache and turns whatever is still waiting on I/O into a dynamic hole.
 *
 * A bare `fetch` gets through the second pass only while Next answers it from the Data Cache,
 * and Next stops doing that for an on-demand revalidation: its `fetch` then skips the Data
 * Cache and the resume cache with it, so the second pass goes to the network again and is cut
 * off before the answer arrives. A shell is regenerated that way when it has EXPIRED, and when
 * `/api/revalidate` expires one of its tags (it uses `{ expire: 0 }`, deliberately). The hole
 * sits outside a boundary, the render fails with `NEXT_STATIC_GEN_BAILOUT`, and whoever asks
 * first gets a 500 — on every page, because the footer is in the shared layout. That is the
 * homepage that "occasionally" answered 500 on the first request after a quiet hour.
 *
 * `"use cache"` entries are read from the resume cache before anything else, on-demand or not,
 * so the second pass finds the answer the first one stored. Do not turn this back into a plain
 * `fetchCmsPage` call, and do not add another uncached read to a component that renders
 * outside `<Suspense>`.
 *
 * ## A fault keeps the link, and is remembered for minutes only
 *
 * The other cached readers THROW on a fault, so that an unreachable CMS is never remembered as
 * an answer. This one cannot: it runs in the footer of every page, and an error thrown out of a
 * `"use cache"` function is not caught by its caller — Next runs the function again while it
 * decides the shell, it throws again, and the whole render fails. One CMS outage during a
 * regeneration would be a 500 on every page. So an unknown answer is `true` (see "An outage is
 * not an unpublish" above) and the entry shortens its own life to the `minutes` profile.
 */
async function readCmsPublication(slug: string, locale: PayloadLocale, market: MarketCode): Promise<boolean> {
	"use cache";
	cacheLife(CMS_PAGE_CACHE_LIFE);
	const pageTag = cmsPageTag(slug);
	const collectionTag = cmsCollectionTag("pages");
	if (pageTag) cacheTag(pageTag);
	if (collectionTag) cacheTag(collectionTag);

	const outcome = await fetchCmsPage(slug, locale, market);
	if (outcome.status === "error") {
		cacheLife("minutes");
		return true;
	}
	if (outcome.status !== "found") return false; // not-found, market-mismatch: authoritative absence
	// Published but with no body for this market is an authoritative absence too, and the
	// contract is explicit that it is not a valid navigation, sitemap or hreflang target.
	return isContentReady(slug, outcome.page.layout);
}

/** Whether `segment` is a CMS-backed route, and so needs the check above. */
export function isCmsRoute(segment: string): boolean {
	return routePolicyFor(segment)?.kind === "cms";
}

/**
 * The brand index (`/znacky`) lists the makers this channel sells. Abroad that is none today — the
 * Nordrive sets carry no maker in Saleor — and the page was an empty, indexable list linked from
 * every page. Only an authoritative empty answer hides the link; a fault keeps it.
 */
const BRANDS_SEGMENT = "znacky";

async function brandsOffered(channel: string): Promise<boolean> {
	try {
		return (await stockedBrandSlugs(channel)).size > 0;
	} catch {
		return true;
	}
}

/**
 * Filter a set of navigation links to the ones this market may actually show.
 *
 * One rule for the header, the menus and the footer, because they had two and they disagreed.
 * Task A taught the footer to hide a legal route a market does not have; the header kept linking
 * `/poradna` in all twelve markets while eleven of them answer 404 — a dead link in the primary
 * navigation of every page, on every market but Slovakia.
 *
 * A link is dropped only when this module is entitled to an opinion:
 *
 *   a catalogue category       offered in this market — `lib/market-assortment.ts`, the same
 *                              question the sitemap asks. Abroad every channel held only the
 *                              roof-rack sets while five more categories were linked from every
 *                              page (2026-09-25). An UNKNOWN assortment keeps them all.
 *   not a market-root segment  anything else outside `route-policy` is kept untouched.
 *   a static route             `marketHasRoute` decides; `/znacky` also needs a maker to list.
 *   a CMS route                `marketHasRoute` first, then whether a document is
 *                              actually published — see `cmsRouteAvailable`.
 */
export async function visibleNavLinks<T extends { readonly href: string }>(
	channel: string,
	links: readonly T[],
): Promise<T[]> {
	// Asked once per call, and only when a category link is in the set.
	let assortment: Promise<MarketAssortment> | null = null;
	const decisions = await Promise.all(
		links.map(async (link) => {
			const segment = link.href.replace(/^\//, "").split("/")[0] ?? "";
			if (isCategorySlug(segment)) {
				assortment ??= getMarketAssortment(channel);
				return offersCategory(await assortment, segment);
			}
			if (!isMarketRootSegment(segment)) return true;
			if (!marketHasRoute(REVERSE_MAP[channel] ?? "", segment)) return false;
			if (segment === BRANDS_SEGMENT) return brandsOffered(channel);
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
