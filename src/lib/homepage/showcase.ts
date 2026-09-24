import { cacheLife, cacheTag } from "next/cache";
import { HomeCategoryImagesDocument, HomeHeroProductDocument } from "@/gql/graphql";
import { formatPrice, getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { categoriesFor } from "@/config/categories";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { productHref } from "@/lib/product-url";
import { resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";

/**
 * What the homepage shows from Saleor besides the featured collection: the photo of each
 * category tile and the lifestyle photo in the hero. Both are read-only and cached like the
 * pages they sit beside, under the tags the existing `/api/revalidate` events already expire,
 * so a new photo in Saleor reaches the homepage without a deploy.
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
 * The hero photo: a lifestyle shot from the gallery of one product, chosen by id.
 *
 * Ids, not slugs: a product's slug changes whenever the catalogue renames it (CFM has done
 * so across thousands of products), its id and its media ids do not. The owner approved using
 * the Thule photos in Saleor on the homepage, hero included; they are served from our CDN at
 * request time and are never committed to this public repository (CLAUDE.md §10.1).
 */
export const HERO_SHOWCASE = {
	/** Strešný box Thule Motion 3 – XL – Titan Glossy (639801). */
	productId: "UHJvZHVjdDozMDU=",
	/** The car in front of the wooden wall, box on the roof. */
	mediaId: "UHJvZHVjdE1lZGlhOjgyMQ==",
} as const;

export type HeroShowcase = {
	imageUrl: string;
	/** Present only when the product is sold in this market under this market's own name. */
	product: { name: string; href: string; price: string | null } | null;
};

export async function getHeroShowcase(channel: string): Promise<HeroShowcase | null> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	cacheLife(CACHE_PROFILES.products.cacheProfile);

	const result = await executePublicGraphQL(HomeHeroProductDocument, {
		variables: { id: HERO_SHOWCASE.productId, channel, lang },
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(PHOTO_DEADLINE_MS),
	});
	if (!result.ok) throw new Error(`[Homepage] hero product unavailable: ${result.error.message}`);

	const product = result.data.product;
	if (!product) return null;
	// The product's own event (a new photo, a price, a rename) expires this entry too.
	cacheTag(buildTag(CACHE_PROFILES.products, { channel, locale, slug: product.slug }));

	const media = product.media?.find((item) => item.id === HERO_SHOWCASE.mediaId);
	if (!media?.url) return null;

	// The label goes through the same exact-locale check as every product card: a market
	// where the product is not fully translated gets the photo without a name or a link.
	const localized = resolveExactLocaleProduct(product, locale);
	const gross = localized?.pricing?.priceRange?.start?.gross;
	return {
		imageUrl: media.url,
		product: localized
			? {
					name: localized.name,
					href: productHref(channel, localized.slug),
					price: gross ? formatPrice(gross.amount, gross.currency, locale) : null,
				}
			: null,
	};
}
