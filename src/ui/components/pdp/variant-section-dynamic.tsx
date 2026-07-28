import { revalidatePath } from "next/cache";

import { formatMoney, formatMoneyRange } from "@/lib/utils";
import { getDiscountInfo } from "@/lib/pricing";
import { CheckoutAddLineDocument, type ProductDetailsQuery } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import * as Checkout from "@/lib/checkout";

import { getTranslations } from "next-intl/server";
import { AddToCart } from "./add-to-cart";
import { VariantSelectionSection } from "./variant-selection";
import { StickyBar } from "./sticky-bar";
import { Badge } from "@/ui/components/ui/badge";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-stepper";

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
	const variants = product.variants || [];

	// Auto-select variant: use URL param, or auto-select if only one variant exists
	const selectedVariantID = variantParam || (variants.length === 1 ? variants[0].id : undefined);
	const selectedVariant = variants.find(({ id }) => id === selectedVariantID);

	// Check availability
	const isAvailable = variants.some((variant) => variant.quantityAvailable);

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

	// Server action for adding to cart
	async function addToCart(formData: FormData) {
		"use server";

		if (!selectedVariantID) {
			// Silently return - button should be disabled if no variant selected
			return;
		}

		// The form is the only source of quantity, and it is user-controlled, so
		// re-clamp on the server: a tampered field must not reach the mutation.
		const parsed = Number.parseInt(String(formData.get("quantity") ?? ""), 10);
		const ceiling = maxQuantity ?? QUANTITY_FALLBACK_MAX;
		const quantity = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), ceiling) : 1;

		try {
			const checkout = await Checkout.findOrCreate({
				checkoutId: await Checkout.getIdFromCookies(channel),
				channel: channel,
			});

			if (!checkout) {
				// Log error server-side, UI will show via ErrorBoundary if needed
				console.error("Add to cart: Failed to create checkout");
				return;
			}

			await Checkout.saveIdToCookie(channel, checkout.id);

			const addResult = await executeAuthenticatedGraphQL(CheckoutAddLineDocument, {
				variables: {
					id: checkout.id,
					productVariantId: decodeURIComponent(selectedVariantID),
					quantity,
				},
				cache: "no-cache",
			});

			if (!addResult.ok) {
				console.error("Add to cart failed:", addResult.error.message);
				return;
			}

			revalidatePath("/cart");
		} catch (error) {
			// Log error server-side - the UI feedback comes from cart drawer/badge update
			// For explicit error UI, would need useActionState (separate enhancement)
			console.error("Add to cart failed:", error);
		}
	}

	return (
		<>
			{/* Category + Sale/Stock badges row - order:1 so it appears ABOVE the h1 */}
			<div className="order-1 flex items-center gap-2">
				{product.category && <span className="text-muted-foreground text-sm">{product.category.name}</span>}
				{isOnSale && (
					<Badge variant="destructive" className="text-xs">
						{tCommon("sale")}
					</Badge>
				)}
				{!isAvailable && (
					<Badge variant="secondary" className="text-xs">
						{tCommon("outOfStock")}
					</Badge>
				)}
			</div>

			{/* Rest of variant section - order:3 so it appears BELOW the h1 */}
			<form action={addToCart} className="order-3 mt-4 space-y-6">
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
			</form>
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
