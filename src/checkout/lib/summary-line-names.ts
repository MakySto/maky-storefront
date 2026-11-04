/**
 * What a line in the checkout / order summary is CALLED, in the market's own language.
 *
 * Saleor's `product.name` and attribute-value `name` are the base rows, which are Slovak. The
 * checkout queries already ask for `translation(languageCode: $languageCode)` — the market's
 * exact language code, so `DE_AT` in Austria and `EN_CA` in Canada — and this is the one place
 * that decides what to do with it, the same rule the cart (`checkoutLineDisplay`) and the PDP
 * use. Reading `.name` straight is how a German summary came to name a roof rack in Slovak
 * under a German page.
 *
 * The base value stays the fallback: a translation can be absent abroad, and a Slovak name is a
 * much better answer than an empty line in the order summary. `trim()` because Saleor returns
 * an empty string, not null, for a translation row that exists with nothing in it.
 */

type Named = {
	name?: string | null;
	translation?: { name?: string | null } | null;
};

export const firstNonEmpty = (...values: (string | null | undefined)[]): string => {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return "";
};

/** Translated name when the market has one, otherwise the base name, otherwise `fallback`. */
export function localizedName(item: Named | null | undefined, fallback = ""): string {
	return firstNonEmpty(item?.translation?.name, item?.name) || fallback;
}

/** The first value of each variant attribute, in the market's language. Empty values are dropped. */
export function localizedAttributeValues(
	attributes: ReadonlyArray<{ values: ReadonlyArray<Named> }> | null | undefined,
): string[] {
	return (attributes ?? [])
		.map((attribute) => localizedName(attribute.values[0]))
		.filter((name): name is string => name.length > 0);
}

/** An order line keeps the name it was placed under: the translated one, then the base row. */
export function orderLineName(
	line: { translatedProductName?: string | null; productName: string },
	fallback = "",
): string {
	return firstNonEmpty(line.translatedProductName, line.productName) || fallback;
}
