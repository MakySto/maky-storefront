import { type WithContext, type Product, type ProductGroup } from "schema-dts";
import { companyInfo } from "@/config/company";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
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
	trackInventory?: boolean | null;
	availabilityMode?: string | null;
}

/** Schema.org availability, from the same facts the visible badge uses. */
function availabilityOf(inStock: boolean, availabilityMode?: string | null, trackInventory?: boolean | null) {
	if (!inStock) return "https://schema.org/OutOfStock" as const;
	// Real tracked stock wins over stale sourcing metadata, matching the badge.
	if (trackInventory === true) return "https://schema.org/InStock" as const;

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
	 * Channel-level purchase switch. A hard false overrides stock and sale-to-order
	 * metadata because an offer that cannot be bought is neither InStock nor BackOrder.
	 */
	isPurchasable?: boolean;
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
		isPurchasable = true,
		availabilityMode,
		variantCount,
		variants,
	} = options;

	const baseUrl = getBaseUrl();
	const fullUrl = url ? `${baseUrl}${url}` : undefined;
	const availability = availabilityOf(isPurchasable && inStock, availabilityMode);

	// A reference to the shop the homepage describes in full, not a second, nameless
	// organisation per product — see `organizationReference`.
	const seller = organizationReference();

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
						isPurchasable && (variant.inStock ?? inStock),
						variant.availabilityMode ?? availabilityMode,
						variant.trackInventory,
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
		? availabilityOf(
				isPurchasable && (only.inStock ?? inStock),
				only.availabilityMode ?? availabilityMode,
				only.trackInventory,
			)
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

// ============================================================================
// The shop itself: OnlineStore + WebSite, on every market homepage
// ============================================================================

/**
 * The one identity every page's markup points at.
 *
 * A fragment on the site root rather than a page URL, because the organisation is not any
 * one page. The `@id` is what joins the homepage's `OnlineStore`, the `WebSite` that names
 * it as publisher, and every product's `offers.seller` into a single node — without it a
 * crawler sees twelve homepages and nine thousand offers each describing a different,
 * anonymous "MAKY.STORE".
 */
export function organizationId(): string {
	return `${getBaseUrl()}/#organization`;
}

export function websiteId(): string {
	return `${getBaseUrl()}/#website`;
}

/** What a product's offer names as its seller: a pointer to the node above, not a copy of it. */
export function organizationReference() {
	return { "@type": "Organization" as const, "@id": organizationId(), name: seoConfig.organizationName };
}

/**
 * The deer on brown, a 512×512 PNG from `public/`. Google asks for a logo of at least
 * 112×112 px that works on a white background; this one is square and fully opaque.
 */
const ORGANIZATION_LOGO_PATH = "/android-chrome-512x512.png";

/**
 * The page that explains returns, under the market prefix. The legal slugs are Slovak in
 * every market (`/de/reklamacie-a-vratenie`), and `route-policy.ts` serves this one in all
 * twelve — the test asserts both, so a market losing the page cannot keep a link to a 404.
 */
export const RETURNS_PAGE_PATH = "/reklamacie-a-vratenie";

/**
 * The return window the markup states: 14 days, the statutory minimum.
 *
 * Owner decision 2026-09-22. The 30 days the site mentions are an extension for customers
 * signed in to a registered account, and structured data cannot say "30 for some" — a
 * crawler reads the number as the policy for every buyer, so it has to be the one every
 * buyer actually gets.
 *
 * Deliberately absent: `returnFees`, `returnMethod` and any return-shipping amount. Who
 * pays for a return, and how an oversized parcel travels back, is not confirmed per
 * shipping class yet (CLAUDE.md §9); a guess published here would be a promise.
 */
const RETURN_DAYS = 14;

/**
 * Delivery time by destination, in working days — the same windows `common.onDemand` promises
 * beside every price (owner decision 2026-09-22): 5–10 inside the EU markets, 7–14 to the US
 * and Canada. `json-ld.organization.test.ts` reads each locale's copy and fails when the two
 * disagree, and it fails when a market's country is in neither list, so a thirteenth market
 * needs a decision here rather than inheriting someone else's promise.
 *
 * The windows are the whole wait the customer is told about, so they are declared as transit
 * time and no separate handling time is invented next to them.
 *
 * No `shippingRate`, anywhere. The price depends on the parcel's size, weight and
 * destination and is shown in the cart (CLAUDE.md §9); any number here — 0 included — would
 * be read as a rate. No carrier either: schema.org's ShippingService has no carrier
 * property, and naming FedEx or Slovenská pošta in a free-text field would be a claim
 * without a structure behind it.
 */
const DELIVERY_REGIONS = [
	{
		countries: ["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO"],
		transitDays: { min: 5, max: 10 },
	},
	{ countries: ["US", "CA"], transitDays: { min: 7, max: 14 } },
] as const;

/** Working days, in the plain form Google's examples use. */
const WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

/** The countries the shop sells to, one per market, in `CHANNEL_MAP` order. */
function marketCountries(): string[] {
	return Object.values(CHANNEL_MAP).map((config) => config.country);
}

/** `sk-eur` or `sk` → `sk`; anything else → null. */
function marketOf(channel: string): string | null {
	const market = REVERSE_MAP[channel] ?? channel;
	return CHANNEL_MAP[market] ? market : null;
}

/**
 * Organization markup — as `OnlineStore`, the subtype Google asks an e-commerce site to use.
 *
 * Every identifying value comes from `src/config/company.ts`, the one place the operating
 * entity is written down; nothing here restates it. Only the return link differs by market:
 * it is the returns page of the market the homepage belongs to.
 *
 * `null` for a channel that is not a market, rather than a store whose return policy links to
 * a page that does not exist.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/organization
 * @see https://developers.google.com/search/docs/appearance/structured-data/return-policy
 * @see https://developers.google.com/search/docs/appearance/structured-data/shipping-policy
 */
export function buildOrganizationJsonLd(channel: string) {
	if (!seoConfig.enableJsonLd) return null;
	const market = marketOf(channel);
	if (!market) return null;

	const base = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "OnlineStore",
		"@id": organizationId(),
		name: seoConfig.organizationName,
		legalName: companyInfo.legalName,
		url: `${base}/`,
		logo: `${base}${ORGANIZATION_LOGO_PATH}`,
		email: companyInfo.email,
		telephone: companyInfo.phone,
		address: {
			"@type": "PostalAddress",
			streetAddress: companyInfo.street,
			postalCode: companyInfo.postalCode,
			addressLocality: companyInfo.locality,
			addressCountry: companyInfo.countryCode,
		},
		vatID: companyInfo.icDph,
		taxID: companyInfo.dic,
		hasMerchantReturnPolicy: {
			"@type": "MerchantReturnPolicy",
			applicableCountry: marketCountries(),
			returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
			merchantReturnDays: RETURN_DAYS,
			merchantReturnLink: `${base}/${market}${RETURNS_PAGE_PATH}`,
		},
		hasShippingService: {
			"@type": "ShippingService",
			fulfillmentType: "FulfillmentTypeDelivery",
			shippingConditions: DELIVERY_REGIONS.map((region) => ({
				"@type": "ShippingConditions",
				shippingDestination: region.countries.map((country) => ({
					"@type": "DefinedRegion",
					addressCountry: country,
				})),
				transitTime: {
					"@type": "ServicePeriod",
					duration: {
						"@type": "QuantitativeValue",
						minValue: region.transitDays.min,
						maxValue: region.transitDays.max,
						unitCode: "DAY",
					},
					businessDays: [...WORKING_DAYS],
				},
			})),
		},
	};
}

/**
 * WebSite markup: the site's name, and the language of the market it is rendered in.
 *
 * `url` is the domain root, which is where Google reads a site name from. No
 * `potentialAction` / SearchAction: Google retired the sitelinks search box, and the markup
 * would describe a feature nothing renders.
 *
 * @see https://developers.google.com/search/docs/appearance/site-names
 */
export function buildWebSiteJsonLd(channel: string) {
	if (!seoConfig.enableJsonLd) return null;
	const market = marketOf(channel);
	if (!market) return null;

	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": websiteId(),
		name: seoConfig.siteName,
		url: `${getBaseUrl()}/`,
		inLanguage: CHANNEL_MAP[market].locale,
		publisher: { "@id": organizationId() },
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
		dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
	};
}

/**
 * JSON for inside a <script> element.
 *
 * `JSON.stringify` leaves `<` alone, so a product name or description containing
 * `</script>` — supplier text arrives through CFM, not from us — would end the element
 * early and turn the rest into markup. `\u003c` is the same character to every JSON
 * parser and cannot close a tag. It also covers `<!--`, the other sequence that changes
 * how a script element's content is parsed.
 */
export function serializeJsonLd(data: object): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}
