import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type CmsBlock } from "./blocks";
import { cmsCollectionTag, cmsPageTag } from "./cache-tags";
import { fetchCmsPage } from "./client";
import { marketForChannel, payloadLocaleForMarket } from "./markets";

/**
 * The owner's scenery photos from Payload: the homepage hero, the homepage category tiles, the
 * category banners and the advice card (owner, 2026-09-24: "obrázky pre bannery a kategórie na
 * homepage budeme ťahať z Payloadu").
 *
 * No new Payload schema. The photos live on one ordinary Page, `storefront-obrazky`, as `image`
 * blocks (or `hero` blocks with media), each placed by its **anchor ID**:
 *
 *   home-hero                  the homepage hero
 *   advice                     the advice card on the homepage
 *   tile-<category slug>       a homepage tile, e.g. `tile-stresne-nosice`
 *   banner-<category slug>     a category banner, e.g. `banner-stresne-boxy`
 *
 * The category slug is Saleor's base slug. The block's `markets` field limits a photo to some
 * markets, as on every CMS page. The page is published and read like any other — anonymous,
 * published only, validated by the same parser — and it has no route: no storefront URL renders
 * it. A publish expires this answer through the webhook's page and collection tags.
 *
 * A photo here wins over the Saleor photo configured in `storefront-imagery.ts`; a placement
 * with no block keeps that one.
 */
export const CMS_SCENERY_SLUG = "storefront-obrazky";

export type CmsScenery = {
	readonly hero: string | null;
	readonly advice: string | null;
	/** By category base slug. */
	readonly tiles: Readonly<Record<string, string>>;
	/** By category base slug. */
	readonly banners: Readonly<Record<string, string>>;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pure half of `getCmsScenery`, exported for its test: page blocks → placed photos. */
export function sceneryFromBlocks(blocks: readonly CmsBlock[]): CmsScenery {
	const scenery = { hero: null as string | null, advice: null as string | null, tiles: {}, banners: {} } as {
		hero: string | null;
		advice: string | null;
		tiles: Record<string, string>;
		banners: Record<string, string>;
	};
	for (const block of blocks) {
		const anchor = block.anchorId?.trim().toLowerCase();
		if (!anchor) continue;
		const url =
			block.blockType === "image" ? block.media.url : block.blockType === "hero" ? block.media?.url : null;
		if (!url) continue;
		// The first block for a placement wins, as it would read top to bottom in the editor.
		if (anchor === "home-hero") scenery.hero ??= url;
		else if (anchor === "advice") scenery.advice ??= url;
		else if (anchor.startsWith("tile-") && SLUG.test(anchor.slice(5))) scenery.tiles[anchor.slice(5)] ??= url;
		else if (anchor.startsWith("banner-") && SLUG.test(anchor.slice(7)))
			scenery.banners[anchor.slice(7)] ??= url;
	}
	return scenery;
}

/**
 * This market's scenery photos from Payload, or `null` when the page is not published for it.
 *
 * A fault THROWS, so it is never cached as "no photos": an unreachable CMS must not keep the
 * owner's banners off the site for hours after it recovers. The caller falls back to the Saleor
 * photos meanwhile.
 */
export async function getCmsScenery(channel: string): Promise<CmsScenery | null> {
	"use cache";
	cacheLife("hours");
	const pageTag = cmsPageTag(CMS_SCENERY_SLUG);
	const collectionTag = cmsCollectionTag("pages");
	if (pageTag) cacheTag(pageTag);
	if (collectionTag) cacheTag(collectionTag);

	const market = marketForChannel(channel);
	if (!market) return null;

	const outcome = await fetchCmsPage(CMS_SCENERY_SLUG, payloadLocaleForMarket(market), market);
	if (outcome.status === "error") throw new Error(`[Scenery] CMS unavailable: ${outcome.reason}`);
	if (outcome.status !== "found") return null;
	return sceneryFromBlocks(outcome.page.layout);
}
