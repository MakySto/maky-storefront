"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/ui/badge";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import {
	ACTION_ROW,
	CARD,
	DETAIL_LINK,
	FACTS_COLUMN,
	MEDIA_BOX,
	MEDIA_COLUMN,
	PRICE_ROW,
	SPECS_BLOCK,
	TITLE,
} from "@/ui/components/listing/card-layout";
import { cardKicker, setKicker } from "@/ui/components/listing/kicker";
import { ListingMedia } from "@/ui/components/listing/listing-media";
import { ListingSpecs, withComposedLabels, type ListingSpec } from "@/ui/components/listing/listing-specs";
import { AvailabilityBadge } from "@/ui/components/product/availability-badge";
import { StarRating } from "@/ui/components/product/star-rating";
import { WishlistButton } from "@/ui/components/wishlist/wishlist-button";
import { cn } from "@/lib/utils";
import { quoteInsteadOfPrice } from "@/config/quote-only";
import { isPlaceholderProductImage } from "@/lib/product-image";
import type { SetTitle } from "@/lib/fitment/set-title";
import { useLocale } from "@/providers/locale-provider";
import { addListingItemToCartAction } from "./actions";
import { CartForm } from "./cart-form";
import { AddButton } from "./listing-add-to-cart";

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
	/**
	 * The set's name taken apart into the product and the car, when it can be. With it the card says
	 * the car and the years once, under a short name, instead of printing them in a long name and
	 * again beneath it. Absent, the name is printed whole.
	 */
	setTitle?: SetTitle | null;
	/**
	 * The version of a van the set is made for, in the source's own words ("Určené len pre verziu: dĺžka L4,
	 * vysoká strecha."). Present only where every application of the set says the same, so a set made for
	 * several versions says nothing and its page does.
	 */
	versionNote?: string | null;
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

	// A product this market does not sell, in a category that asks for a quote instead of a price
	// (`config/quote-only.ts`): the card says so where the price would be.
	const quoteOnly = quoteInsteadOfPrice({
		isPurchasable: product.isPurchasable,
		categorySlug: product.category?.slug,
	});

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

	const shownName = product.fit && product.setTitle ? product.setTitle.model : product.name;
	// A set taken apart is short and its name carries the maker: its line over the name is a phone's
	// only (who made it and the shelf), as on the vehicle page's card. Any other name keeps the quiet
	// line that says only what the name does not.
	const takenApart = Boolean(product.fit && product.setTitle);
	const kicker = takenApart
		? setKicker(product.brand, product.category?.name)
		: cardKicker(shownName, product.brand, product.category?.name);
	// A combined size ("190 × 80 × 40 cm") and a kit's bars ("4 × 180 cm") have no attribute to take their name from.
	const specs = withComposedLabels(product.specs ?? [], {
		dimensions: tListing("specDimensions"),
		bars: tListing("specBars"),
	});
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
				{/* The maker and the shelf, only what the name does not already say. */}
				{(kicker.brand || kicker.category) && (
					<p
						className={cn("text-text-tertiary line-clamp-1 text-xs leading-snug", takenApart && "sm:hidden")}
					>
						{kicker.brand && (
							<span className="text-text-secondary font-bold tracking-[0.07em] uppercase">
								{kicker.brand}
							</span>
						)}
						{kicker.brand && kicker.category && <span aria-hidden="true"> · </span>}
						{kicker.category && <span>{kicker.category}</span>}
					</p>
				)}
				{/* Up to four lines for a name that is printed whole: a roof-rack set's name ends with
				    the car and the roof type, the part a shopper checks. A name taken apart is short. */}
				<h2 className={cn(TITLE, takenApart && "sm:mt-0", !(kicker.brand || kicker.category) && "mt-0")}>
					<Link
						href={product.href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						{/* The whole card is the link's target area; the title carries its name. */}
						<span className="absolute inset-0" aria-hidden="true" />
						{shownName}
					</Link>
				</h2>
				{/* What the set is for. Taken apart: the car and the years on one line, the roof under
				    it. Whole: the roof and the years in the words the title buries at its end. */}
				{product.fit && product.setTitle && (
					<>
						<p
							className="text-text-secondary mt-1 line-clamp-2 text-[0.8125rem] leading-snug"
							data-testid="card-vehicle"
						>
							{product.setTitle.vehicle}
							<span aria-hidden="true"> · </span>
							{product.fit.years}
						</p>
						{product.fit.roof && (
							<p
								className="text-text-primary mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug font-medium"
								data-testid="card-roof"
							>
								{product.fit.roof}
							</p>
						)}
					</>
				)}
				{product.versionNote && (
					<p
						className="text-text-primary mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug font-medium"
						data-testid="card-version"
					>
						{product.versionNote}
					</p>
				)}
				{product.fit && !product.setTitle && (
					<p
						className="text-text-secondary mt-1 line-clamp-2 text-[0.8125rem] leading-snug"
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
			</div>

			<div className={SPECS_BLOCK}>
				{specs.length > 0 ? (
					<ListingSpecs specs={specs} className="border-border-subtle border-t pt-2.5" />
				) : (
					product.note && <p className="text-text-secondary line-clamp-1 text-[0.8125rem]">{product.note}</p>
				)}
				{product.includes && (
					<p className="text-text-secondary mt-2 line-clamp-2 text-[0.8125rem] leading-snug">
						{product.includes}
					</p>
				)}
				{/* The code is for finding the product again, not for choosing it: a quiet line, and not at
				    all for a set, whose code is several components' codes joined with a bar. */}
				{product.productCode && !isSet && !product.productCode.includes("|") && (
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
				{quoteOnly ? (
					<span className="text-text-primary text-base leading-tight font-semibold">
						{tProduct("requestQuote")}
					</span>
				) : (
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
				)}
				{product.isPurchasable ? (
					<AvailabilityBadge
						label={tCommon}
						short
						mode={product.availabilityMode}
						trackInventory={product.trackInventory}
						quantityAvailable={product.quantityAvailable}
						className="text-xs leading-snug font-semibold whitespace-nowrap"
					/>
				) : quoteOnly ? null : (
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
