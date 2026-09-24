"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
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
		// No icon here: at four columns the card leaves the button roughly 180px,
		// and the icon was enough to push "Pridať do košíka" into an ellipsis. A
		// truncated call to action is worse than a plain one.
		<Button type="submit" size="sm" disabled={pending} className="h-11 min-w-0 flex-1 px-2 text-sm">
			<span className="truncate">{tCommon("addToCart")}</span>
		</Button>
	);
}

/**
 * Listing card — the one card for category pages, search and the homepage.
 *
 * Photo first, then what the shopper decides by: brand and type on one line, the name
 * (up to three lines, four in the narrow phone row — Nordrive set names end with the car
 * and the roof type, the part a two-line clamp cut off), one distinguishing fact, availability, the price with its
 * tax note, and the quantity with the green add button. The SKU stays on the product
 * page; the category is plain text, not a second link; the photo has no frame of its
 * own inside the card's.
 *
 * On a phone it is a compact row: a 104 px photo on the left, the facts on the right and
 * the purchase row across the bottom, so the price and the button are on the first
 * screen instead of a full-width square photo above them. One column, quantity kept.
 *
 * From `sm` up the fixed title and note heights line the price rows up across a grid
 * row, and the purchase block is pinned to the bottom.
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

	const meta = [product.brand, product.category?.name].filter(Boolean);

	return (
		<article className="group border-border-subtle bg-surface-card grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-lg border p-3 transition-shadow duration-200 hover:shadow-md sm:flex sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0">
			{/* Square, contained, centred — never crops a wide roof box */}
			<Link
				href={product.href}
				tabIndex={-1}
				aria-hidden="true"
				className="relative block aspect-square self-start overflow-hidden rounded-sm bg-white sm:self-stretch sm:rounded-none"
			>
				{hasImage ? (
					<ResilientProductImage
						src={product.image}
						alt={product.imageAlt || product.name}
						fill
						sizes="(max-width: 639px) 104px, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
						className="object-contain p-1.5 transition-transform duration-300 ease-out sm:p-4 md:group-hover:scale-105"
						priority={priority}
					/>
				) : (
					<span className="text-text-tertiary absolute inset-0 flex items-center justify-center px-2 text-center text-xs sm:px-4">
						{tProduct("noImageAvailable")}
					</span>
				)}
				{badgeLabel && (
					<Badge
						variant={product.badge === "sale" ? "destructive" : "default"}
						className="absolute top-2 left-2"
					>
						{badgeLabel}
					</Badge>
				)}
			</Link>

			<div className="flex min-w-0 flex-col sm:flex-1 sm:px-4 sm:pt-3">
				{meta.length > 0 && (
					<p className="text-text-tertiary truncate text-xs">
						{product.brand && <span className="text-text-secondary font-semibold">{product.brand}</span>}
						{product.brand && product.category && <span aria-hidden="true"> · </span>}
						{product.category?.name}
					</p>
				)}
				<h2 className="text-text-primary mt-0.5 line-clamp-4 text-sm leading-snug font-semibold sm:line-clamp-3 sm:min-h-[3lh]">
					<Link
						href={product.href}
						className="text-text-primary underline-offset-2 group-hover:underline focus-visible:outline-hidden"
					>
						{product.name}
					</Link>
				</h2>
				<p className="text-text-secondary mt-1 line-clamp-1 text-xs sm:min-h-[1lh]">{product.note ?? ""}</p>

				<div className="mt-1.5">
					{product.isPurchasable ? (
						<AvailabilityBadge
							label={tCommon}
							mode={product.availabilityMode}
							trackInventory={product.trackInventory}
							quantityAvailable={product.quantityAvailable}
							className="text-xs"
						/>
					) : (
						<p className="text-text-secondary text-xs">{tCart("addUnavailable")}</p>
					)}
				</div>

				{/* Renders nothing until something actually populates Product.rating */}
				<StarRating rating={product.rating} className="mt-1.5" />

				<div className="mt-2 sm:mt-auto sm:pt-3">
					<div className="flex items-baseline gap-2">
						<span
							className={cn(
								"text-text-primary text-base font-bold tabular-nums sm:text-lg",
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

			{/* The purchase row: across the bottom of the compact phone row, pinned to the
			    bottom of the card from `sm` up so uneven content never misaligns a row. */}
			<div className="col-span-2 sm:px-4 sm:pt-3 sm:pb-4">
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
						className="border-input hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
					>
						{tCommon("viewDetail")}
					</Link>
				)}
			</div>
		</article>
	);
}
