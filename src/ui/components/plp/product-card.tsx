"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckIcon, ShoppingCartIcon } from "lucide-react";
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
import { CartForm, useCartFormResult } from "./cart-form";
import type { AddToCartResult } from "./add-to-cart-result";

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
 * A phone shows one card to a row (see ProductGrid), so the stepper has room there too.
 */
export type ProductCardPurchase = "stepper" | "button";

interface ProductCardProps {
	product: ProductCardData;
	/** Preloads the image. Reserve for the single LCP candidate — see ProductGrid. */
	priority?: boolean;
	purchase?: ProductCardPurchase;
	/**
	 * The product's category beside its maker. The grid turns it off where every card shares one
	 * category — a category's own listing — and the name would repeat the page heading.
	 */
	showCategory?: boolean;
}

/** How long the button says "Pridané" after a successful add. */
const ADDED_MS = 2400;

function AddButton({ withIcon }: { withIcon: boolean }) {
	const { pending } = useFormStatus();
	const tCommon = useTranslations("common");
	const result = useCartFormResult();
	// Every submission yields a new result object, so "the add that has already been shown" is
	// that object: the button says "Pridané" until the timer marks it seen, and a second add of
	// the same product says it again.
	const [seen, setSeen] = useState<AddToCartResult | null>(null);
	const added = result?.status === "added" && seen !== result && !pending;
	useEffect(() => {
		if (result?.status !== "added") return;
		const timer = window.setTimeout(() => setSeen(result), ADDED_MS);
		return () => window.clearTimeout(timer);
	}, [result]);

	const Icon = added ? CheckIcon : ShoppingCartIcon;
	return (
		// "Do košíka", the short label: beside the stepper the button has ~120px, and the long
		// "Pridať do košíka" ellipsised there. The cart icon rides wherever the button runs the
		// card's width. The hidden status line of the form tells assistive tech what happened;
		// this label is the sighted half of the same answer.
		<Button
			type="submit"
			disabled={pending}
			className="h-11 min-w-0 flex-1 gap-2 rounded-xs px-2.5 text-sm font-semibold shadow-none"
		>
			<Icon
				className={cn("h-4 w-4 shrink-0", !withIcon && !added && "lg:hidden")}
				strokeWidth={added ? 3 : 2.25}
				aria-hidden
			/>
			<span className="truncate">{added ? tCommon("addedShort") : tCommon("addToCartShort")}</span>
		</Button>
	);
}

/**
 * Listing card — the one card for category pages, search, collections, favourites and the
 * homepage.
 *
 * Third pass (owner, 2026-09-24): ONE card to a row on a phone, the photo on top and the full
 * width of the card; the product facts in the middle; a hairline, then the price, the lead time
 * and the purchase. The hierarchy:
 *
 *   photo + heart
 *   BRAND  category · name · one distinguishing fact · SKU · stars
 *   ─────────────────────
 *   price  ● availability
 *   quantity + add
 *
 * - The photo is the product from Saleor, WHOLE (`object-contain` on the card's own white), in
 *   a 5:4 window that suits the wide boxes, bars and carriers this shop sells.
 * - The name is the card's headline and gets up to four lines: a roof-rack set's name ends with
 *   the car and the roof type, the part a shopper checks. The maker above it is set smaller and
 *   quieter than the name.
 * - The heart keeps the product in this browser's favourites (`lib/wishlist`) — a real list, on
 *   `/{market}/oblubene`, not a decoration.
 * - Stars only when Saleor carries a rating (`StarRating` renders nothing for null — the whole
 *   catalogue today). No badge the data does not back.
 * - The facts block grows (`flex-1`), so the hairline, the prices and the buttons of a row of
 *   cards line up whatever their names. The availability never breaks inside its words: when it
 *   does not fit beside the price it takes the next line whole.
 * - An add does not add a line to the card: the button says "Pridané" for a moment (and the
 *   form's hidden status line says it to a screen reader). A line under one card's button used
 *   to push that card's purchase row out of line with its neighbours.
 */
export function ProductCard({
	product,
	priority = false,
	purchase = "stepper",
	showCategory = true,
}: ProductCardProps) {
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

	const category = showCategory ? product.category : null;

	return (
		<article
			className={cn(
				"group border-border-default bg-surface-card relative flex flex-col overflow-hidden rounded-sm border shadow-xs transition-[box-shadow,border-color] duration-200 ease-out",
				"hover:border-border-strong hover:shadow-md",
				// The title's link is the card's link (its span covers the card), and its own outline
				// would draw around the title alone: the keyboard focus rings the whole card instead.
				"has-[h2_a:focus-visible]:ring-ring has-[h2_a:focus-visible]:ring-2 has-[h2_a:focus-visible]:ring-offset-2",
			)}
		>
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
							sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1439px) 25vw, 20vw"
							className="object-contain px-5 pt-6 pb-2 transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
							priority={priority}
						/>
					) : (
						<span className="text-text-tertiary bg-surface-secondary absolute inset-0 flex items-center justify-center px-4 text-center text-xs">
							{tProduct("noImageAvailable")}
						</span>
					)}
				</Link>
				{badgeLabel && (
					<Badge
						variant={product.badge === "sale" ? "destructive" : "default"}
						className="absolute top-3 left-3"
					>
						{badgeLabel}
					</Badge>
				)}
				{/* Above the card-wide link (`z-10`), so it saves instead of opening the product. */}
				<WishlistButton
					productId={product.id}
					productName={product.name}
					className="absolute top-2 right-2 z-10"
				/>
			</div>

			{/* The facts. `flex-1`: the block takes the card's spare height, so the hairline under it
			    sits at one height across a row of cards. */}
			<div className="flex min-w-0 flex-1 flex-col px-4 pt-3">
				{/* The maker, set like a wordmark but quieter than the name; the type after it. */}
				{(product.brand || category) && (
					<p className="flex min-w-0 items-baseline gap-2 text-xs">
						{product.brand && (
							<span className="text-text-secondary shrink-0 font-bold tracking-[0.07em] uppercase">
								{product.brand}
							</span>
						)}
						{category && <span className="text-text-tertiary truncate">{category.name}</span>}
					</p>
				)}
				{/* Up to four lines: a roof-rack set's name ends with the car and the roof type, the
				    part a shopper checks. Short names still reserve two lines, so the facts under
				    them start at one height across a row. */}
				<h2 className="text-text-primary mt-1.5 line-clamp-4 min-h-[2lh] text-base leading-snug font-semibold tracking-[-0.01em] sm:text-[0.9375rem]">
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
					<p className="text-text-secondary mt-1.5 line-clamp-1 text-[0.8125rem]">{product.note}</p>
				)}
				{product.productCode && (
					<p className="text-text-tertiary mt-1 truncate text-xs">
						{tProduct("sku")}: <span className="tabular-nums">{product.productCode}</span>
					</p>
				)}

				{/* Renders nothing until something actually populates Product.rating */}
				<StarRating rating={product.rating} className="mt-1.5" />
			</div>

			{/* A hairline inset to the text, then the price and what the catalogue says about
			    availability. Not positioned: a click here still reaches the card-wide link. */}
			<div className="border-border-subtle mx-4 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3">
				<span className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
					<span
						className={cn(
							"text-price-current text-xl leading-tight font-extrabold tracking-[-0.02em] tabular-nums",
							product.compareAtPrice && "text-price-sale",
						)}
					>
						{formatPrice(product.price, product.currency)}
					</span>
					{product.compareAtPrice && (
						<span className="text-price-compare text-sm tabular-nums line-through">
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
						className="text-xs leading-snug font-semibold whitespace-nowrap"
					/>
				) : (
					<span className="text-text-secondary text-xs">{tCart("addUnavailable")}</span>
				)}
			</div>

			{/* The purchase row, pinned to the foot of the card. Above the card-wide link
			    (`relative`), so the stepper and the button stay clickable. */}
			<div className="relative px-4 pt-3 pb-4">
				{canAddDirectly ? (
					<CartForm action={addListingItemToCartAction} quietSuccess>
						<div className="flex items-stretch gap-2">
							<input type="hidden" name="channel" value={product.channel} />
							<input type="hidden" name="variantId" value={product.variantId ?? ""} />
							<input type="hidden" name="maxQuantity" value={product.quantityAvailable ?? ""} />
							{purchase === "stepper" ? (
								<QuantityStepper name="quantity" max={product.quantityAvailable ?? undefined} compact />
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
