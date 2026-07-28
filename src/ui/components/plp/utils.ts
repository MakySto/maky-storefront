import type { ProductListItemFragment } from "@/gql/graphql";
import type { ProductCardData } from "./product-card";
import { getColorHex, isColorAttribute, isSizeAttribute } from "@/lib/colors";
import { sortSizes } from "@/lib/sizes";
import { localeConfig } from "@/config/locale";
import { hasDiscountInPriceRange } from "@/lib/pricing";
import { productHref } from "@/lib/product-url";
import { formatAttributeValue } from "@/lib/product-attributes";

const MANUFACTURER_REF = "cfm:attribute:manufacturer";

/**
 * Attribute used for the card's one-line note, most specific first.
 *
 * The note answers "what size / how many" at a glance — the question that
 * actually separates two roof boxes in a grid. Whatever the product happens to
 * carry wins; a product with none of them simply gets no note rather than a
 * padded-out placeholder.
 */
const NOTE_REFS = [
	"cfm:attribute:volume",
	"cfm:attribute:bike_capacity",
	"cfm:attribute:max_load",
	"cfm:attribute:ski_snowboard_capacity",
	"cfm:attribute:weight",
] as const;

type ListAttributes = ProductListItemFragment["attributes"];

const attributeValue = (attributes: ListAttributes, ref: string) =>
	attributes?.find((a) => a.attribute.externalReference === ref)?.values[0]?.name ?? null;

function buildNote(attributes: ListAttributes, locale: string): string | null {
	for (const ref of NOTE_REFS) {
		const attr = attributes?.find((a) => a.attribute.externalReference === ref);
		const raw = attr?.values[0]?.name;
		if (attr && raw) {
			// Labelled: "590 l" alone is a riddle in a grid, "Objem 590 l" is not.
			const value = formatAttributeValue(raw, attr.attribute, locale);
			return attr.attribute.name ? `${attr.attribute.name}: ${value}` : value;
		}
	}
	return null;
}

/**
 * Extract colors from product variants
 */
function extractColorsFromVariants(
	variants: ProductListItemFragment["variants"],
): { name: string; hex: string }[] {
	const colorSet = new Map<string, string>();

	variants?.forEach((variant) => {
		variant.selectionAttributes?.forEach((attr) => {
			if (isColorAttribute(attr.attribute?.slug ?? "")) {
				attr.values?.forEach((value) => {
					const colorName = value.name;
					if (colorName && !colorSet.has(colorName)) {
						const hex = getColorHex(value) ?? "#6b7280"; // Default gray if no match
						colorSet.set(colorName, hex);
					}
				});
			}
		});
	});

	return Array.from(colorSet.entries()).map(([name, hex]) => ({ name, hex }));
}

/**
 * Extract sizes from product variants
 */
function extractSizesFromVariants(variants: ProductListItemFragment["variants"]): string[] {
	const sizeSet = new Set<string>();

	variants?.forEach((variant) => {
		variant.selectionAttributes?.forEach((attr) => {
			if (isSizeAttribute(attr.attribute?.slug ?? "")) {
				attr.values?.forEach((value) => {
					if (value.name) {
						sizeSet.add(value.name);
					}
				});
			}
		});
	});

	// Sort sizes in logical order (S, M, L, XL or numeric)
	return sortSizes(Array.from(sizeSet));
}

/**
 * Transform Saleor product data to ProductCard format
 */
export function transformToProductCard(product: ProductListItemFragment, channel: string): ProductCardData {
	const startPrice = product.pricing?.priceRange?.start?.gross;
	const undiscountedStartPrice = product.pricing?.priceRangeUndiscounted?.start?.gross;

	// Use centralized pricing logic to detect if ANY variant is on sale
	const isSale = hasDiscountInPriceRange(
		product.pricing?.priceRange,
		product.pricing?.priceRangeUndiscounted,
	);

	// Extract colors and sizes from variants
	const colors = extractColorsFromVariants(product.variants);
	const sizes = extractSizesFromVariants(product.variants);

	const variants = product.variants ?? [];
	// Card-level add-to-cart only makes sense when there is nothing to choose.
	// Anything with a real variant choice sends the customer to the detail page.
	const soleVariant = variants.length === 1 ? variants[0] : null;

	return {
		id: product.id,
		name: product.name,
		slug: product.slug,
		// Manufacturer, not category: `brand` used to be filled with
		// `category.name`, so every card in "Strešné boxy" claimed the brand
		// was "Strešné boxy".
		brand: attributeValue(product.attributes, MANUFACTURER_REF),
		note: buildNote(product.attributes, localeConfig.default),
		sku: soleVariant?.sku ?? null,
		variantId: soleVariant?.id ?? null,
		quantityAvailable: soleVariant?.quantityAvailable ?? null,
		availabilityMode: soleVariant?.metafield ?? null,
		rating: product.rating ?? null,
		price: startPrice?.amount ?? 0,
		compareAtPrice: isSale ? undiscountedStartPrice?.amount : null,
		currency: startPrice?.currency ?? localeConfig.fallbackCurrency,
		image: product.thumbnail?.url ?? "/placeholder.svg",
		imageAlt: product.thumbnail?.alt ?? product.name,
		hoverImage: null, // Would need additional media in fragment
		href: productHref(channel, product.slug),
		channel,
		badge: isSale ? "sale" : null,
		colors,
		sizes,
		category: product.category
			? { id: product.category.id, name: product.category.name, slug: product.category.slug }
			: null,
		createdAt: product.created,
		hasVariants: (product.variants?.length ?? 0) > 1,
	};
}

/**
 * Format price with currency
 */
export function formatPrice(amount: number, currency: string): string {
	return new Intl.NumberFormat(localeConfig.default, {
		style: "currency",
		currency: currency,
	}).format(amount);
}
