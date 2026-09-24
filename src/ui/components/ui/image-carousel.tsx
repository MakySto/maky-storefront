"use client";

import * as React from "react";
import { ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
	CarouselDots,
	useCarousel,
	type CarouselApi,
} from "@/ui/components/ui/carousel";
import {
	ImageLightbox,
	imageAlt,
	imageKey,
	imageNavigationLabel,
	type LightboxImage,
} from "@/ui/components/ui/image-lightbox";
import { ImageCarouselEmpty } from "@/ui/components/ui/image-carousel-empty";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

export type { LightboxImage as ImageCarouselImage };

interface ImageCarouselProps {
	images: LightboxImage[];
	productName: string;
	showArrows?: boolean;
	showDots?: boolean;
	showThumbnails?: boolean;
	onIndexChange?: (index: number) => void;
	className?: string;
	/**
	 * Aspect ratio of the media canvas. A square canvas wastes a lot of vertical
	 * space on this catalogue — roof boxes, bars and carriers are all wide — and
	 * on the PDP that pushed the gallery column far past the bottom of the
	 * purchase summary beside it.
	 */
	aspectClassName?: string;
}

export function ImageCarousel({
	images,
	productName,
	showArrows = true,
	showDots = true,
	showThumbnails = true,
	onIndexChange,
	className,
	aspectClassName = "aspect-square",
}: ImageCarouselProps) {
	const [api, setApi] = React.useState<CarouselApi>();
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const [lightboxOpen, setLightboxOpen] = React.useState(false);

	const tCommon = useTranslations("common");
	const tProduct = useTranslations("product");

	const imagesSignature = React.useMemo(() => images.map((img) => img.url).join("|"), [images]);

	React.useEffect(() => {
		setSelectedIndex(0);
		api?.scrollTo(0, true);
	}, [imagesSignature, api]);

	React.useEffect(() => {
		if (!api) return;

		const onSelect = () => {
			const index = api.selectedScrollSnap();
			setSelectedIndex(index);
			onIndexChange?.(index);
		};

		api.on("select", onSelect);
		onSelect();
		return () => {
			api.off("select", onSelect);
		};
	}, [api, onIndexChange]);

	const scrollToImage = React.useCallback((index: number) => api?.scrollTo(index), [api]);

	// Empty state (after all hooks)
	if (!images.length) {
		return <ImageCarouselEmpty />;
	}

	return (
		<>
			<div className={cn("flex flex-col gap-3", className)}>
				{/* Main carousel */}
				<Carousel setApi={setApi} opts={{ align: "start", loop: images.length > 1 }} className="group w-full">
					<div className="border-border-subtle bg-surface-card relative w-full overflow-hidden rounded-sm border shadow-xs">
						<CarouselContent className="ml-0">
							{images.map((image, index) => (
								<CarouselItem key={`img-${imageKey(image, index)}`} className="pl-0">
									<button
										type="button"
										className={cn(
											"relative flex w-full cursor-zoom-in items-center justify-center",
											aspectClassName,
										)}
										onClick={() => setLightboxOpen(true)}
										aria-label={imageNavigationLabel(image, productName, index)}
									>
										<ResilientProductImage
											src={image.url}
											alt={imageAlt(image, productName, index)}
											fill
											className="object-contain p-3 sm:p-6"
											// Breaks at 1024, where the PDP grid actually becomes two
											// columns — not at 768: an under-declared width is a visibly soft
											// image, the half of the "blurry gallery" report the frontend can fix.
											//
											// 700px is the real column since the 2026-09 redesign: max-w-page
											// (88rem) inside lg:px-8, split 1.2fr to 1fr around xl:gap-16, so
											// (1408 - 64 - 64) * 1.2/2.2 = 698. 55vw covers 1024-1439.
											sizes="(min-width: 1440px) 700px, (min-width: 1024px) 55vw, 100vw"
											priority={index === 0}
											// `priority` only emits the preload link and drops
											// `loading="lazy"` — in Next 16 it does NOT imply a priority
											// hint, so the request still started at Chrome priority Low
											// behind the fonts and the JS chunks. next/image threads
											// `fetchPriority` into both ReactDOM.preload() and the <img>,
											// so this one prop covers the preload and the element.
											fetchPriority={index === 0 ? "high" : undefined}
										/>
									</button>
								</CarouselItem>
							))}
						</CarouselContent>

						{/* Zoom hint */}
						<div className="bg-surface-card/90 text-text-secondary pointer-events-none absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
							<ZoomIn className="h-4 w-4" aria-hidden="true" />
						</div>

						{/* Where you are in the gallery: "3 / 8", always visible, bottom right. */}
						{images.length > 1 && (
							<div
								className="bg-scrim/70 text-text-inverse pointer-events-none absolute right-3 bottom-3 rounded-full px-3 py-1 text-xs font-semibold tabular-nums backdrop-blur-sm"
								aria-live="polite"
							>
								<span aria-hidden="true">
									{selectedIndex + 1} / {images.length}
								</span>
								<span className="sr-only">
									{tProduct("imageCounter", { current: selectedIndex + 1, total: images.length })}
								</span>
							</div>
						)}

						{/* Arrows */}
						{showArrows && images.length > 1 && (
							<>
								{/* Always there on a desktop, as in the approved design — a pointer user should not
								    have to discover them by hovering. */}
								<CarouselPrevious
									aria-label={tCommon("back")}
									variant="ghost"
									className={cn(
										"border-border-subtle bg-surface-card/95 text-text-primary hover:bg-surface-card left-4 hidden h-11 w-11 border shadow-md transition-transform hover:scale-105 md:flex",
										"disabled:opacity-0",
									)}
								/>
								<CarouselNext
									aria-label={tCommon("next")}
									variant="ghost"
									className={cn(
										"border-border-subtle bg-surface-card/95 text-text-primary hover:bg-surface-card right-4 hidden h-11 w-11 border shadow-md transition-transform hover:scale-105 md:flex",
										"disabled:opacity-0",
									)}
								/>
							</>
						)}
					</div>

					{/* Mobile dots */}
					{/* Dots only while they can be told apart; past eight the "3 / 18" counter says it. */}
					{showDots && images.length > 1 && images.length <= 8 && <CarouselDots className="mt-2 md:hidden" />}
				</Carousel>

				{/* Thumbnails */}
				{showThumbnails && images.length > 1 && (
					<div className="scrollbar-hide hidden snap-x snap-mandatory scroll-pl-1 gap-2.5 overflow-x-auto scroll-smooth p-0.5 md:flex">
						{images.map((image, index) => (
							<button
								type="button"
								key={`thumb-${imageKey(image, index)}`}
								onClick={() => scrollToImage(index)}
								aria-label={imageNavigationLabel(image, productName, index)}
								aria-current={selectedIndex === index ? "true" : undefined}
								className={cn(
									"bg-surface-card relative flex h-20 w-24 flex-shrink-0 snap-start items-center justify-center overflow-hidden rounded-xs border p-1 transition-all lg:h-[5.5rem] lg:w-28",
									"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
									selectedIndex === index
										? "border-brand ring-brand ring-1"
										: "border-border-subtle opacity-70 hover:opacity-100",
								)}
							>
								<ResilientProductImage
									src={image.url}
									alt=""
									fill
									className="object-contain p-1"
									sizes="80px"
								/>
							</button>
						))}
					</div>
				)}
			</div>

			{/* Lightbox */}
			{lightboxOpen && (
				<ImageLightbox
					images={images}
					productName={productName}
					initialIndex={selectedIndex}
					onClose={() => setLightboxOpen(false)}
					closeLabel={tCommon("close")}
					previousLabel={tCommon("back")}
					nextLabel={tCommon("next")}
				/>
			)}
		</>
	);
}

export { useCarousel };
