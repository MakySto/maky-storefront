import { type WithContext, type Product } from "schema-dts";
import { seoConfig, getBaseUrl } from "./config";

/**
 * The one `cfm_availability_mode` value this catalogue publishes. Compared as a
 * plain string because it arrives as one, straight off a Saleor metafield.
 */
const SALE_TO_ORDER = "sale_to_order";

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
 *   sku: variant?.sku,
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
	mpn?: string | null;
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
}): WithContext<Product> | null {
	if (!seoConfig.enableJsonLd) {
		return null;
	}

	const {
		name,
		description,
		images,
		sku,
		mpn,
		brand,
		url,
		price,
		priceRange,
		inStock = true,
		availabilityMode,
		variantCount,
	} = options;

	const baseUrl = getBaseUrl();
	const fullUrl = url ? `${baseUrl}${url}` : undefined;
	const availability = !inStock
		? ("https://schema.org/OutOfStock" as const)
		: availabilityMode === SALE_TO_ORDER
			? ("https://schema.org/BackOrder" as const)
			: ("https://schema.org/InStock" as const);
	const offers = price
		? {
				"@type": "Offer" as const,
				url: fullUrl,
				availability,
				priceCurrency: price.currency,
				price: price.amount,
				seller: {
					"@type": "Organization" as const,
					name: seoConfig.organizationName,
				},
			}
		: priceRange
			? {
					"@type": "AggregateOffer" as const,
					url: fullUrl,
					availability,
					priceCurrency: priceRange.currency,
					lowPrice: priceRange.lowPrice,
					highPrice: priceRange.highPrice,
					offerCount: variantCount,
					seller: {
						"@type": "Organization" as const,
						name: seoConfig.organizationName,
					},
				}
			: undefined;

	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name,
		description: description || name,
		...(images && images.length > 0 ? { image: images } : {}),
		...(sku && { sku }),
		...(mpn && { mpn }),
		...(brand && { brand: { "@type": "Brand" as const, name: brand } }),
		...(offers ? { offers } : {}),
	};
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
