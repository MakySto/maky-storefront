import { cacheLife, cacheTag } from "next/cache";
import { HomeImageryDocument } from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { publishableProductImage } from "@/lib/product-image";
import { getCmsScenery, type CmsScenery, type CmsSceneryPhoto } from "@/lib/cms/scenery";
import {
	ADVICE_SCENERY,
	BANNER_SCENERY,
	HERO_SCENERY,
	TILE_SCENERY,
	sceneryProductIds,
	type SceneryPhoto,
} from "@/config/storefront-imagery";

/** A photo ready to paint: its URL, where its subject sits (wide and tall), and whose it is. */
export type SceneryImage = {
	readonly url: string;
	readonly position: string;
	readonly mobilePosition: string;
	/**
	 * `saleor`: a product photo from the shop's own galleries, configured in code.
	 * `cms`: the owner's photo from Payload — an illustration, which never names a product as
	 * being "in the photo".
	 */
	readonly source: "saleor" | "cms";
};

export type Scenery = {
	readonly hero: SceneryImage | null;
	readonly advice: SceneryImage | null;
	/** By category base slug. */
	readonly tiles: Readonly<Record<string, SceneryImage>>;
	/** By category base slug. */
	readonly banners: Readonly<Record<string, SceneryImage>>;
};

/**
 * Where the photos are read from. Images are not per market — a photo is the same in every
 * channel — and the products they belong to are listed in the Slovak channel, so the scenery is
 * the same in every market even where the product itself is not sold.
 */
const SOURCE_CHANNEL = CHANNEL_MAP.sk.saleorSlug;

/** Scenery decorates; it never holds a page up. One attempt with a deadline. */
const SCENERY_DEADLINE_MS = 2_000;

/** The cache tag for every scenery answer, expired by a deploy or by hand. */
export const SCENERY_CACHE_TAG = "scenery";

/**
 * The configured scenery photos, resolved to their stored files.
 *
 * Cached for hours: the configuration is code, and a photo that disappears from a gallery is
 * rare enough that serving its old URL for an hour is the right trade against a Saleor request
 * per render. A fault throws, so it is never cached as "no photos".
 */
export async function getScenery(): Promise<Scenery> {
	"use cache";
	cacheLife("hours");
	cacheTag(SCENERY_CACHE_TAG);

	const result = await executePublicGraphQL(HomeImageryDocument, {
		variables: { ids: sceneryProductIds(), channel: SOURCE_CHANNEL },
		revalidate: 3600,
		retry: false,
		signal: AbortSignal.timeout(SCENERY_DEADLINE_MS),
	});
	if (!result.ok) throw new Error(`[Scenery] photos unavailable: ${result.error.message}`);

	const urls = new Map<string, string>();
	for (const { node } of result.data.products?.edges ?? []) {
		for (const media of node.media ?? []) {
			const url = publishableProductImage(media.url);
			if (url) urls.set(`${node.id}/${media.id}`, url);
		}
	}
	return resolveScenery(urls);
}

/** Pure half of `getScenery`, exported for the test: configuration + stored files → scenery. */
export function resolveScenery(urls: ReadonlyMap<string, string>): Scenery {
	const image = (photo: SceneryPhoto | undefined): SceneryImage | null => {
		if (!photo) return null;
		const url = urls.get(`${photo.productId}/${photo.mediaId}`);
		if (!url) return null;
		const position = photo.position ?? "50% 50%";
		return { url, position, mobilePosition: photo.mobilePosition ?? position, source: "saleor" };
	};
	const bySlug = (config: Readonly<Partial<Record<string, SceneryPhoto>>>) => {
		const out: Record<string, SceneryImage> = {};
		for (const [slug, photo] of Object.entries(config)) {
			const resolved = image(photo);
			if (resolved) out[slug] = resolved;
		}
		return out;
	};
	return {
		hero: image(HERO_SCENERY.photo),
		advice: image(ADVICE_SCENERY),
		tiles: bySlug(TILE_SCENERY),
		banners: bySlug(BANNER_SCENERY),
	};
}

/**
 * The scenery for one market: the owner's photos from Payload where published for a placement
 * (`getCmsScenery`), the configured Saleor photos everywhere else. Never throws — a fault in
 * either source leaves the other, and both failing answers `null`.
 */
export async function getSceneryOrNone(channel: string): Promise<Scenery | null> {
	const [saleor, cms] = await Promise.all([
		getScenery().catch((error: unknown) => {
			console.warn("[Scenery] Saleor photos left out:", error instanceof Error ? error.message : error);
			return null;
		}),
		getCmsScenery(channel).catch((error: unknown) => {
			console.warn("[Scenery] CMS photos left out:", error instanceof Error ? error.message : error);
			return null;
		}),
	]);
	return mergeScenery(saleor, cms);
}

/**
 * Pure, exported for the test: a CMS photo replaces the Saleor one for its placement.
 *
 * A CMS photo is cropped around the editor's focal point (pages contract v3 §2) on every
 * screen: Payload has one focal point per picture, not one per breakpoint.
 */
export function mergeScenery(saleor: Scenery | null, cms: CmsScenery | null): Scenery | null {
	if (!saleor && !cms) return null;
	const fromCms = (photo: CmsSceneryPhoto): SceneryImage => ({
		url: photo.url,
		position: photo.position,
		mobilePosition: photo.position,
		source: "cms",
	});
	const bySlug = (
		base: Readonly<Record<string, SceneryImage>>,
		extra: Readonly<Record<string, CmsSceneryPhoto>>,
	) => ({
		...base,
		...Object.fromEntries(Object.entries(extra).map(([slug, photo]) => [slug, fromCms(photo)])),
	});
	return {
		hero: cms?.hero ? fromCms(cms.hero) : saleor?.hero ?? null,
		advice: cms?.advice ? fromCms(cms.advice) : saleor?.advice ?? null,
		tiles: bySlug(saleor?.tiles ?? {}, cms?.tiles ?? {}),
		banners: bySlug(saleor?.banners ?? {}, cms?.banners ?? {}),
	};
}
