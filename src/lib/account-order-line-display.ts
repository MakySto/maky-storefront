import { firstNonEmpty } from "@/checkout/lib/summary-line-names";

/**
 * What a line of an order in the customer's account is CALLED, in the language of the market the
 * page is read in — the same rule as the cart, the checkout summary and the PDP.
 *
 * `product.name` is Saleor's base row (Slovak). The query asks for the translation in the market's
 * exact language code (`DE_AT`, `EN_CA`, …); when the product has none, the name the order itself
 * was placed under (`translatedProductName`) is the next best, and the base row is the last resort.
 * The link follows the same translation: the market's own slug, the base slug only as a fallback.
 */
interface AccountOrderLine {
	translatedProductName?: string | null;
	translatedVariantName?: string | null;
}

interface AccountOrderVariant {
	id: string;
	name?: string | null;
	translation?: { name?: string | null } | null;
	product: {
		name: string;
		slug: string;
		translation?: { name?: string | null; slug?: string | null } | null;
	};
}

export interface AccountOrderLineDisplay {
	readonly productName: string;
	readonly productSlug: string;
	/** The variant label, or null when there is none worth showing. */
	readonly variantName: string | null;
}

export function accountOrderLineDisplay(
	line: AccountOrderLine,
	variant: AccountOrderVariant,
): AccountOrderLineDisplay {
	const variantName = firstNonEmpty(variant.translation?.name, line.translatedVariantName, variant.name);
	return {
		productName: firstNonEmpty(
			variant.product.translation?.name,
			line.translatedProductName,
			variant.product.name,
		),
		productSlug: firstNonEmpty(variant.product.translation?.slug, variant.product.slug),
		// Saleor falls back to the variant id as its name when none was authored.
		variantName: variantName && variantName !== variant.id ? variantName : null,
	};
}
