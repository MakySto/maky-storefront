import type { FoundCheckout } from "@/lib/checkout";

/**
 * What one checkout line is CALLED, in the market's own language.
 *
 * Saleor's `product.name` and `category.name` are the base row, which is Slovak. Reading them
 * straight is how a German basket came to hold "Strešný nosič Nordrive Helio Black …" under a
 * product page that said "Dachträger Nordrive Helio Black …" — the same product, named twice,
 * and only one of the two names in the shopper's language.
 *
 * `CheckoutFind` now asks for the translation as well. This is the one place that decides what
 * to do with it, because the cart drawer, the cart page, the checkout summary and the order
 * confirmation all have to agree — a helper each would drift, and the drift would only show on
 * a market nobody is looking at.
 *
 * The base value is the fallback and stays the fallback. A translation can legitimately be
 * absent abroad, and a Slovak name is a much better answer than an empty one; an empty product
 * name in a basket is indistinguishable from a broken cart. `trim()` because Saleor returns an
 * empty string, not null, for a translation row that exists with nothing in it.
 */
export interface CheckoutLineDisplay {
	/** The product name to show. Never empty while Saleor sent one. */
	readonly name: string;
	/** The market's own product slug, for the link back to the PDP. */
	readonly slug: string;
	/** The category name to show, or null when the line carries no category. */
	readonly categoryName: string | null;
	/** True when the market's own translation was used — for tests, not for display. */
	readonly localized: boolean;
}

type CheckoutLine = FoundCheckout["lines"][number];

const firstNonEmpty = (...values: (string | null | undefined)[]): string => {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return "";
};

export function checkoutLineDisplay(line: CheckoutLine): CheckoutLineDisplay {
	const product = line.variant.product;
	const translation = product.translation;
	const category = product.category;

	return {
		name: firstNonEmpty(translation?.name, product.name),
		slug: firstNonEmpty(translation?.slug, product.slug),
		categoryName: firstNonEmpty(category?.translation?.name, category?.name) || null,
		localized: Boolean(translation?.name?.trim()),
	};
}
