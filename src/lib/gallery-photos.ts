import { isPlaceholderProductImage } from "@/lib/product-image";

/**
 * A photograph in a product description is the same file as one in the product's gallery: CFM
 * uploads the gallery to Saleor from `https://carfitmanager.com/media/…` and writes the same address
 * into the text. Saleor keeps its own copy, so the page can show that copy and need not ask the
 * CFM server for it. CFM leaves the address the copy came from on the gallery item's public
 * metadata under `cfm_source_url`; this finds the item by it.
 *
 * A photograph with no match (an item CFM has not marked yet, or one the gallery does not hold)
 * stays as the text has it. The rewrite changes where a picture comes from, never whether it shows.
 */
export const GALLERY_SOURCE_KEY = "cfm_source_url";

/** Where Saleor serves its own media: the two hosts `next.config.js` already knows. Anything else is not taken. */
const SALEOR_MEDIA = /^https:\/\/(?:cdn|api)\.maky\.store\/[^\s"'<>?#]+$/;

type MetadataRow = { key: string; value: string };

export type PhotoSourceMedia = {
	url: string;
	/** `url(size: 1024, format: WEBP)`: the copy a description shows, already at its size. */
	photo?: string | null;
	type?: string | null;
	metadata?: readonly MetadataRow[] | null;
};

export function galleryPhotoMap(media: readonly PhotoSourceMedia[] | null | undefined): Map<string, string> {
	const photos = new Map<string, string>();
	for (const item of media ?? []) {
		const copy = item.photo ?? "";
		if (item.type !== "IMAGE" || isPlaceholderProductImage(item.url) || !SALEOR_MEDIA.test(copy)) continue;
		const source = item.metadata?.find((row) => row.key === GALLERY_SOURCE_KEY)?.value.trim();
		// First item wins: Saleor hands the media in gallery order, and two items that claim one
		// source are the same photograph.
		if (source && !photos.has(source)) photos.set(source, copy);
	}
	return photos;
}

/**
 * The Editor.js document of a description with its photographs pointed at the gallery's copies.
 * Anything that is not a readable Editor.js document comes back untouched.
 */
export function withGalleryPhotos<T extends string | null | undefined>(
	description: T,
	media: readonly PhotoSourceMedia[] | null | undefined,
): T | string {
	if (!description) return description;
	const photos = galleryPhotoMap(media);
	if (photos.size === 0) return description;
	let document: unknown;
	try {
		document = JSON.parse(description);
	} catch {
		return description;
	}
	const blocks = (document as { blocks?: unknown } | null)?.blocks;
	if (!Array.isArray(blocks)) return description;

	let changed = false;
	for (const block of blocks) {
		if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "image") continue;
		const data = (block as { data?: unknown }).data;
		const file = data && typeof data === "object" ? (data as { file?: unknown }).file : null;
		if (!file || typeof file !== "object") continue;
		const url = (file as { url?: unknown }).url;
		const copy = typeof url === "string" ? photos.get(url.trim()) : undefined;
		if (copy) {
			(file as { url: string }).url = copy;
			changed = true;
		}
	}
	return changed ? JSON.stringify(document) : description;
}
