import { baseSlugOfCategory, type CategoryRef } from "@/config/category-routes";
import { quoteInsteadOfPrice } from "@/config/quote-only";
import { publicSku } from "@/lib/product-code";
import { publicEan } from "@/lib/product-ean";
import { productHref } from "@/lib/product-url";
import { type buildProductJsonLd } from "./json-ld";

/**
 * What the product page says about a product in its structured data, as one function.
 *
 * It lived inline in `[productSlug]/page.tsx`. It moved here, unchanged, when a second reader appeared:
 * the feed for Google Merchant (`lib/merchant-feed/item.ts`). Google compares a feed with the page it
 * links to, price and availability first, and disapproves the product when the two disagree. So the feed
 * does not repeat these rules: it reads this object, the same one the page hands to `buildProductJsonLd`.
 * A rule that changes here changes on the page and in the feed at once.
 */

/** The stable CFM key of the manufacturer attribute. Never the display name, which is translated. */
export const MANUFACTURER_REF = "cfm:attribute:manufacturer";

interface Money {
	amount: number;
	currency: string;
}

export interface OfferVariant {
	id?: string | null;
	name?: string | null;
	sourceSku?: string | null;
	ean?: string | null;
	quantityAvailable?: number | null;
	trackInventory?: boolean | null;
	/** `cfm_availability_mode`, as the GraphQL documents alias it. */
	metafield?: string | null;
	pricing?: { price?: { gross: Money } | null } | null;
}

export interface OfferProduct {
	name: string;
	slug: string;
	seoDescription?: string | null;
	isAvailableForPurchase?: boolean | null;
	category?: CategoryRef | null;
	attributes?:
		| readonly {
				attribute: { externalReference?: string | null };
				values: readonly { name?: string | null }[];
		  }[]
		| null;
	variants?: readonly OfferVariant[] | null;
	pricing?: {
		priceRange?: { start?: { gross: Money } | null; stop?: { gross: Money } | null } | null;
	} | null;
}

export type ProductJsonLdOptions = Parameters<typeof buildProductJsonLd>[0];

/**
 * @param product The product in the market's language (after `resolveExactLocaleProduct`).
 * @param channel The Saleor channel or the market.
 * @param images  The gallery (`getGalleryImages`), which already leaves the "no image" placeholder out.
 */
export function productJsonLdOptions(
	product: OfferProduct,
	channel: string,
	images: readonly { url: string }[],
): ProductJsonLdOptions {
	// The page shows a quote button instead of a price here, so the markup states no price either.
	const quoteOnly = quoteInsteadOfPrice({
		isPurchasable: product.isAvailableForPurchase === true,
		categorySlug: baseSlugOfCategory(channel, product.category),
	});

	return {
		name: product.name,
		description: product.seoDescription || product.name,
		images: images.length > 0 ? images.map((img) => img.url) : undefined,
		// The manufacturer attribute, never the category. `category.name` here
		// declared "Strešné boxy" to be the brand of every roof box in structured
		// data. Same defect the listing card already had fixed; the JSON-LD was
		// missed. Absent attribute → no `brand` key, which is better than a wrong one.
		brand: product.attributes?.find((a) => a.attribute.externalReference === MANUFACTURER_REF)?.values[0]
			?.name,
		// Use the exact-locale slug resolved by the storefront boundary, matching
		// the canonical URL advertised for this localized product.
		url: productHref(channel, product.slug),
		// The market, so the offer states its return window and that the goods are new.
		channel,
		// `sku` only. An `mpn` used to be emitted from the same value, which made
		// MAKY's internal composite identifier a claim about the manufacturer's part
		// number — it is not one, in any reading.
		//
		// Through `publicSku`, never `sourceSku || sku`. That fallback reached raw
		// `variant.sku` whenever CFM had not set `cfm_source_sku` — which is the
		// whole catalogue — and so published the internal identifier to Google on
		// 94% of pages once the Nordrive cohort went live. The visible code has
		// always been correct; only this path bypassed the module that makes it so.
		sku: publicSku(product.variants?.[0]) ?? undefined,
		// The EAN CFM published on the variant, as `gtin13` (or the length it has). `publicEan` and the
		// builder both refuse a number that cannot be a GTIN; a product CFM has none for says nothing.
		gtin: publicEan(product.variants?.[0]) ?? undefined,
		isPurchasable: product.isAvailableForPurchase === true,
		priceRange:
			product.pricing?.priceRange?.start?.gross && !quoteOnly
				? {
						lowPrice: product.pricing.priceRange.start.gross.amount,
						highPrice:
							product.pricing.priceRange.stop?.gross?.amount || product.pricing.priceRange.start.gross.amount,
						currency: product.pricing.priceRange.start.gross.currency,
					}
				: null,
		// The real variants, so a single-variant product gets its EXACT price and
		// SKU in an Offer instead of a 299-to-299 AggregateOffer band, and a
		// multi-variant one becomes a ProductGroup whose members each carry their
		// own. Every product in the live catalogue is single-variant today, so this
		// is the arm that actually renders.
		variants: (product.variants ?? []).map((v) => ({
			sku: publicSku(v),
			gtin: publicEan(v),
			name: v.name,
			// No price in the markup where the page shows none (`config/quote-only.ts`).
			price:
				v.pricing?.price?.gross && !quoteOnly
					? { amount: v.pricing.price.gross.amount, currency: v.pricing.price.gross.currency }
					: null,
			inStock: Boolean(v.quantityAvailable),
			trackInventory: v.trackInventory,
			availabilityMode: v.metafield,
		})),
		inStock: product.variants?.some((v) => v.quantityAvailable) ?? false,
		// The CFM-owned availability fact, taken from the first variant that
		// publishes one — it is a product-level decision that Saleor happens to
		// carry on the variant. Without it the offer said InStock, derived from a
		// `quantityAvailable` of 50 that is a configuration cap rather than stock,
		// on a catalogue that holds none. `sale_to_order` makes it BackOrder, which
		// is what the badge beside the price already tells the customer.
		availabilityMode: product.variants?.find((v) => v.metafield)?.metafield,
		// Real stock only where a variant is tracked AND has quantity; the same test the badge applies.
		trackInventory: product.variants?.some((v) => v.trackInventory === true && Boolean(v.quantityAvailable)),
		variantCount: product.variants?.length ?? 0,
	};
}
