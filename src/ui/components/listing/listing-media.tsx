"use client";

import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";
import { cn } from "@/lib/utils";

/**
 * The photograph of a listing card: the product whole, never cropped, and — when the catalogue has
 * a second real photograph — a soft cross-fade to it while the card is hovered or has the keyboard.
 *
 * The parent owns the box (aspect ratio, width, background) and must be `relative` inside an
 * ancestor marked `group/card`; this fills it. That is what lets one component serve the grid
 * (a 4:3 window on top) and the list (a square on the left) without knowing which it is in.
 *
 * Honest by construction:
 *   - the second photograph is the product's own next gallery image, never another product's;
 *   - with no photograph at all the box says so in words and shows no image — a neutral stand-in,
 *     not a borrowed picture;
 *   - the second photograph is lazy and never preloaded, so it costs nothing until a hover asks for
 *     it, and a phone, which has no hover, never downloads it at all as far as the browser's lazy
 *     loading allows;
 *   - `motion-reduce` keeps the swap (an instant change is not motion) and drops the zoom.
 */
export function ListingMedia({
	src,
	alt,
	hoverSrc,
	sizes,
	priority = false,
	emptyLabel,
	className,
}: {
	src: string | null;
	alt: string;
	hoverSrc?: string | null;
	sizes: string;
	/** Reserve for the one LCP candidate on a page: the first card. */
	priority?: boolean;
	/** Said instead of a picture when there is none ("Fotografia nie je k dispozícii"). */
	emptyLabel: string;
	className?: string;
}) {
	if (!src) {
		return (
			<span
				className={cn(
					"text-text-tertiary bg-surface-secondary absolute inset-0 flex items-center justify-center px-4 text-center text-xs",
					className,
				)}
			>
				{emptyLabel}
			</span>
		);
	}

	const hasHover = Boolean(hoverSrc) && hoverSrc !== src;

	return (
		<>
			<ResilientProductImage
				src={src}
				alt={alt}
				fill
				sizes={sizes}
				priority={priority}
				className={cn(
					"object-contain p-2 transition-[opacity,transform] duration-500 ease-out sm:p-3",
					hasHover
						? "group-focus-within/card:opacity-0 group-hover/card:opacity-0"
						: "motion-safe:group-hover/card:scale-[1.03]",
					className,
				)}
			/>
			{hasHover ? (
				<ResilientProductImage
					src={hoverSrc!}
					alt=""
					fill
					sizes={sizes}
					loading="lazy"
					aria-hidden="true"
					className={cn(
						"object-contain p-2 opacity-0 transition-opacity duration-500 ease-out group-focus-within/card:opacity-100 group-hover/card:opacity-100 sm:p-3",
						className,
					)}
				/>
			) : null}
		</>
	);
}
