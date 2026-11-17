import { meaningfulTitle } from "@/config/brand";

/**
 * CFM's way of getting a `<title>` longer than Saleor's `seoTitle` field (70 characters) to the page.
 * Saleor refuses a longer value together with the whole product, so CFM sends the field a version fitted
 * at a word boundary and, when the whole title does not fit, writes the whole one to the product's public
 * metadata under `maky_seo_title:<language>` (`maky_seo_title:sk`, `maky_seo_title:de`). The page takes
 * its `<title>` from the key of its own language when it is there, and from `seoTitle` otherwise, so a
 * product without the key is drawn as before. Contract: `docs/contracts/seo-title.md`.
 */
export const SEO_TITLE_METADATA_PREFIX = "maky_seo_title:";

/** The language of a market's locale, as the key names it: `de-AT` is `de`. */
const languageOf = (locale: string) => locale.split(/[-_]/)[0].toLowerCase();

/**
 * The whole title CFM kept for this market's language, or null. A value that says nothing but the shop's
 * name is not a title (`meaningfulTitle`), as for `seoTitle`. The key of another language is never read.
 */
export function metadataSeoTitle(
	metadata: readonly { key: string; value: string }[] | null | undefined,
	locale: string,
): string | null {
	const key = `${SEO_TITLE_METADATA_PREFIX}${languageOf(locale)}`;
	const found = metadata?.find((entry) => entry.key === key);
	return meaningfulTitle(found?.value);
}
