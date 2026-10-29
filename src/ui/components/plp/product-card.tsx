"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckIcon, ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import {
	ACTION_ROW,
	CARD,
	DETAIL_LINK,
	FACTS_COLUMN,
	MEDIA_BOX,
	MEDIA_COLUMN,
	PRICE_ROW,
	TITLE,
} from "@/ui/components/listing/card-layout";
import { ListingMedia } from "@/ui/components/listing/listing-media";
import { DIMENSIONS_SPEC_KEY, ListingSpecs, type ListingSpec } from "@/ui/components/listing/listing-specs";
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
	/**
	 * What a vehicle-specific set is FOR, from the source's own application — the roof it needs and
	 * the model years it is made for, already in the reader's words. Absent for every product the
	 * compatibility programme has no row for. It is a statement about the SET, never about the
	 * shopper's car: it appears with or without a car chosen, and does not say "fits".
	 */
	fit?: { roof: string | null; years: string } | null;
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
	/**
	 * The product's own SECOND photograph, shown over the first while the card is hovered or has
	 * focus. Absent when the gallery holds one image, and then the card does not swap.
	 */
	hoverImage?: string | null;
	/**
	 * The three or four parameters that tell this product from its neighbours, already worded in the
	 * reader's language — from CFM's facets for a vehicle set, from the product's attributes for
	 * everything else. Only what the data carries: an absent parameter is absent, never a dash.
	 */
	specs?: ListingSpec[];
	/** What a complete set contains ("priečniky, pätky, montážny kit"), when CFM says. */
	includes?: string | null;
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
 * Third pass (owner, 2026-09-24/25): ONE card to a row on a phone, the photo on top and the full
 * width of the card; the product facts in the middle; a hairline, then the price, the lead time
 * and the purchase. The hierarchy:
 *
 *   photo + heart
 *   BRAND · category
 *   name · one distinguishing fact · SKU · stars
 *   ─────────────────────
 *   price  ● availability
 *   quantity + add
 *
 * - The photo is the product from Saleor, WHOLE (`object-contain` on the card's own white): a
 *   3:2 window on a phone, where one card spans the screen and a squarer one was mostly white
 *   above and below a roof box; 5:4 from 640px, in the narrower cards of a multi-column grid.
 * - The maker and the product's category (its market's own name, from Saleor) share one quiet
 *   line, the category in plain text, never a badge; a long one ("Nosiče bicyklov na ťažné
 *   zariadenie") wraps rather than being cut to a stub.
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
export function ProductCard({ product, priority = false, purchase = "stepper" }: ProductCardProps) {
	const tCommon = useTranslations("common");
	const tProduct = useTranslations("product");
	const tCart = useTranslations("cart");
	const tFit = useTranslations("fitment");
	const tListing = useTranslations("listing");
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

	const category = product.category;
	// A combined size ("190 × 80 × 40 cm") has no attribute to take its name from.
	const specs = (product.specs ?? []).map((spec) =>
		spec.key === DIMENSIONS_SPEC_KEY ? { ...spec, label: tListing("specDimensions") } : spec,
	);
	// A vehicle set is the one product whose detail page is where its conditions are read.
	const isSet = Boolean(product.fit);

	return (
		<article
			className={cn(
				CARD,
				// The title's link is the card's link (its span covers the card), and its own outline
				// would draw around the title alone: the keyboard focus rings the whole card instead.
				"has-[h2_a:focus-visible]:ring-ring has-[h2_a:focus-visible]:ring-2 has-[h2_a:focus-visible]:ring-offset-2",
			)}
		>
			<div className={MEDIA_COLUMN}>
				{/* The product whole, never cropped: wide boxes and bars fill the window, a tall carrier
				    stands in it. The window is a fixed ratio so nothing jumps while photographs load; in
				    a list it is the card's full height. */}
				<Link href={product.href} tabIndex={-1} aria-hidden="true" className={MEDIA_BOX}>
					<ListingMedia
						src={hasImage ? product.image : null}
						alt={product.imageAlt || product.name}
						hoverSrc={product.hoverImage}
						sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1439px) 25vw, 20vw"
						priority={priority}
						emptyLabel={tProduct("noImageAvailable")}
					/>
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
			<div className={FACTS_COLUMN}>
				{/* The maker, set like a wordmark but quieter than the name, and the category after it in
				    plain text. One line of running text, so a long category wraps under the maker. */}
				{(product.brand || category) && (
					<p className="text-text-tertiary line-clamp-2 text-xs leading-snug">
						{product.brand && (
							<span className="text-text-secondary font-bold tracking-[0.07em] uppercase">
								{product.brand}
							</span>
						)}
						{product.brand && category && <span aria-hidden="true"> · </span>}
						{category && <span>{category.name}</span>}
					</p>
				)}
				{/* Up to four lines: a roof-rack set's name ends with the car and the roof type, the
				    part a shopper checks. From sm, where cards share a row, a short name still
				    reserves two lines so the facts under it start at one height across the row; a
				    phone shows one card to a row and keeps no empty line. */}
				<h2 className={TITLE}>
					<Link
						href={product.href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						{/* The whole card is the link's target area; the title carries its name. */}
						<span className="absolute inset-0" aria-hidden="true" />
						{product.name}
					</Link>
				</h2>
				{/* The roof and the years the set is made for: two facts the title buries at its end.
				    Up to two lines so a long roof name wraps instead of being cut. */}
				{product.fit && (
					<p
						className="text-text-secondary mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug"
						data-testid="card-fit"
					>
						{product.fit.roof && (
							<>
								<span>{tFit("cardRoof", { roof: product.fit.roof })}</span>
								<span aria-hidden="true"> · </span>
							</>
						)}
						<span>{tFit("cardYears", { years: product.fit.years })}</span>
					</p>
				)}
				{specs.length > 0 ? (
					<ListingSpecs specs={specs} className="border-border-subtle mt-3 border-t pt-3" />
				) : (
					product.note && (
						<p className="text-text-secondary mt-1 line-clamp-1 text-[0.8125rem]">{product.note}</p>
					)
				)}
				{product.includes && (
					<p className="text-text-secondary mt-2 line-clamp-2 text-[0.8125rem] leading-snug">
						{product.includes}
					</p>
				)}
				{product.productCode && (
					<p className="text-text-tertiary mt-2 truncate text-xs">
						{tProduct("sku")}: <span className="tabular-nums">{product.productCode}</span>
					</p>
				)}

				{/* Renders nothing until something actually populates Product.rating */}
				<StarRating rating={product.rating} className="mt-1.5" />
			</div>

			{/* A hairline inset to the text, then the price and what the catalogue says about
			    availability. Not positioned: a click here still reaches the card-wide link. */}
			<div className={PRICE_ROW}>
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
			<div className={ACTION_ROW}>
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
					<Link href={product.href} className={DETAIL_LINK}>
						{isSet ? tListing("viewSet") : tCommon("viewDetail")}
					</Link>
				)}
			</div>
		</article>
	);
}
