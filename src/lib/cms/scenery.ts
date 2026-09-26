import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cmsMediaObjectPosition, type CmsBlock } from "./blocks";
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

/** One placed photo: its URL and where to crop it — the editor's focal point. */
export type CmsSceneryPhoto = {
	readonly url: string;
	/** `object-position`, `<focalX>% <focalY>%` (pages contract v3 §2); `50% 50%` when unset. */
	readonly position: string;
};

export type CmsScenery = {
	readonly hero: CmsSceneryPhoto | null;
	readonly advice: CmsSceneryPhoto | null;
	/** By category base slug. */
	readonly tiles: Readonly<Record<string, CmsSceneryPhoto>>;
	/** By category base slug. */
	readonly banners: Readonly<Record<string, CmsSceneryPhoto>>;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pure half of `getCmsScenery`, exported for its test: page blocks → placed photos. */
export function sceneryFromBlocks(blocks: readonly CmsBlock[]): CmsScenery {
	const scenery = { hero: null, advice: null, tiles: {}, banners: {} } as {
		hero: CmsSceneryPhoto | null;
		advice: CmsSceneryPhoto | null;
		tiles: Record<string, CmsSceneryPhoto>;
		banners: Record<string, CmsSceneryPhoto>;
	};
	for (const block of blocks) {
		const anchor = block.anchorId?.trim().toLowerCase();
		if (!anchor) continue;
		const media = block.blockType === "image" ? block.media : block.blockType === "hero" ? block.media : null;
		if (!media) continue;
		const photo: CmsSceneryPhoto = { url: media.url, position: cmsMediaObjectPosition(media) };
		// The first block for a placement wins, as it would read top to bottom in the editor.
		if (anchor === "home-hero") scenery.hero ??= photo;
		else if (anchor === "advice") scenery.advice ??= photo;
		else if (anchor.startsWith("tile-") && SLUG.test(anchor.slice(5)))
			scenery.tiles[anchor.slice(5)] ??= photo;
		else if (anchor.startsWith("banner-") && SLUG.test(anchor.slice(7)))
			scenery.banners[anchor.slice(7)] ??= photo;
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
