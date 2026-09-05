"use client";

import * as React from "react";
import Image from "next/image";
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
import { ImageLightbox, imageKey, type LightboxImage } from "@/ui/components/ui/image-lightbox";
import { ImageCarouselEmpty } from "@/ui/components/ui/image-carousel-empty";

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

function getAlt(image: LightboxImage, productName: string, index: number) {
	return image.alt?.trim() || `${productName} – ${index + 1}`;
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
					<div className="border-border-default relative w-full overflow-hidden rounded-lg border bg-white">
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
										aria-label={getAlt(image, productName, index)}
									>
										<Image
											src={image.url}
											alt={getAlt(image, productName, index)}
											fill
											className="object-contain p-2"
											// Breaks at 1024, where the PDP grid actually becomes two
											// columns — not at 768. The old string switched to 50vw at
											// 769px while the layout stayed single-column to 1023px, so
											// on a tablet the gallery painted ~852 CSS px and asked the
											// browser for ~450. That under-fetch is a visibly soft image,
											// and it is the half of the "blurry gallery" report that the
											// frontend can actually fix.
											//
											// 596px is the real column, not "half of max-w-7xl": the grid
											// is 1.1fr to 1fr, inside lg:px-8 (64px) with xl:gap-20 (80px),
											// so (1280 - 64 - 80) * 1.1/2.1 = 595.05. 52vw generously covers
											// the 1024-1279 band (473-607px actual) — over-declaring costs
											// bytes, under-declaring costs sharpness.
											sizes="(min-width: 1280px) 596px, (min-width: 1024px) 52vw, 100vw"
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
						<div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
							<ZoomIn className="h-3 w-3" aria-hidden="true" />
						</div>

						{/* Arrows */}
						{showArrows && images.length > 1 && (
							<>
								<CarouselPrevious
									variant="ghost"
									className={cn(
										"border-border-default left-2 hidden border bg-white/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white md:flex",
										"disabled:opacity-0",
									)}
								/>
								<CarouselNext
									variant="ghost"
									className={cn(
										"border-border-default right-2 hidden border bg-white/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white md:flex",
										"disabled:opacity-0",
									)}
								/>
							</>
						)}
					</div>

					{/* Mobile dots */}
					{showDots && images.length > 1 && <CarouselDots className="mt-2 md:hidden" />}
				</Carousel>

				{/* Thumbnails */}
				{showThumbnails && images.length > 1 && (
					<div className="scrollbar-hide hidden snap-x snap-mandatory scroll-pl-1 gap-2 overflow-x-auto scroll-smooth md:flex">
						{images.map((image, index) => (
							<button
								type="button"
								key={`thumb-${imageKey(image, index)}`}
								onClick={() => scrollToImage(index)}
								aria-label={getAlt(image, productName, index)}
								aria-current={selectedIndex === index ? "true" : undefined}
								className={cn(
									"relative flex h-20 w-20 flex-shrink-0 snap-start items-center justify-center overflow-hidden rounded-md border bg-white p-1 transition-all",
									"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
									selectedIndex === index
										? "border-text-primary ring-text-primary ring-1"
										: "border-border-default opacity-60 hover:opacity-100",
								)}
							>
								<Image
									src={image.url}
									alt={getAlt(image, productName, index)}
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
				/>
			)}
		</>
	);
}

export { useCarousel };
