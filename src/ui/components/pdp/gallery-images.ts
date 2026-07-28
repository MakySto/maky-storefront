export type GalleryMedia = {
	url: string;
	alt?: string | null;
	type?: string | null;
};

export type GalleryImage = { url: string; alt: string | null | undefined };

type GalleryProduct = {
	media?: readonly GalleryMedia[] | null;
	thumbnail?: { url: string; alt?: string | null } | null;
	variants?: readonly unknown[] | null;
};

type GalleryVariant = { media?: readonly GalleryMedia[] | null } | null | undefined;

const images = (media: readonly GalleryMedia[] | null | undefined): GalleryImage[] =>
	(media ?? []).filter((item) => item.type === "IMAGE").map((item) => ({ url: item.url, alt: item.alt }));

/**
 * The PDP gallery, in the order Saleor holds the media — primary first.
 *
 * Saleor variant media is an ADDITIONAL assignment and always a subset of the
 * product's media, never a replacement gallery. Preferring it whenever it is
 * non-empty collapses an 11-image product down to the single hero image that
 * happens to be assigned to its variant — which is exactly what the CFM catalog
 * does: one sale-to-order variant with the primary image assigned to it.
 *
 * So variant media only wins where it carries meaning: a product with a real
 * choice of variants, where each one shows its own images.
 */
export function getGalleryImages(product: GalleryProduct, selectedVariant: GalleryVariant): GalleryImage[] {
	const productImages = images(product.media);
	const variantImages = images(selectedVariant?.media);

	const hasVariantChoice = (product.variants?.length ?? 0) > 1;
	if (hasVariantChoice && variantImages.length > 0) {
		return variantImages;
	}

	if (productImages.length > 0) {
		return productImages;
	}

	if (variantImages.length > 0) {
		return variantImages;
	}

	if (product.thumbnail) {
		return [{ url: product.thumbnail.url, alt: product.thumbnail.alt }];
	}

	return [];
}
