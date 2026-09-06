import { type WithContext, type Product, type ProductGroup } from "schema-dts";
import { carriesInternalMarker } from "@/lib/product-code";
import { seoConfig, getBaseUrl } from "./config";

/**
 * Whether a SKU may be published in structured data.
 *
 * Callers are expected to pass a value already resolved by `publicSku`. This is
 * the backstop for when one does not, which is not hypothetical: the PDP shipped
 * `sourceSku || sku` for months and put MAKY's internal identifier into the
 * `sku` Google reads on 94% of pages. A builder whose whole job is what gets
 * published should not depend on every caller remembering.
 */
function publishableSku(value: string | null | undefined): value is string {
	return Boolean(value) && !carriesInternalMarker(value);
}

/**
 * The one `cfm_availability_mode` value this catalogue publishes. Compared as a
 * plain string because it arrives as one, straight off a Saleor metafield.
 */
const SALE_TO_ORDER = "sale_to_order";

export interface JsonLdVariant {
	sku?: string | null;
	name?: string | null;
	price?: { amount: number; currency: string } | null;
	inStock?: boolean;
	availabilityMode?: string | null;
}

/** Schema.org availability, from the same facts the visible badge uses. */
function availabilityOf(inStock: boolean, availabilityMode?: string | null) {
	if (!inStock) return "https://schema.org/OutOfStock" as const;
	return availabilityMode === SALE_TO_ORDER
		? ("https://schema.org/BackOrder" as const)
		: ("https://schema.org/InStock" as const);
}

/**
 * Product JSON-LD structured data builder
 *
 * Creates Schema.org Product markup for rich Google search results.
 * This helps your products appear with prices, availability, and images in search.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 *
 * @example
 * const jsonLd = buildProductJsonLd({
 *   name: product.name,
 *   description: product.seoDescription,
 *   images: product.media?.map(m => m.url),
 *   sku: publicSku(variant),
 *   brand: product.brand,
 *   url: `/products/${product.slug}`,
 *   price: { amount: 29.99, currency: "USD" },
 *   inStock: true,
 * });
 *
 * // In your page:
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 */
export function buildProductJsonLd(options: {
	name: string;
	description?: string;
	images?: string[];
	sku?: string | null;
	brand?: string | null;
	url?: string;
	/** Single variant pricing */
	price?: {
		amount: number;
		currency: string;
	} | null;
	/** Price range for products with variants */
	priceRange?: {
		lowPrice: number;
		highPrice: number;
		currency: string;
	} | null;
	/**
	 * Whether anything on this product is orderable at all. A hard no still wins
	 * over `availabilityMode` below — nothing orderable is orderable-on-demand.
	 */
	inStock?: boolean;
	/**
	 * CFM's `cfm_availability_mode` metafield, verbatim.
	 *
	 * `sale_to_order` is the whole catalogue: dropship items with
	 * `trackInventory=false` and no stock records, for which Saleor answers
	 * `quantityAvailable` with a synthetic configuration cap of 50. Declaring
	 * InStock off that number is a stock claim the business cannot honour, and
	 * repeating the 50 as an `inventoryLevel` would put a fabricated quantity in
	 * front of a crawler. Schema.org has the right term already — BackOrder is
	 * "orderable, not held" — so the mode is transported rather than inferred.
	 *
	 * Same decision as the visible badge in
	 * `src/ui/components/product/availability-badge.tsx`, in the same precedence,
	 * so the markup and the page never disagree.
	 */
	availabilityMode?: string | null;
	variantCount?: number;
	/**
	 * One entry per purchasable variant, when the page knows them.
	 *
	 * Supplying these is what lets a multi-variant product be described as a
	 * `ProductGroup` whose members each carry their own SKU, price and
	 * availability, instead of one blurred price band.
	 */
	variants?: readonly JsonLdVariant[];
}): WithContext<Product> | WithContext<ProductGroup> | null {
	if (!seoConfig.enableJsonLd) {
		return null;
	}

	const {
		name,
		description,
		images,
		sku,
		brand,
		url,
		price,
		priceRange,
		inStock = true,
		availabilityMode,
		variantCount,
		variants,
	} = options;

	const baseUrl = getBaseUrl();
	const fullUrl = url ? `${baseUrl}${url}` : undefined;
	const availability = availabilityOf(inStock, availabilityMode);

	const seller = { "@type": "Organization" as const, name: seoConfig.organizationName };

	const base = {
		"@context": "https://schema.org" as const,
		name,
		description: description || name,
		...(images && images.length > 0 ? { image: images } : {}),
		...(brand && { brand: { "@type": "Brand" as const, name: brand } }),
	};

	// A product with a real choice of variants is a ProductGroup, and each member
	// carries its OWN sku, price and availability.
	//
	// This used to be one `AggregateOffer` with a low/high band, which is not a
	// description of variants — and because the PDP passes `priceRange` and never
	// `price`, EVERY product got that treatment, including the single-variant ones
	// that are the entire live catalogue. A band from 299 to 299 with
	// `offerCount: 1` says less than the price does, and hides the SKU that
	// identifies what is actually being sold.
	const purchasable = (variants ?? []).filter((variant) => variant.price);
	if (purchasable.length > 1) {
		return {
			...base,
			"@type": "ProductGroup",
			...(publishableSku(sku) ? { productGroupID: sku } : {}),
			hasVariant: purchasable.map((variant) => ({
				"@type": "Product" as const,
				name: variant.name || name,
				...(publishableSku(variant.sku) ? { sku: variant.sku } : {}),
				offers: {
					"@type": "Offer" as const,
					url: fullUrl,
					availability: availabilityOf(
						variant.inStock ?? inStock,
						variant.availabilityMode ?? availabilityMode,
					),
					priceCurrency: variant.price!.currency,
					price: variant.price!.amount,
					seller,
				},
			})),
		} satisfies WithContext<ProductGroup>;
	}

	// One variant, or none we can price: an exact Offer.
	const only = purchasable[0];
	const exact = only?.price ?? price ?? null;
	// The variant carries the availability facts when it has them — the top-level
	// values are the fallback for a caller that knows no variants, not an override.
	const offerAvailability = only
		? availabilityOf(only.inStock ?? inStock, only.availabilityMode ?? availabilityMode)
		: availability;
	const offers = exact
		? {
				"@type": "Offer" as const,
				url: fullUrl,
				availability: offerAvailability,
				priceCurrency: exact.currency,
				price: exact.amount,
				seller,
			}
		: priceRange
			? {
					// Kept only for a product whose variants are unknown to the caller.
					// A single-variant product must never reach this arm.
					"@type": "AggregateOffer" as const,
					url: fullUrl,
					availability,
					priceCurrency: priceRange.currency,
					lowPrice: priceRange.lowPrice,
					highPrice: priceRange.highPrice,
					offerCount: variantCount,
					seller,
				}
			: undefined;

	// The variant's own SKU wins: it identifies what is actually being sold.
	const resolvedSku = [only?.sku, sku].find(publishableSku) ?? undefined;

	return {
		...base,
		"@type": "Product",
		...(resolvedSku ? { sku: resolvedSku } : {}),
		...(offers ? { offers } : {}),
	} satisfies WithContext<Product>;
}

/**
 * BreadcrumbList JSON-LD.
 *
 * Google renders the trail in place of the raw URL in results, which on mobile is
 * the difference between "maky.store › sk › gp-peruzzo-nosic-2-bicyklov-pz-gp019…"
 * and "Domov › Nosiče bicyklov › GP/Peruzzo nosič na 2 bicykle".
 *
 * Crumbs without an `href` (the current page) still get a position — the spec wants
 * the full trail — but no `item`, which is how you mark the terminal entry.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export function buildBreadcrumbJsonLd(items: { label: string; href?: string }[]) {
	if (items.length < 2) return null;

	const base = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.label,
			...(item.href ? { item: item.href.startsWith("http") ? item.href : `${base}${item.href}` } : {}),
		})),
	};
}

/**
 * JSON-LD Script component helper
 *
 * @example
 * <script {...jsonLdScriptProps(productJsonLd)} />
 */
export function jsonLdScriptProps(data: object | null) {
	if (!data) return null;
	return {
		type: "application/ld+json",
		dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
	};
}
