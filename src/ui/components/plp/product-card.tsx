"use client";

import Link from "next/link";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import { AvailabilityBadge } from "@/ui/components/product/availability-badge";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";
import { addListingItemToCart } from "./actions";

export interface ProductCardData {
	id: string;
	name: string;
	slug: string;
	/** Manufacturer (Thule, Menabo…), not the category. */
	brand?: string | null;
	/** One-line distinguishing fact — volume, capacity, load. */
	note?: string | null;
	sku?: string | null;
	/** Set only when the product has exactly one variant. */
	variantId?: string | null;
	quantityAvailable?: number | null;
	availabilityMode?: string | null;
	price: number;
	compareAtPrice?: number | null;
	currency: string;
	image: string;
	imageAlt?: string;
	hoverImage?: string | null;
	href: string;
	/** Saleor channel slug — the add-to-cart action needs it in the form. */
	channel: string;
	badge?: "sale" | "new" | null;
	colors?: { name: string; hex: string }[];
	sizes?: string[];
	category?: { id: string; name: string; slug: string } | null;
	createdAt?: string | null;
	hasVariants?: boolean;
}

interface ProductCardProps {
	product: ProductCardData;
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
 * Listing card.
 *
 * Title sits ABOVE the image, which is unusual for a commerce grid but right for
 * this catalogue: the names are long and technical and differ only at the end
 * ("… Motion 3 - XXL - Titan Glossy"), so they are far easier to compare when
 * they line up as text than when they trail under a picture.
 *
 * That layout only holds if every card starts its image at the same height, so
 * the title block is a FIXED two lines and the note a fixed one — otherwise a
 * one-line name in a row of three-line names shunts its image upward and the row
 * falls apart. Same reasoning pins price and actions to the bottom.
 *
 * The media area is square and `object-contain`. The previous card used a 3/4
 * portrait box with `object-cover`, which cropped every wide product — the roof
 * boxes and transport cages that make up most of this catalogue.
 */
export function ProductCard({ product, priority = false }: ProductCardProps) {
	const tCommon = useTranslations("common");
	const tProduct = useTranslations("product");
	const { locale } = useLocale();

	const formatPrice = (amount: number, currency: string) =>
		new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

	const badgeLabel =
		product.badge === "sale" ? tCommon("sale") : product.badge === "new" ? tCommon("new") : null;

	// Only offer a direct add when there is genuinely nothing to choose.
	const canAddDirectly = Boolean(product.variantId) && product.quantityAvailable !== 0;

	// A product mid-import has no thumbnail yet. Show a quiet placeholder rather
	// than the broken-image glyph, which reads as a fault in the shop.
	const hasImage = Boolean(product.image) && product.image !== "/placeholder.svg";

	return (
		<article className="group border-border-subtle bg-surface-card flex flex-col rounded-lg border p-3 transition-shadow duration-200 hover:shadow-md">
			{/* Title + note, above the image and fixed in height so images align */}
			<Link href={product.href} className="block focus-visible:outline-hidden">
				<h3 className="text-text-primary line-clamp-2 min-h-[2.75rem] text-sm leading-snug font-medium underline-offset-2 group-hover:underline">
					{product.name}
				</h3>
				<p className="text-text-tertiary mt-0.5 line-clamp-2 min-h-[2.25rem] text-xs">{product.note ?? ""}</p>
			</Link>

			{/* Square, contained, centred — never crops a wide roof box */}
			<Link
				href={product.href}
				className="border-border-subtle relative mt-2 block aspect-square overflow-hidden rounded-md border bg-white"
			>
				{hasImage ? (
					<Image
						src={product.image}
						alt={product.imageAlt || product.name}
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
						className="object-contain p-3 transition-transform duration-300 ease-out md:group-hover:scale-105"
						priority={priority}
					/>
				) : (
					<span className="text-text-tertiary absolute inset-0 flex items-center justify-center px-4 text-center text-xs">
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

			{/* Category + manufacturer */}
			<div className="text-text-tertiary mt-3 flex flex-wrap items-baseline justify-center gap-x-2 text-center text-xs">
				<span className="truncate">{product.category?.name}</span>
				{product.brand && (
					<>
						<span aria-hidden>·</span>
						<span className="text-text-secondary font-medium">{product.brand}</span>
					</>
				)}
			</div>

			{/* SKU + availability */}
			<div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
				{product.sku && (
					<span className="text-text-tertiary text-xs tabular-nums">
						{tProduct("sku")}: <span className="font-medium">{product.sku.toUpperCase()}</span>
					</span>
				)}
				<AvailabilityBadge
					mode={product.availabilityMode}
					quantityAvailable={product.quantityAvailable}
					className="text-xs"
				/>
			</div>

			{/* Pinned to the bottom so uneven content above never misaligns a row */}
			<div className="mt-auto pt-3">
				<div className="flex items-baseline justify-center gap-2">
					<span className={cn("text-lg font-semibold", product.compareAtPrice && "text-price-sale")}>
						{formatPrice(product.price, product.currency)}
					</span>
					{product.compareAtPrice && (
						<span className="text-price-compare text-sm line-through">
							{formatPrice(product.compareAtPrice, product.currency)}
						</span>
					)}
				</div>
				<p className="text-text-tertiary mt-0.5 text-center text-[0.6875rem]">{tProduct("priceWithVat")}</p>

				{canAddDirectly ? (
					<form action={addListingItemToCart} className="mt-2 flex items-stretch gap-2">
						<input type="hidden" name="channel" value={product.channel} />
						<input type="hidden" name="variantId" value={product.variantId ?? ""} />
						<input type="hidden" name="maxQuantity" value={product.quantityAvailable ?? ""} />
						<QuantityStepper name="quantity" max={product.quantityAvailable ?? undefined} compact />
						<AddButton />
					</form>
				) : (
					// Button is a plain <button> in this codebase — no asChild slot — so
					// the link carries the styling itself.
					<Link
						href={product.href}
						className="border-input hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mt-2 flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						{tCommon("viewDetail")}
					</Link>
				)}
			</div>
		</article>
	);
}
