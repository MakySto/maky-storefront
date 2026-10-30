import "server-only";

/**
 * The products a product description names in the contents of its box, as this market's catalogue
 * answers for them.
 *
 * CFM writes a part of a set as a box item with the Saleor id of the part's published product
 * (`docs/contracts/maky-content.md`, `maky:inbox`). The id is asked here, anonymously and per
 * channel, and what comes back is judged exactly as every other product the storefront links to:
 * the part must be published in this channel (the anonymous catalogue answers for nothing else) and complete in this market's language (the
 * exact-locale boundary), and the link is the market's own page of it. A part that fails any of it
 * is simply not in the answer, and its item is drawn without picture and link: no id is turned into
 * an address by guessing, and a withdrawn part cannot leave a link to a page that answers 404.
 */

import { FitmentProductsByIdsDocument } from "@/gql/graphql";
import { getLocaleConfigByLocale } from "@/config/locale";
import { type ContentProduct } from "@/lib/editorjs";
import { executePublicGraphQL } from "@/lib/graphql";
import { productHref } from "@/lib/product-url";
import { publishableProductImage } from "@/lib/product-image";
import { resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";

const THUMBNAIL_WIDTH = 256;

/** The optimizer's address for a Saleor thumbnail (the width the part's picture is drawn at, twice). */
function optimizedImage(url: string | null | undefined): string | null {
	const publishable = publishableProductImage(url);
	return publishable ? `/_next/image?url=${encodeURIComponent(publishable)}&w=${THUMBNAIL_WIDTH}&q=75` : null;
}

/**
 * Never throws: a catalogue outage leaves the map empty and the boxes are drawn as plain items,
 * which is what they were before the document named any product.
 */
export async function resolveContentProducts(
	ids: readonly string[],
	channel: string,
	locale: string,
): Promise<ReadonlyMap<string, ContentProduct>> {
	const found = new Map<string, ContentProduct>();
	if (ids.length === 0) return found;
	try {
		const result = await executePublicGraphQL(FitmentProductsByIdsDocument, {
			variables: {
				ids: [...ids],
				channel,
				first: ids.length,
				lang: getLocaleConfigByLocale(locale).graphqlLanguageCode,
			},
			revalidate: 300,
		});
		if (!result.ok) {
			console.error("[content-products] catalogue lookup failed:", result.error);
			return found;
		}
		for (const edge of result.data.products?.edges ?? []) {
			const localized = resolveExactLocaleProduct(edge.node, locale);
			if (!localized) continue;
			found.set(edge.node.id, {
				href: productHref(channel, localized.slug),
				image: optimizedImage(localized.thumbnail?.url),
			});
		}
	} catch (error) {
		console.error("[content-products] catalogue lookup threw:", error);
	}
	return found;
}
