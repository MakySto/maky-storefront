import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { rememberBriefly } from "@/lib/cache-fault";
import { CMS_PAGE_CACHE_LIFE } from "@/lib/cms/cache-life";
import { cmsCollectionTag, cmsPageTag } from "@/lib/cms/cache-tags";
import { fetchCmsPage, type CmsPageOutcome } from "@/lib/cms/client";
import type { MarketCode, PayloadLocale } from "@/lib/cms/markets";

/**
 * What the CMS says about one published page, for a route that renders it (`cmsPageRoute`).
 *
 * ## Why a route does not call `fetchCmsPage` itself
 *
 * A page component reads this outside any `<Suspense>`, so the answer has to be in hand when the
 * static shell is decided. Next decides it in two passes: the first runs the page and fills a
 * resume cache, the second renders again from that cache and turns whatever is still waiting on
 * I/O into a dynamic hole — which, outside a boundary, fails the render with
 * `NEXT_STATIC_GEN_BAILOUT` and answers the first visitor with a 500.
 *
 * A bare `fetch` gets through the second pass only while Next answers it from the Data Cache, and
 * Next stops doing that for an on-demand revalidation: its `fetch` then skips the Data Cache and
 * the resume cache with it, so the second pass goes to the network again and is cut off before the
 * answer arrives. A shell is regenerated that way when it has EXPIRED, and when `/api/revalidate`
 * expires one of its tags (it uses `{ expire: 0 }`, deliberately). `"use cache"` entries are read
 * from the resume cache before anything else, on-demand or not, so the second pass finds what the
 * first one stored. See `readCmsPublication` in `availability.ts`, which has the same shape for
 * the footer's question and has the full account.
 *
 * ## A fault is an answer that is kept briefly, not a failure
 *
 * This one returns the `error` outcome as a value and shortens the entry's life: the route has a
 * floor for exactly that case (the bootstrap, or the localised "temporarily unavailable"), and an
 * error thrown out of a `"use cache"` function is not seen by the route at all — it fails the
 * prerender that is waiting for it, whether or not the route would have caught it
 * (`@/lib/cache-fault`). So an outage while a shell is being regenerated must not turn into a 500
 * on a page that has a fallback, and it is forgotten again within seconds.
 */
export async function readPublishedCmsPage(
	slug: string,
	locale: PayloadLocale,
	market: MarketCode,
): Promise<CmsPageOutcome> {
	"use cache";
	cacheLife(CMS_PAGE_CACHE_LIFE);
	const pageTag = cmsPageTag(slug);
	const collectionTag = cmsCollectionTag("pages");
	if (pageTag) cacheTag(pageTag);
	if (collectionTag) cacheTag(collectionTag);

	const outcome = await fetchCmsPage(slug, locale, market);
	if (outcome.status === "error") rememberBriefly();
	return outcome;
}
