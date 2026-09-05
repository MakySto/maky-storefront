import { getColorHex, isColorAttribute } from "@/lib/colors";

/**
 * The attributes a cart line shows to explain WHICH variant was bought.
 *
 * Lifted out of `cart-drawer.tsx` so it can be tested: vitest collects only
 * `.test.ts` files, so nothing inside a `.tsx` is reachable from the suite —
 * which is part of why this code sat dead for so long without anyone noticing.
 */
interface VariantAttribute {
	name: string;
	value: string;
	colorHex?: string;
	isColor: boolean;
}

type AttributeSource = {
	selectionAttributes: ReadonlyArray<{
		attribute: { name?: string | null; slug?: string | null };
		values: ReadonlyArray<{ name?: string | null; value?: string | null }>;
	}>;
};

/**
 * Read the selection attributes of a checkout line's variant.
 *
 * Selection attributes ONLY. The non-selection list is technical specification —
 * weight, load rating, material — and belongs on the product page rather than
 * stacked under every line of a cart.
 *
 * This used to read `variant.attributes`, a field `CheckoutFind` never returns:
 * the query aliases the two Saleor lists as `selectionAttributes` and
 * `nonSelectionAttributes`. The result was always `[]`, so every drawer line fell
 * through to the bare variant name and the colour swatches never appeared.
 */
export function getVariantDetails(variant: AttributeSource): VariantAttribute[] {
	const result: VariantAttribute[] = [];

	for (const attr of variant.selectionAttributes ?? []) {
		const slug = attr.attribute.slug || "";
		const name = attr.attribute.name || slug;
		const value = attr.values[0];

		// An attribute with no value says nothing; rendering the label alone would
		// read as a missing answer rather than an absent question.
		if (!value?.name) continue;

		const isColor = isColorAttribute(slug);
		result.push({
			name,
			value: value.name,
			colorHex: isColor ? getColorHex(value) : undefined,
			isColor,
		});
	}

	// Colour first: it is the attribute a shopper scans for.
	return result.sort((a, b) => (a.isColor === b.isColor ? 0 : a.isColor ? -1 : 1));
}
