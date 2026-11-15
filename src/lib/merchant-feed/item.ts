import { publicComponentEans } from "@/lib/component-eans";
import { parseEditorJSToText } from "@/lib/editorjs";
import { publicGtin } from "@/lib/product-ean";
import { productHref } from "@/lib/product-url";
import { getBaseUrl } from "@/lib/seo/config";
import { availabilityOf, transitDaysFor } from "@/lib/seo/json-ld";
import { type OfferProduct, type OfferVariant, productJsonLdOptions } from "@/lib/seo/product-jsonld-options";
import { type GalleryMedia, getGalleryImages } from "@/ui/components/pdp/gallery-images";

/**
 * One product of the catalogue as an item of the Google Merchant feed.
 *
 * Google compares a feed with the page each item links to and disapproves the product when price or
 * availability disagree. So nothing here decides a price, an availability, a code or a URL of its own:
 * every one of them is read from `productJsonLdOptions`, the object the product page builds its
 * structured data from, and the availability goes through the page's own `availabilityOf`. What this
 * file adds is only what a feed has and a page has not: the text length Google accepts, the weight, the
 * bundle flag, and the list of products that must not be in a feed at all.
 *
 * What is left out, and why:
 *
 *   not-purchasable  the market shows the product and does not sell it (a quote button, or no button).
 *                    A feed item is an offer; there is none.
 *   no-price         nothing to state.
 *   no-image         Google refuses an item without a picture, and the "no image" placeholder is not one.
 *   no-brand         Google requires the brand for these goods. A product gets into the feed the day CFM
 *                    writes its manufacturer; until then the count of these is the size of that gap.
 *
 * Left unsaid on purpose:
 *
 *   mpn              The code on the page is the shop's own (`lib/product-code.ts`), not the maker's part
 *                    number, and the page stopped calling it one. The feed does not start again.
 *   shipping         The price of delivery is set in Merchant Center, per country (owner's price table).
 *   google_product_category   Optional; Google assigns one. A wrong one is worse than none.
 */

export type FeedSkipReason = "not-purchasable" | "no-price" | "no-image" | "no-brand";

export interface FeedMoney {
	amount: number;
	currency: string;
}

export interface FeedItem {
	/** Saleor's variant id: unique, the same in every market, and never shown to anyone. */
	id: string;
	/** The product, for a product with a real choice of variants. */
	itemGroupId?: string;
	title: string;
	description: string;
	link: string;
	imageLink: string;
	additionalImageLinks: string[];
	/** The price the page shows; with `salePrice` it is the price before the discount. */
	price: FeedMoney;
	salePrice?: FeedMoney;
	availability: "in_stock" | "out_of_stock" | "backorder";
	/**
	 * For `backorder`: the working days the badge beside the price names as the longest wait. The writer
	 * turns it into `availability_date` on the day it writes, so that this module needs no clock.
	 */
	backorderWorkingDays?: number;
	brand: string;
	gtin?: string;
	/** A set the shop puts together from separately sold parts; its `gtin` is then the main part's. */
	isBundle?: true;
	shippingWeight?: { value: number; unit: "kg" | "g" | "lb" | "oz" };
	productType?: string;
}

export interface FeedVariant extends OfferVariant {
	media?: readonly GalleryMedia[] | null;
	componentEans?: string | null;
	weight?: { value: number; unit: string } | null;
	pricing?: {
		price?: { gross: FeedMoney } | null;
		priceUndiscounted?: { gross: FeedMoney } | null;
	} | null;
}

export interface FeedProduct extends OfferProduct {
	id: string;
	description?: string | null;
	category?: { id?: string | null; slug?: string | null; name?: string | null } | null;
	media?: readonly GalleryMedia[] | null;
	thumbnail?: { url: string; alt?: string | null } | null;
	variants?: readonly FeedVariant[] | null;
}

export type FeedOutcome =
	| { items: FeedItem[]; skipped: null }
	| { items: readonly []; skipped: FeedSkipReason };

/** Google's limits for the two texts. */
export const TITLE_MAX = 150;
export const DESCRIPTION_MAX = 5000;
/** Google reads at most ten further pictures. */
export const ADDITIONAL_IMAGES_MAX = 10;

const AVAILABILITY = {
	"https://schema.org/InStock": "in_stock",
	"https://schema.org/OutOfStock": "out_of_stock",
	"https://schema.org/BackOrder": "backorder",
} as const;

const ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

/** Plain text on one line: the sanitizer's entities read back, whitespace collapsed. */
function plain(value: string | null | undefined): string {
	return (value ?? "")
		.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
		.replace(/\s+/g, " ")
		.trim();
}

/** Cut at a word where there is one in the last fifth, so a text does not end inside a word. */
export function clip(value: string, max: number): string {
	if (value.length <= max) return value;
	const cut = value.slice(0, max);
	const space = cut.lastIndexOf(" ");
	return (space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd();
}

function weightOf(weight: FeedVariant["weight"]): FeedItem["shippingWeight"] {
	if (!weight || !Number.isFinite(weight.value) || weight.value <= 0) return undefined;
	switch (weight.unit) {
		case "KG":
			return { value: weight.value, unit: "kg" };
		case "G":
			return { value: weight.value, unit: "g" };
		case "LB":
			return { value: weight.value, unit: "lb" };
		case "OZ":
			return { value: weight.value, unit: "oz" };
		case "TONNE":
			return { value: weight.value * 1000, unit: "kg" };
		default:
			return undefined;
	}
}

/**
 * The feed items of one product: one per variant that has a price, or the reason there is none.
 *
 * @param product The product in the market's language (after `resolveExactLocaleProduct`).
 * @param channel The Saleor channel or the market.
 */
export function feedItemsFor(product: FeedProduct, channel: string): FeedOutcome {
	const variants = product.variants ?? [];
	const hasChoice = variants.length > 1;
	const gallery = (variant: FeedVariant | null) => getGalleryImages(product, variant);
	const options = productJsonLdOptions(product, channel, gallery(hasChoice ? null : variants[0] ?? null));

	if (!options.isPurchasable) return { items: [], skipped: "not-purchasable" };
	const priced = (options.variants ?? []).some((variant) => variant.price);
	if (!priced) return { items: [], skipped: "no-price" };
	if (!options.images?.length) return { items: [], skipped: "no-image" };
	const brand = options.brand?.trim();
	if (!brand) return { items: [], skipped: "no-brand" };

	const base = getBaseUrl();
	const description =
		clip(plain(parseEditorJSToText(product.description)), DESCRIPTION_MAX) ||
		plain(product.seoDescription) ||
		plain(product.name);
	const productType = plain(product.category?.name) || undefined;
	const backorderDays = transitDaysFor(channel)?.max;

	const items: FeedItem[] = [];
	variants.forEach((variant, index) => {
		const stated = options.variants?.[index];
		if (!variant.id || !stated?.price) return;

		// The page's own decision, with the page's own precedence (`buildProductJsonLd`).
		const availability =
			AVAILABILITY[
				availabilityOf(
					Boolean(options.isPurchasable) && (stated.inStock ?? options.inStock ?? false),
					stated.availabilityMode ?? options.availabilityMode,
					stated.trackInventory,
				)
			];

		const images = hasChoice ? gallery(variant).map((image) => image.url) : options.images!;
		const [imageLink, ...more] = images.length > 0 ? images : options.images!;

		const before = variant.pricing?.priceUndiscounted?.gross;
		const discounted =
			before && before.currency === stated.price.currency && before.amount > stated.price.amount;

		const parts = publicComponentEans(variant.componentEans);
		const gtin = publicGtin(stated.gtin) ?? parts.find((part) => part.role === "bars")?.ean ?? undefined;

		const weight = weightOf(variant.weight);
		const name = plain(product.name);
		const variantName = plain(variant.name);

		items.push({
			id: variant.id,
			...(hasChoice ? { itemGroupId: product.id } : {}),
			title: clip(hasChoice && variantName ? `${name}, ${variantName}` : name, TITLE_MAX),
			description,
			link: `${base}${hasChoice ? productHref(channel, product.slug, variant.id) : options.url}`,
			imageLink: imageLink!,
			additionalImageLinks: more.slice(0, ADDITIONAL_IMAGES_MAX),
			price: discounted ? { ...before } : { ...stated.price },
			...(discounted ? { salePrice: { ...stated.price } } : {}),
			availability,
			...(availability === "backorder" && backorderDays ? { backorderWorkingDays: backorderDays } : {}),
			brand,
			...(gtin ? { gtin } : {}),
			...(parts.length > 0 ? { isBundle: true as const } : {}),
			...(weight ? { shippingWeight: weight } : {}),
			...(productType ? { productType } : {}),
		});
	});

	return items.length > 0 ? { items, skipped: null } : { items: [], skipped: "no-price" };
}
