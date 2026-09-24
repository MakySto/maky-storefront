"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";
import { AvailabilityBadge } from "@/ui/components/product/availability-badge";
import { StarRating } from "@/ui/components/product/star-rating";
import { WishlistButton } from "@/ui/components/wishlist/wishlist-button";
import { cn } from "@/lib/utils";
import { isPlaceholderProductImage } from "@/lib/product-image";
import { useLocale } from "@/providers/locale-provider";
import { addListingItemToCartAction } from "./actions";
import { CartForm } from "./cart-form";

export interface ProductCardData {
	id: string;
	name: string;
	slug: string;
	/** Manufacturer (Thule, Menabo…), not the category. */
	brand?: string | null;
	/** One-line distinguishing fact — volume, capacity, load. */
	note?: string | null;
	productCode?: string | null;
	/** Set only when the product has exactly one variant. */
	variantId?: string | null;
	quantityAvailable?: number | null;
	trackInventory?: boolean | null;
	availabilityMode?: string | null;
	/** Saleor Product.rating — null across the catalogue today. */
	rating?: number | null;
	price: number;
	compareAtPrice?: number | null;
	currency: string;
	image: string;
	imageAlt?: string;
	hoverImage?: string | null;
	href: string;
	/** Saleor channel slug — the add-to-cart action needs it in the form. */
	channel: string;
	/** Channel-level purchase switch; false is still a visible catalogue card. */
	isPurchasable: boolean;
	badge?: "sale" | "new" | null;
	colors?: { name: string; hex: string }[];
	sizes?: string[];
	category?: { id: string; name: string; slug: string } | null;
	createdAt?: string | null;
	hasVariants?: boolean;
}

/**
 * How the card offers the purchase.
 *
 * - `stepper` — quantity and "Do košíka" side by side: the homepage's rows of five.
 * - `button` — one full-width "Do košíka": the category grid beside its filter panel, as the
 *   approved category page draws it. The quantity is then 1, and the cart changes it.
 *
 * On a phone both are the full-width button: two cards share a row there, and a stepper beside
 * a button in 170px leaves neither usable.
 */
export type ProductCardPurchase = "stepper" | "button";

interface ProductCardProps {
	product: ProductCardData;
	/** Preloads the image. Reserve for the single LCP candidate — see ProductGrid. */
	priority?: boolean;
	purchase?: ProductCardPurchase;
}

function AddButton({ withIcon }: { withIcon: boolean }) {
	const { pending } = useFormStatus();
	const tCommon = useTranslations("common");
	return (
		// "Do košíka", the short label: beside the stepper the button has ~120px, and the long
		// "Pridať do košíka" ellipsised there. The cart icon rides wherever the button runs the
		// card's width — on a phone always, on a listing card always.
		<Button
			type="submit"
			disabled={pending}
			className="h-11 min-w-0 flex-1 gap-2 rounded-xs px-2.5 text-sm font-semibold shadow-none"
		>
			<ShoppingCartIcon
				className={cn("h-4 w-4 shrink-0", !withIcon && "sm:hidden")}
				strokeWidth={2.25}
				aria-hidden
			/>
			<span className="truncate">{tCommon("addToCartShort")}</span>
		</Button>
	);
}

/**
 * Listing card — the one card for category pages, search, collections, favourites and the
 * homepage.
 *
 * Premium redesign, second pass (owner, 2026-09-24): the photo sits ABOVE the words at every
 * width — on a phone too, two cards to a row — and the card carries the product code. The
 * hierarchy is the approved mockups':
 *
 *   photo + heart · BRAND  category · name · one distinguishing fact · SKU · stars
 *   price  ● availability · quantity + add
 *
 * - The photo is the product from Saleor, WHOLE (`object-contain` on the card's own white), in
 *   a 5:4 window that suits the wide boxes, bars and carriers this shop sells.
 * - The name gets up to four lines: a roof-rack set's name ends with the car and the roof type,
 *   the part a shopper checks.
 * - The heart keeps the product in this browser's favourites (`lib/wishlist`) — a real list, on
 *   `/{market}/oblubene`, not a decoration.
 * - Stars only when Saleor carries a rating (`StarRating` renders nothing for null — the whole
 *   catalogue today). No badge the data does not back.
 * - Availability in its short form ("Na objednávku"): the lead time is the product page's, where
 *   the shopper decides; on a card it wrapped to three lines beside the price.
 * - `mt-auto` pins the price and the purchase row to the foot of the card, so a row of cards
 *   lines up whatever their names.
 */
export function ProductCard({ product, priority = false, purchase = "stepper" }: ProductCardProps) {
	const tCommon = useTranslations("common");
	const tProduct = useTranslations("product");
	const tCart = useTranslations("cart");
	const { locale } = useLocale();

	const formatPrice = (amount: number, currency: string) =>
		new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

	const badgeLabel =
		product.badge === "sale" ? tCommon("sale") : product.badge === "new" ? tCommon("new") : null;

	// Only offer a direct add when there is genuinely nothing to choose.
	const canAddDirectly =
		product.isPurchasable && Boolean(product.variantId) && product.quantityAvailable !== 0;

	// A product mid-import has no thumbnail yet. Show a quiet placeholder rather
	// than the broken-image glyph, which reads as a fault in the shop. Same for the grey
	// "no image" GIF some products were imported with — `transformToProductCard` already
	// drops it; this is the backstop for any other producer of card data.
	const hasImage =
		Boolean(product.image) &&
		product.image !== "/placeholder.svg" &&
		!isPlaceholderProductImage(product.image);

	return (
		<article className="group border-border-subtle bg-surface-card hover:border-border-default relative flex flex-col overflow-hidden rounded-sm border shadow-xs transition-[box-shadow,transform,border-color] duration-200 ease-out hover:shadow-lg motion-safe:hover:-translate-y-0.5">
			<div className="relative">
				{/* The product whole, never cropped: wide boxes and bars fill the 5:4 window, a tall
				    carrier stands in it. */}
				<Link
					href={product.href}
					tabIndex={-1}
					aria-hidden="true"
					className="bg-surface-card relative block aspect-[5/4] overflow-hidden"
				>
					{hasImage ? (
						<ResilientProductImage
							src={product.image}
							alt={product.imageAlt || product.name}
							fill
							sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, (max-width: 1439px) 25vw, 20vw"
							className="object-contain px-3 pt-4 pb-1 transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04] sm:px-5 sm:pt-6 sm:pb-2"
							priority={priority}
						/>
					) : (
						<span className="text-text-tertiary bg-surface-secondary absolute inset-0 flex items-center justify-center px-3 text-center text-xs sm:px-4">
							{tProduct("noImageAvailable")}
						</span>
					)}
				</Link>
				{badgeLabel && (
					<Badge
						variant={product.badge === "sale" ? "destructive" : "default"}
						className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3"
					>
						{badgeLabel}
					</Badge>
				)}
				{/* Above the card-wide link (`z-10`), so it saves instead of opening the product. */}
				<WishlistButton
					productId={product.id}
					productName={product.name}
					className="absolute top-1.5 right-1.5 z-10 sm:top-2 sm:right-2"
				/>
			</div>

			<div className="flex min-w-0 flex-1 flex-col px-3 pt-2 sm:px-4 sm:pt-2.5">
				{/* The maker, set like a wordmark; the type after it, quietly. */}
				{(product.brand || product.category) && (
					<p className="flex min-w-0 items-baseline gap-1.5 text-xs">
						{product.brand && (
							<span className="text-text-primary shrink-0 text-[0.6875rem] font-extrabold tracking-[0.08em] uppercase sm:text-xs">
								{product.brand}
							</span>
						)}
						{product.category && (
							<span className="text-text-tertiary truncate text-[0.6875rem] sm:text-xs">
								{product.category.name}
							</span>
						)}
					</p>
				)}
				{/* Up to four lines: a roof-rack set's name ends with the car and the roof type, the
				    part a shopper checks. Short names still reserve two lines, so the facts under
				    them start at one height across a row. */}
				<h2 className="text-text-primary mt-1 line-clamp-4 min-h-[2lh] text-sm leading-snug font-semibold tracking-[-0.01em] sm:text-[0.9375rem]">
					<Link
						href={product.href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						{/* The whole card is the link's target area; the title carries its name. */}
						<span className="absolute inset-0" aria-hidden="true" />
						{product.name}
					</Link>
				</h2>
				{product.note && (
					<p className="text-text-secondary mt-1 line-clamp-1 text-xs sm:text-[0.8125rem]">{product.note}</p>
				)}
				{product.productCode && (
					<p className="text-text-tertiary mt-1 truncate text-[0.6875rem] sm:text-xs">
						{tProduct("sku")}: <span className="tabular-nums">{product.productCode}</span>
					</p>
				)}

				{/* Renders nothing until something actually populates Product.rating */}
				<StarRating rating={product.rating} className="mt-1.5" />

				<div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3">
					<span className="flex flex-wrap items-baseline gap-x-2">
						<span
							className={cn(
								"text-price-current text-lg leading-tight font-extrabold tracking-[-0.02em] tabular-nums sm:text-xl",
								product.compareAtPrice && "text-price-sale",
							)}
						>
							{formatPrice(product.price, product.currency)}
						</span>
						{product.compareAtPrice && (
							<span className="text-price-compare text-xs tabular-nums line-through sm:text-sm">
								{formatPrice(product.compareAtPrice, product.currency)}
							</span>
						)}
					</span>
					{product.isPurchasable ? (
						<AvailabilityBadge
							label={tCommon}
							short
							mode={product.availabilityMode}
							trackInventory={product.trackInventory}
							quantityAvailable={product.quantityAvailable}
							className="text-[0.6875rem] leading-snug font-semibold sm:text-xs"
						/>
					) : (
						<span className="text-text-secondary text-[0.6875rem] sm:text-xs">{tCart("addUnavailable")}</span>
					)}
				</div>
			</div>

			{/* The purchase row, pinned to the foot of the card. Above the card-wide link
			    (`relative`), so the stepper and the button stay clickable. */}
			<div className="relative px-3 pt-3 pb-3 sm:px-4 sm:pb-4">
				{canAddDirectly ? (
					<CartForm action={addListingItemToCartAction}>
						<div className="flex items-stretch gap-2">
							<input type="hidden" name="channel" value={product.channel} />
							<input type="hidden" name="variantId" value={product.variantId ?? ""} />
							<input type="hidden" name="maxQuantity" value={product.quantityAvailable ?? ""} />
							{purchase === "stepper" ? (
								// Hidden on a phone, where the button takes the row. A control under
								// `display: none` still submits its value, so the quantity is 1 there.
								<QuantityStepper
									name="quantity"
									max={product.quantityAvailable ?? undefined}
									compact
									className="hidden sm:flex"
								/>
							) : (
								<input type="hidden" name="quantity" value="1" />
							)}
							<AddButton withIcon={purchase === "button"} />
						</div>
					</CartForm>
				) : (
					// Button is a plain <button> in this codebase — no asChild slot — so
					// the link carries the styling itself.
					<Link
						href={product.href}
						className="border-border-default text-text-primary hover:border-text-primary focus-visible:ring-ring flex h-11 w-full items-center justify-center rounded-xs border text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
					>
						{tCommon("viewDetail")}
					</Link>
				)}
			</div>
		</article>
	);
}
