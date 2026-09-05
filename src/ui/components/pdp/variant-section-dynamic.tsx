import { publicProductCode } from "@/lib/product-code";
import { formatMoney, formatMoneyRange } from "@/lib/utils";
import { getDiscountInfo } from "@/lib/pricing";
import { type ProductDetailsQuery } from "@/gql/graphql";

import { getTranslations } from "next-intl/server";
import { AddToCart } from "./add-to-cart";
import { VariantSelectionSection } from "./variant-selection";
import { StickyBar } from "./sticky-bar";
import { PurchaseTrust } from "./purchase-trust";
import { Badge } from "@/ui/components/ui/badge";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-stepper";
import { addVariantToCart } from "@/ui/components/plp/actions";
import type { AddToCartResult } from "@/ui/components/plp/add-to-cart-result";
import { CartForm } from "@/ui/components/plp/cart-form";
import { AvailabilityBadge } from "@/ui/components/product/availability-badge";

const MANUFACTURER_REF = "cfm:attribute:manufacturer";

type Product = NonNullable<ProductDetailsQuery["product"]>;

interface VariantSectionDynamicProps {
	product: Product;
	channel: string;
	searchParams: Promise<{ variant?: string }>;
}

/**
 * Dynamic variant section for PDP.
 *
 * With Cache Components enabled, this component streams at request time
 * because it accesses searchParams (runtime data). The product data is
 * already cached in the static shell - this just adds the interactive parts.
 */
export async function VariantSectionDynamic({ product, channel, searchParams }: VariantSectionDynamicProps) {
	const { variant: variantParam } = await searchParams;
	const tCommon = await getTranslations("common");
	const tProduct = await getTranslations("product");
	const variants = product.variants || [];

	// Auto-select variant: use URL param, or auto-select if only one variant exists
	const selectedVariantID = variantParam || (variants.length === 1 ? variants[0].id : undefined);
	const selectedVariant = variants.find(({ id }) => id === selectedVariantID);

	// CFM's availability mode, from the first variant that publishes one. It
	// describes how the product is SOURCED — sale-to-order, from the supplier —
	// so every variant carries the same value and any of them answers for the
	// product. Saleor just has nowhere else to hang it.
	const productAvailabilityMode = variants.find(({ metafield }) => metafield)?.metafield;

	// Determine add-to-cart button state
	const isAddToCartDisabled = !selectedVariantID || !selectedVariant?.quantityAvailable;
	const disabledReason = !selectedVariantID
		? ("no-selection" as const)
		: !selectedVariant?.quantityAvailable
			? ("out-of-stock" as const)
			: undefined;

	// Format prices
	const price = selectedVariant?.pricing?.price?.gross
		? selectedVariant.pricing.price.gross.amount === 0
			? "FREE"
			: formatMoney(selectedVariant.pricing.price.gross.amount, selectedVariant.pricing.price.gross.currency)
		: formatMoneyRange({
				start: product.pricing?.priceRange?.start?.gross,
				stop: product.pricing?.priceRange?.stop?.gross,
			}) || "";

	// Calculate discount/sale information
	const currentPrice = selectedVariant?.pricing?.price?.gross?.amount;
	const undiscountedPrice = selectedVariant?.pricing?.priceUndiscounted?.gross?.amount;
	const { isOnSale, discountPercent } = getDiscountInfo(currentPrice, undiscountedPrice);

	const compareAtPrice =
		isOnSale && selectedVariant?.pricing?.priceUndiscounted?.gross
			? formatMoney(
					selectedVariant.pricing.priceUndiscounted.gross.amount,
					selectedVariant.pricing.priceUndiscounted.gross.currency,
				)
			: null;

	/**
	 * Upper bound for the stepper. `quantityAvailable` is CAPPED by Saleor
	 * (≈50) rather than being real stock, so it is safe as a ceiling but must
	 * never be presented to the customer as "only N left".
	 */
	const maxQuantity = selectedVariant?.quantityAvailable || undefined;

	// Manufacturer was previously reachable only by scrolling to parameter row
	// four. It is a primary buying signal on an accessory store, so it belongs
	// beside the title.
	const manufacturer = (product.attributes ?? []).find(
		(a) => a.attribute.externalReference === MANUFACTURER_REF,
	)?.values[0]?.name;

	// The declared short code, never `variant.sku` — on the roof-rack bundles the
	// SKU is that code with a CFM-internal suffix appended, and this line used to
	// print the whole thing under a "SKU:" label.
	const productCode = publicProductCode(selectedVariant ?? variants[0]);

	// Server action for adding to cart. `useActionState` shape, so <CartForm> can
	// render what actually happened instead of the outcome reaching a log only.
	async function addToCart(_previous: AddToCartResult | null, formData: FormData): Promise<AddToCartResult> {
		"use server";

		if (!selectedVariantID) {
			// The button is disabled without a selection; this is the tampered-form
			// path, not something a customer reaches.
			return { status: "rejected", reason: "invalid", message: "no variant selected" };
		}

		// The form is the only source of quantity, and it is user-controlled, so
		// re-clamp on the server: a tampered field must not reach the mutation.
		const parsed = Number.parseInt(String(formData.get("quantity") ?? ""), 10);
		const ceiling = maxQuantity ?? QUANTITY_FALLBACK_MAX;
		const quantity = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), ceiling) : 1;

		// One shared implementation with the listing card's action: it is the only
		// place that inspects `checkoutLinesAdd.errors`, so a domain rejection —
		// out of stock, not purchasable in this channel — stops reading as success.
		const outcome = await addVariantToCart({
			channel,
			variantId: selectedVariantID,
			quantity,
			maxQuantity,
		});

		if (outcome.status !== "added") {
			console.error(`[pdp] add to cart ${outcome.status}:`, outcome.message);
		}
		return outcome;
	}

	return (
		<>
			{/* Category + Sale badge row - order:1 so it appears ABOVE the h1 */}
			<div className="order-1 flex items-center gap-2">
				{product.category && <span className="text-muted-foreground text-sm">{product.category.name}</span>}
				{isOnSale && (
					<Badge variant="destructive" className="text-xs">
						{tCommon("sale")}
					</Badge>
				)}
			</div>

			{/* Manufacturer · SKU · availability - order:3, directly under the h1.
			    Availability comes from CFM metadata, never from quantityAvailable. */}
			<div className="order-3 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
				{manufacturer && <span className="text-text-primary text-sm font-medium">{manufacturer}</span>}
				{productCode && (
					<span className="text-text-tertiary text-xs">
						{tProduct("sku")}: <span className="font-medium tabular-nums">{productCode}</span>
					</span>
				)}
				<AvailabilityBadge
					// Falls back to the product's mode so a multi-variant product answers
					// before anything is picked. It used to render NOTHING until the
					// customer chose a variant, and a blank where availability belongs
					// reads as "in stock" — on a catalogue that holds none.
					mode={selectedVariant?.metafield ?? productAvailabilityMode}
					// Still the SELECTED variant's, and undefined when there is no
					// selection: unknown, which resolveAvailability treats as unknown
					// rather than as zero. A hard zero on a chosen variant still wins.
					quantityAvailable={selectedVariant?.quantityAvailable}
					className="text-xs"
				/>
			</div>

			{/* Rest of variant section - order:4 so it appears BELOW the meta row */}
			<CartForm action={addToCart} className="order-4 mt-5 space-y-6">
				{/* Variant Selectors */}
				<VariantSelectionSection
					variants={variants}
					selectedVariantId={selectedVariantID}
					productSlug={product.slug}
					channel={channel}
				/>

				{/* Add to Cart */}
				<AddToCart
					price={price}
					compareAtPrice={compareAtPrice}
					discountPercent={discountPercent}
					disabled={isAddToCartDisabled}
					disabledReason={disabledReason}
					maxQuantity={maxQuantity}
				/>

				{/* Sticky Add to Cart Bar (Mobile) */}
				<StickyBar productName={product.name} price={price} show={!isAddToCartDisabled} />
			</CartForm>

			{/* Purchase confidence - order:5, outside the form (nothing submittable). */}
			<div className="order-5 mt-6">
				<PurchaseTrust channel={channel} />
			</div>
		</>
	);
}

/**
 * Skeleton fallback for variant section.
 *
 * Uses delayed visibility (300ms) to prevent flash on fast loads.
 * Part of the static shell - shows while variant data streams in.
 */
export function VariantSectionSkeleton() {
	return (
		<>
			{/* Category skeleton - order:1, delayed visibility */}
			<div className="animate-skeleton-delayed bg-muted order-1 h-4 w-20 animate-pulse rounded opacity-0" />

			{/* Variant section skeleton - order:3, delayed visibility */}
			<div className="animate-skeleton-delayed order-3 mt-4 animate-pulse space-y-6 opacity-0">
				{/* Variant selector skeleton */}
				<div className="space-y-4">
					<div className="bg-muted h-4 w-16 rounded" />
					<div className="flex gap-2">
						<div className="bg-muted h-10 w-16 rounded" />
						<div className="bg-muted h-10 w-16 rounded" />
						<div className="bg-muted h-10 w-16 rounded" />
					</div>
				</div>

				{/* Price skeleton */}
				<div className="bg-muted h-8 w-24 rounded" />

				{/* Add to cart button skeleton */}
				<div className="bg-muted h-12 w-full rounded" />
			</div>
		</>
	);
}
