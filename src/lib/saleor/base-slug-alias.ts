import { isSourceLocale, TRANSLATED_SLUG_PATTERN } from "@/lib/saleor/exact-locale";

/**
 * A foreign market's product, asked for by its Slovak (base) slug: where it really lives.
 *
 * `lookupBySlug` asks the base row first, so abroad a product is found under its Slovak slug too
 * and the page was served there, 200 and indexable, beside the market's own address
 * (`/de/snehove-retaze-…-n16283`, 27 November 2026). The product the page has ALREADY read says
 * both things needed to tell: the slug it was found by (`baseSlug`) and the market's own (`slug`).
 * So this decides from that read and asks Saleor nothing.
 *
 * It replaces a question the proxy put to Saleor for every foreign product address (PR 155):
 * nearly every address a crawler asks for is a different one, so the answer was almost never
 * remembered and Saleor got about 1.5 extra requests a second, the same evening its other
 * answers to the page started to miss their deadlines.
 *
 * Null unless ALL of it holds: a foreign market, the request spelled the base slug exactly, and
 * the market's own slug is a different, clean URL segment. Slovakia never moves (its slug IS the
 * base row), a product whose two slugs are the same string never moves (five CoolZ in Czechia),
 * and a product reached through the old-slug shim is not this case (its URL is not its base slug).
 * `MAKY_BASE_SLUG_REDIRECT=off` turns it off with a restart.
 */
export function baseSlugAliasTarget(
	requestedSlug: string,
	product: { readonly slug: string; readonly baseSlug: string },
	locale: string,
): string | null {
	if (process.env.MAKY_BASE_SLUG_REDIRECT?.trim().toLowerCase() === "off") return null;
	if (isSourceLocale(locale)) return null;

	let requested = requestedSlug;
	try {
		// The page receives the segment as Next hands it over; the lookup decodes it the same way.
		requested = decodeURIComponent(requestedSlug);
	} catch {
		return null;
	}

	if (requested !== product.baseSlug) return null;
	if (product.slug === requested || !TRANSLATED_SLUG_PATTERN.test(product.slug)) return null;
	return product.slug;
}
