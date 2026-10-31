import type { ProductListItemFragment } from "@/gql/graphql";
import type { ProductCardData } from "./product-card";
import { publicProductCode } from "@/lib/product-code";
import { getColorHex, isColorAttribute, isSizeAttribute } from "@/lib/colors";
import { sortSizes } from "@/lib/sizes";
import { getLocaleConfigByLocale, getLocaleFromChannel, localeConfig } from "@/config/locale";
import { hasDiscountInPriceRange } from "@/lib/pricing";
import { productHref } from "@/lib/product-url";
import { KARGO_CATEGORY_SLUGS } from "@/config/kargo-slugs";
import { formatAttributeValue } from "@/lib/product-attributes";
import { publishableProductImage } from "@/lib/product-image";
import { BARS_SPEC_KEY, DIMENSIONS_SPEC_KEY, type ListingSpec } from "@/ui/components/listing/listing-specs";

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

/**
 * The parameters a card prints, most telling first, for products that are NOT vehicle sets (a set's
 * parameters come from CFM's facets — `lib/fitment/offer-specs`). What separates two roof boxes is
 * the volume, two bike carriers the count, two fridges the capacity and the power; whatever the
 * product carries is shown, whatever it lacks is simply absent — never a "–", never a default.
 *
 * Labels are the attribute's own translated name, so a German card says "Volumen" because Saleor's
 * German translation of the attribute does.
 */
const SPEC_REFS = [
	"cfm:attribute:volume",
	"cfm:attribute:net_volume",
	"cfm:attribute:bike_capacity",
	"cfm:attribute:ski_snowboard_capacity",
	"cfm:attribute:ski_count",
	"cfm:attribute:max_load",
	"cfm:attribute:max_load_per_bike",
	"cfm:attribute:rated_power",
	"cfm:attribute:temperature_min",
	"cfm:attribute:weight",
] as const;

const DIMENSION_REFS = [
	"cfm:attribute:outer_length",
	"cfm:attribute:outer_width",
	"cfm:attribute:outer_height",
] as const;

const isKargoSlug = (slug: string | null | undefined) => (slug ? KARGO_CATEGORY_SLUGS.includes(slug) : false);

/**
 * What a Nordrive Kargo basket or bar kit adds to those: the material it is made of. Asked for only on that
 * shelf — a `material` attribute on another shelf's products is not a card parameter there.
 */
const KARGO_SPEC_REFS = ["cfm:attribute:material"] as const;

/** The further attributes a card of the product's category prints, by the category's base slug. */
export const specRefsFor = (categorySlug: string | null | undefined): readonly string[] =>
	isKargoSlug(categorySlug) ? KARGO_SPEC_REFS : [];

/** A kit of loose bars: how many, and how long each one is (cm). */
const BAR_COUNT_REF = "cfm:attribute:bar_count";
const BAR_LENGTH_REF = "cfm:attribute:bar_length";

/** A card is a summary: four parameters, the rest is on the product page. */
const MAX_CARD_SPECS = 4;

export function buildCardSpecs(
	attributes: ListAttributes,
	locale: string,
	/** Further attributes this shelf's cards print, after the common ones. */
	extraRefs: readonly string[] = [],
): ListingSpec[] {
	const specs: ListingSpec[] = [];
	for (const ref of [...SPEC_REFS, ...extraRefs]) {
		const attr = attributes?.find((a) => a.attribute.externalReference === ref);
		const raw = attr?.values[0]?.name;
		if (!attr || !raw || !attr.attribute.name) continue;
		specs.push({
			key: ref,
			label: attr.attribute.name,
			value: formatAttributeValue(raw, attr.attribute, locale),
		});
	}

	// "190 × 80 × 40 cm" — the three outer measurements as one fact, only when all three exist:
	// two of three is not a size.
	const sizes = DIMENSION_REFS.map((ref) => {
		const attr = attributes?.find((a) => a.attribute.externalReference === ref);
		const raw = attr?.values[0]?.name;
		return attr && raw ? { attr, raw } : null;
	});
	if (sizes.every(Boolean)) {
		const parts = sizes.map((size) => formatAttributeValue(size!.raw, size!.attr.attribute, locale));
		const unit = parts.map((part) => part.replace(/^[\d\s.,]+/, "").trim()).find(Boolean) ?? "";
		const numbers = parts.map((part) => part.replace(/[^\d\s.,]+$/, "").trim());
		specs.push({
			key: DIMENSIONS_SPEC_KEY,
			// The word is the card's to say (a translation context lives there, not here).
			label: "",
			value: `${numbers.join(" × ")}${unit ? ` ${unit}` : ""}`,
		});
	}

	// "4 × 180 cm" — the bars of a kit as one fact, only when both the count and the length exist.
	const count = attributes?.find((a) => a.attribute.externalReference === BAR_COUNT_REF);
	const length = attributes?.find((a) => a.attribute.externalReference === BAR_LENGTH_REF);
	const countRaw = count?.values[0]?.name;
	const lengthRaw = length?.values[0]?.name;
	if (count && length && countRaw && lengthRaw) {
		specs.push({
			key: BARS_SPEC_KEY,
			label: "",
			value: `${formatAttributeValue(countRaw, count.attribute, locale)} × ${formatAttributeValue(
				lengthRaw,
				length.attribute,
				locale,
			)}`,
		});
	}

	return specs.slice(0, MAX_CARD_SPECS);
}

/**
 * The product's real photographs, in the gallery's order. A video shares the list and is not a
 * photograph; the grey "no image" GIF is not one either. A fixture without a `type` counts as an
 * image — the field only ever says VIDEO for the one thing that is not.
 */
function galleryImages(media: ProductListItemFragment["cardMedia"]): string[] {
	return (media ?? [])
		.filter((item) => (item as { type?: string }).type !== "VIDEO")
		.map((item) => publishableProductImage(item.url))
		.filter((url): url is string => Boolean(url));
}

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
export function transformToProductCard(
	product: ProductListItemFragment,
	channel: string,
	locale: string = getLocaleFromChannel(channel),
): ProductCardData {
	const localeConfig = getLocaleConfigByLocale(locale);
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

	const gallery = galleryImages(product.cardMedia);

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
		note: buildNote(product.attributes, locale),
		// The declared short code, not `variant.sku`. The SKU is the integration
		// identity and carries a CFM-internal suffix on the bundle products, which
		// the card printed verbatim under a "SKU:" label.
		productCode: publicProductCode(soleVariant),
		variantId: soleVariant?.id ?? null,
		quantityAvailable: soleVariant?.quantityAvailable ?? null,
		trackInventory: soleVariant?.trackInventory ?? null,
		availabilityMode: soleVariant?.metafield ?? null,
		rating: product.rating ?? null,
		price: startPrice?.amount ?? 0,
		compareAtPrice: isSale ? undiscountedStartPrice?.amount : null,
		currency: startPrice?.currency ?? localeConfig.fallbackCurrency,
		// The "no image" GIF some imports carry is no image either — `lib/product-image.ts`.
		// When it is the thumbnail, the gallery's first real photo stands in, as on the PDP.
		image: publishableProductImage(product.thumbnail?.url) ?? gallery[0] ?? "/placeholder.svg",
		imageAlt: product.thumbnail?.alt ?? product.name,
		// The second photograph of the gallery. The first is the thumbnail (or the one standing in for
		// it), so whichever way the main image was found, this is the next one — and absent when the
		// product has only one, in which case the card simply does not swap.
		hoverImage: gallery[1] ?? null,
		specs: buildCardSpecs(product.attributes, locale, specRefsFor(product.category?.slug)),
		href: productHref(channel, product.slug),
		channel,
		isPurchasable: product.isAvailableForPurchase === true,
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
