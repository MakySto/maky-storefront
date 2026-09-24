/**
 * The grey "no image" placeholder some products were imported with — recognised by content.
 *
 * Part of the catalogue carries a 100×100 grey GIF reading "no image" as a PRODUCT IMAGE,
 * where it should carry no image at all: 108 of the 414 non-roof-rack products in Slovakia,
 * 80 of them with nothing else (measured 2026-09-22). Published as a photo it is worse than
 * none. It becomes the product's image in Google's results and in structured data, the
 * share card of the page, and the picture in every listing — a grey square that looks like
 * a fault in the shop. The storefront has its own localized "no image" state; that is what
 * these products should show.
 *
 * Every cdn.maky.store URL of that file carries its content hash, `c32bc543a46f5bf4…`, in
 * the file name — the stored original and each rendition Saleor makes from it, e.g.
 *
 *   https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff_thumbnail_4.gif
 *
 * The hash is what identifies it, not the size: a genuine product photo can be small too.
 * Matching is on the URL's path, case-insensitively.
 *
 * One blind spot, stated so nobody mistakes it for coverage: a rendition Saleor has not
 * generated yet is served as `api.maky.store/thumbnail/<media id>/<size>/…`, a URL with no
 * file name in it. That URL is transient — Saleor answers with the CDN file once the
 * rendition exists — and the PDP gallery reads `media.url`, which is always the stored file.
 *
 * This module is the ONLY place that knows the hash. Every path that chooses a product
 * image asks it: the PDP gallery (and with it the product JSON-LD and og:image), the listing
 * card, search results, the homepage list and the configurator's offers.
 */
const PLACEHOLDER_CONTENT_HASH = "c32bc543a46f5bf4";

/**
 * A red warning triangle with no text (225 px), in the galleries of 51 products — G3 and
 * Northline roof boxes among them. It is never a gallery's first file, but on five it comes
 * straight after the "no image" GIF, so once the GIF was dropped their product page OPENED on
 * it, and it was their share image and the image Google read from the structured data
 * (G3 Arjes 280, measured on maky.store 2026-09-24). A pictogram that says nothing about the
 * product is no more a photo of it than the GIF is. Same identification, by content hash.
 */
const WARNING_PICTOGRAM_CONTENT_HASH = "74d87407e7026263";

const NOT_A_PRODUCT_PHOTO = [PLACEHOLDER_CONTENT_HASH, WARNING_PICTOGRAM_CONTENT_HASH] as const;

/** Is this one of the files above — an image in a gallery that is not a picture of the product? */
export function isPlaceholderProductImage(url: string | null | undefined): boolean {
	if (!url) return false;
	let pathname: string;
	try {
		// A base, so a relative path (`/placeholder.svg`) parses instead of throwing.
		pathname = new URL(url, "https://cdn.maky.store").pathname.toLowerCase();
	} catch {
		return false;
	}
	return NOT_A_PRODUCT_PHOTO.some((hash) => pathname.includes(hash));
}

/** The URL when it is an image worth publishing; `null` when it is missing or the placeholder. */
export function publishableProductImage(url: string | null | undefined): string | null {
	return url && !isPlaceholderProductImage(url) ? url : null;
}
