import { isPlaceholderProductImage } from "@/lib/product-image";

export type GalleryMedia = {
	/** Saleor's ProductMedia id — stable across reordering and re-import. */
	id?: string | null;
	url: string;
	alt?: string | null;
	type?: string | null;
	sortOrder?: number | null;
};

export type GalleryImage = { id?: string | null; url: string; alt: string | null | undefined };

type GalleryProduct = {
	media?: readonly GalleryMedia[] | null;
	thumbnail?: { url: string; alt?: string | null } | null;
	variants?: readonly unknown[] | null;
};

type GalleryVariant = { media?: readonly GalleryMedia[] | null } | null | undefined;

// The "no image" placeholder is not a product image — see `lib/product-image.ts`. Dropping it
// here is what keeps it out of the gallery, the product JSON-LD and og:image at once, since
// the PDP takes all three from this function.
const images = (media: readonly GalleryMedia[] | null | undefined): GalleryImage[] =>
	(media ?? [])
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => item.type === "IMAGE" && !isPlaceholderProductImage(item.url))
		.sort((a, b) => {
			const aHasOrder = typeof a.item.sortOrder === "number";
			const bHasOrder = typeof b.item.sortOrder === "number";

			if (aHasOrder && bHasOrder) {
				return a.item.sortOrder! - b.item.sortOrder! || a.index - b.index;
			}
			if (aHasOrder) return -1;
			if (bHasOrder) return 1;
			return a.index - b.index;
		})
		.map(({ item }) => ({ id: item.id, url: item.url, alt: item.alt }));

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

	if (product.thumbnail && !isPlaceholderProductImage(product.thumbnail.url)) {
		// The thumbnail is a rendition, not a media row, so it has no media id.
		return [{ url: product.thumbnail.url, alt: product.thumbnail.alt }];
	}

	// Nothing publishable: the gallery shows its localized "no image" state, and the page
	// falls back to the generic share card.
	return [];
}
