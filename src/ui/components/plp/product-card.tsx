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

interface ProductCardProps {
	product: ProductCardData;
	/** Preloads the image. Reserve for the single LCP candidate — see ProductGrid. */
	priority?: boolean;
}

function AddButton() {
	const { pending } = useFormStatus();
	const tCommon = useTranslations("common");
	return (
		// "Do košíka", the short label: a grid card leaves the button ~105px beside the stepper,
		// and "Pridať do košíka" — or an icon in front of the short one — ellipsised there. The
		// icon rides only in the phone row, where the button runs the card's full width.
		<Button
			type="submit"
			disabled={pending}
			className="h-11 min-w-0 flex-1 rounded-xs px-2.5 text-sm font-semibold shadow-none"
		>
			<ShoppingCartIcon className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
			<span className="truncate">{tCommon("addToCartShort")}</span>
		</Button>
	);
}

/**
 * Listing card — the one card for category pages, search, collections and the homepage.
 *
 * Premium redesign 2026-09, after the owner rejected the first facelift's card ("big empty
 * frames, tiny text, shrunken photos"). The hierarchy follows the approved mockups:
 *
 *   photo · BRAND · name · one distinguishing fact · availability · price · quantity + add
 *
 * - The photo is the product from Saleor, WHOLE (`object-contain` on the card's own white, no
 *   second frame), in a 5:4 window that suits the wide boxes, bars and carriers this shop
 *   sells; a tall bike carrier sits smaller in it rather than being cropped.
 * - The name gets up to five lines: the roof-rack sets end with the car and the roof type,
 *   which a shorter clamp cut off.
 * - No stars without reviews (`StarRating` renders nothing for a null rating), no badge the data
 *   does not back, no heart: there is no wishlist to save to.
 * - From `sm` the fixed title height and `mt-auto` line the price and purchase rows up across a
 *   grid row.
 *
 * On a phone the card is a row — photo left, facts right, the purchase row across the bottom —
 * so a list of twenty-four products is a scroll, not a slideshow of square photos.
 */
export function ProductCard({ product, priority = false }: ProductCardProps) {
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
		<article className="group border-border-subtle bg-surface-card hover:border-border-default relative grid grid-cols-[minmax(7.5rem,38%)_minmax(0,1fr)] gap-x-3.5 gap-y-3 rounded-sm border p-3 shadow-xs transition-[box-shadow,transform,border-color] duration-200 ease-out hover:shadow-lg sm:flex sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0 motion-safe:sm:hover:-translate-y-0.5">
			{/* The product whole, never cropped: wide boxes and bars fill the 5:4 window, a tall
			    carrier stands in it. */}
			<Link
				href={product.href}
				tabIndex={-1}
				aria-hidden="true"
				className="bg-surface-card relative block aspect-square self-start overflow-hidden rounded-xs sm:aspect-[5/4] sm:self-stretch sm:rounded-none"
			>
				{hasImage ? (
					<ResilientProductImage
						src={product.image}
						alt={product.imageAlt || product.name}
						fill
						sizes="(max-width: 639px) 40vw, (max-width: 1023px) 50vw, (max-width: 1439px) 25vw, 20vw"
						className="object-contain p-1.5 transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04] sm:px-5 sm:pt-5 sm:pb-2"
						priority={priority}
					/>
				) : (
					<span className="text-text-tertiary bg-surface-secondary absolute inset-0 flex items-center justify-center px-2 text-center text-xs sm:px-4">
						{tProduct("noImageAvailable")}
					</span>
				)}
				{badgeLabel && (
					<Badge
						variant={product.badge === "sale" ? "destructive" : "default"}
						className="absolute top-2 left-2 sm:top-3 sm:left-3"
					>
						{badgeLabel}
					</Badge>
				)}
			</Link>

			<div className="flex min-w-0 flex-col sm:flex-1 sm:px-4 sm:pt-2">
				{/* The maker, set like a wordmark; the type after it, quietly. */}
				{(product.brand || product.category) && (
					<p className="flex min-w-0 items-baseline gap-1.5 text-xs">
						{product.brand && (
							<span className="text-text-primary shrink-0 text-xs font-bold tracking-[0.08em] uppercase">
								{product.brand}
							</span>
						)}
						{product.category && <span className="text-text-tertiary truncate">{product.category.name}</span>}
					</p>
				)}
				{/* Up to five lines: a roof-rack set's name ends with the car and the roof type, the
				    part a shopper checks, and a three-line clamp cut it off. Short names still
				    reserve two lines, and `mt-auto` below lines the price rows up. */}
				<h2 className="text-text-primary mt-1 line-clamp-5 text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] sm:min-h-[2lh] sm:text-base">
					<Link
						href={product.href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						{/* The whole card is the link's target area; the title carries its name. */}
						<span className="absolute inset-0 hidden sm:block" aria-hidden="true" />
						{product.name}
					</Link>
				</h2>
				{product.note && (
					<p className="text-text-secondary mt-1 line-clamp-1 text-[0.8125rem]">{product.note}</p>
				)}

				{/* Renders nothing until something actually populates Product.rating */}
				<StarRating rating={product.rating} className="mt-1.5" />

				<div className="mt-2 sm:mt-auto sm:pt-3">
					{product.isPurchasable ? (
						<AvailabilityBadge
							label={tCommon}
							mode={product.availabilityMode}
							trackInventory={product.trackInventory}
							quantityAvailable={product.quantityAvailable}
							className="text-xs leading-snug"
						/>
					) : (
						<p className="text-text-secondary text-xs">{tCart("addUnavailable")}</p>
					)}
					<div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
						<span
							className={cn(
								"text-price-current text-xl leading-tight font-bold tracking-[-0.02em] tabular-nums sm:text-[1.3125rem]",
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
					</div>
					<p className="text-text-tertiary text-[0.6875rem]">{tProduct("priceWithVat")}</p>
				</div>
			</div>

			{/* The purchase row: across the bottom of the phone row, pinned to the bottom of the
			    card from `sm` up so uneven content never misaligns a row. Above the card-wide
			    link (`relative`), so the stepper and the button stay clickable. */}
			<div className="relative col-span-2 sm:px-4 sm:pt-3 sm:pb-4">
				{canAddDirectly ? (
					<CartForm action={addListingItemToCartAction}>
						<div className="flex items-stretch gap-2">
							<input type="hidden" name="channel" value={product.channel} />
							<input type="hidden" name="variantId" value={product.variantId ?? ""} />
							<input type="hidden" name="maxQuantity" value={product.quantityAvailable ?? ""} />
							<QuantityStepper name="quantity" max={product.quantityAvailable ?? undefined} compact />
							<AddButton />
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
