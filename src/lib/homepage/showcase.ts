import { cacheLife, cacheTag } from "next/cache";
import { HomeCategoryImagesDocument, HomeHeroProductDocument } from "@/gql/graphql";
import { formatPrice, getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { categoriesFor } from "@/config/categories";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { productHref } from "@/lib/product-url";
import { resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { publishableProductImage } from "@/lib/product-image";
import { HERO_SCENERY } from "@/config/storefront-imagery";

/**
 * What the homepage shows from Saleor besides the featured collection and the scenery: each
 * category's own image (the tile's fallback when no scenery photo is set for it) and the product
 * the hero photo shows. Both are read-only and cached like the pages they sit beside, under the
 * tags the existing `/api/revalidate` events already expire, so a change in Saleor reaches the
 * homepage without a deploy.
 */

/** Category slug (the Slovak base slug from `@/config/categories`) → photo URL. */
export type CategoryImages = Readonly<Record<string, string>>;

/**
 * Photos decorate; they never hold the page up. One attempt with a deadline instead of the
 * transport's 1 + 2 + 4 s retry ladder, as for the product page's market presence query.
 */
const PHOTO_DEADLINE_MS = 1_500;

export async function getHomeCategoryImages(channel: string): Promise<CategoryImages> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const slugs = categoriesFor("home").map((category) => category.slug);

	// A category event (a new photo included) expires `category:{channel}:{locale}:{slug}`.
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	for (const slug of slugs) cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug }));

	const result = await executePublicGraphQL(HomeCategoryImagesDocument, {
		variables: { slugs },
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(PHOTO_DEADLINE_MS),
	});
	if (!result.ok) {
		// A tile without a photo still names its category and links to it. Nothing is invented
		// in its place, and a fault is not cached as "no photos".
		throw new Error(`[Homepage] category images unavailable: ${result.error.message}`);
	}

	const images: Record<string, string> = {};
	for (const { node } of result.data.categories?.edges ?? []) {
		if (node.backgroundImage?.url) images[node.slug] = node.backgroundImage.url;
	}
	return images;
}

/**
 * The product the hero photo shows, as this market sells it: the floating card over the photo.
 *
 * The photo itself is scenery (`getScenery`) and appears in every market; this is the label. It
 * goes through the same exact-locale check as every product card, so a market where the product
 * is not fully translated — or not sold — gets the photo without a card. Chosen by id, never slug:
 * a product's slug changes whenever the catalogue renames it, its id does not.
 */
export type HeroShowcase = {
	product: {
		name: string;
		href: string;
		price: string | null;
		image: string | null;
		/** The product's category in this market's words — "Strešné boxy". */
		category: string | null;
	} | null;
};

export async function getHeroShowcase(channel: string): Promise<HeroShowcase | null> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	cacheLife(CACHE_PROFILES.products.cacheProfile);

	const result = await executePublicGraphQL(HomeHeroProductDocument, {
		variables: { id: HERO_SCENERY.photo.productId, channel, lang },
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(PHOTO_DEADLINE_MS),
	});
	if (!result.ok) throw new Error(`[Homepage] hero product unavailable: ${result.error.message}`);

	const product = result.data.product;
	if (!product) return null;
	// The product's own event (a new photo, a price, a rename) expires this entry too.
	cacheTag(buildTag(CACHE_PROFILES.products, { channel, locale, slug: product.slug }));

	const localized = resolveExactLocaleProduct(product, locale);
	const gross = localized?.pricing?.priceRange?.start?.gross;
	return {
		product: localized
			? {
					name: localized.name,
					href: productHref(channel, localized.slug),
					price: gross ? formatPrice(gross.amount, gross.currency, locale) : null,
					image: publishableProductImage(localized.thumbnail?.url) ?? null,
					category: localized.category?.name ?? null,
				}
			: null,
	};
}
