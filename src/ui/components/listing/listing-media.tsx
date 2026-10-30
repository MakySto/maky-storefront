"use client";

import { useEffect, useRef, useState } from "react";

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
 *   - the second photograph is not in the page at all until a mouse (or a pen) enters the card or the
 *     keyboard reaches it, so a listing of twenty cards costs twenty photographs, and a phone, where
 *     only a finger ever touches a card, never asks for the second one;
 *   - the first photograph steps aside only once the second has arrived, so a slow second photograph
 *     can never leave an empty box, and one that fails leaves the first in place;
 *   - `motion-reduce` keeps the swap (an instant change is not motion) and drops the zoom.
 */
function ListingMediaState({
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
	const anchor = useRef<HTMLSpanElement>(null);
	const hasHover = Boolean(hoverSrc) && hoverSrc !== src;
	// A pointer that can hover, or the keyboard, has reached the card: the second photograph may be fetched.
	const [armed, setArmed] = useState(false);
	// The second photograph has arrived: only now may the first one give way to it.
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!hasHover || armed) return;
		const card = anchor.current?.closest('[class~="group/card"]');
		if (!card) return;
		const arm = () => setArmed(true);
		// A finger is a "pointerenter" too, and leaves `:hover` and focus stuck on a tapped card.
		const onEnter = (event: Event) => {
			const type = (event as PointerEvent).pointerType;
			if (type === "mouse" || type === "pen") arm();
		};
		const onFocus = (event: Event) => {
			if ((event.target as Element | null)?.matches?.(":focus-visible")) arm();
		};
		card.addEventListener("pointerenter", onEnter);
		card.addEventListener("focusin", onFocus);
		return () => {
			card.removeEventListener("pointerenter", onEnter);
			card.removeEventListener("focusin", onFocus);
		};
	}, [hasHover, armed]);

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

	return (
		<>
			{hasHover && !armed ? <span ref={anchor} hidden /> : null}
			<ResilientProductImage
				src={src}
				alt={alt}
				fill
				sizes={sizes}
				priority={priority}
				className={cn(
					"object-contain p-2 transition-[opacity,transform] duration-500 ease-out sm:p-3",
					ready
						? "group-focus-within/card:opacity-0 group-hover/card:opacity-0"
						: "motion-safe:group-hover/card:scale-[1.03]",
					className,
				)}
			/>
			{hasHover && armed ? (
				<ResilientProductImage
					src={hoverSrc!}
					alt=""
					fill
					sizes={sizes}
					loading="eager"
					aria-hidden="true"
					// A second photograph that cannot be fetched is nothing, not the grey stand-in over the first.
					fallback={<></>}
					onLoad={() => setReady(true)}
					className={cn(
						"object-contain p-2 opacity-0 transition-opacity duration-500 ease-out sm:p-3",
						ready && "group-focus-within/card:opacity-100 group-hover/card:opacity-100",
						className,
					)}
				/>
			) : null}
		</>
	);
}

/** A different photograph is a different card face: it starts unarmed, with nothing waiting on a second one. */
export function ListingMedia(props: Parameters<typeof ListingMediaState>[0]) {
	return <ListingMediaState key={`${props.src ?? ""}|${props.hoverSrc ?? ""}`} {...props} />;
}
