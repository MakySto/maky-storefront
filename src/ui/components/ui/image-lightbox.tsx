"use client";

import * as React from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
	url: string;
	alt?: string | null;
}

interface ImageLightboxProps {
	images: LightboxImage[];
	productName: string;
	initialIndex: number;
	onClose: () => void;
	closeLabel: string;
	previousLabel?: string;
	nextLabel?: string;
}

function getAlt(image: LightboxImage, productName: string, index: number) {
	return image.alt?.trim() || `${productName} – ${index + 1}`;
}

export function ImageLightbox({
	images,
	productName,
	initialIndex,
	onClose,
	closeLabel,
	previousLabel = "Previous image",
	nextLabel = "Next image",
}: ImageLightboxProps) {
	const [mounted, setMounted] = React.useState(false);
	const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
	const closeRef = React.useRef<HTMLButtonElement>(null);

	const hasMultiple = images.length > 1;

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		setCurrentIndex(initialIndex);
	}, [initialIndex]);

	const goNext = React.useCallback(() => {
		setCurrentIndex((i) => (i + 1) % images.length);
	}, [images.length]);

	const goPrev = React.useCallback(() => {
		setCurrentIndex((i) => (i - 1 + images.length) % images.length);
	}, [images.length]);

	React.useEffect(() => {
		if (!mounted) return;

		const previousBodyOverflow = document.body.style.overflow;
		const previousHtmlOverflow = document.documentElement.style.overflow;

		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";

		const raf = window.requestAnimationFrame(() => {
			closeRef.current?.focus();
		});

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				return;
			}

			if (!hasMultiple) return;

			if (e.key === "ArrowRight") {
				e.preventDefault();
				goNext();
			}

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				goPrev();
			}
		};

		document.addEventListener("keydown", onKey);

		return () => {
			window.cancelAnimationFrame(raf);
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	}, [mounted, hasMultiple, goNext, goPrev, onClose]);

	if (!mounted) {
		return null;
	}

	const image = images[currentIndex];

	return createPortal(
		<div
			className="fixed inset-0 z-[var(--z-modal)] bg-black/92 backdrop-blur-md"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={productName}
		>
			<div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-3 pt-3 pb-3 sm:px-6 sm:pt-6 sm:pb-6">
				{/* Top bar */}
				<div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
					{hasMultiple ? (
						<div className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
							{currentIndex + 1} / {images.length}
						</div>
					) : (
						<div />
					)}

					<button
						ref={closeRef}
						type="button"
						onClick={onClose}
						className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
						aria-label={closeLabel}
					>
						<X className="h-5 w-5" aria-hidden="true" />
					</button>
				</div>

				{/* Main image stage */}
				<div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center">
					{/* Desktop arrows */}
					{hasMultiple && (
						<div className="pointer-events-none absolute inset-y-0 right-0 left-0 z-10 hidden md:block">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									goPrev();
								}}
								className="pointer-events-auto absolute top-1/2 left-0 -translate-y-1/2 rounded-xl border border-white/10 bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
								aria-label={previousLabel}
							>
								<ChevronLeft className="h-6 w-6" aria-hidden="true" />
							</button>

							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									goNext();
								}}
								className="pointer-events-auto absolute top-1/2 right-0 -translate-y-1/2 rounded-xl border border-white/10 bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
								aria-label={nextLabel}
							>
								<ChevronRight className="h-6 w-6" aria-hidden="true" />
							</button>
						</div>
					)}

					{/* Image container */}
					<div
						className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<Image
							src={image.url}
							alt={getAlt(image, productName, currentIndex)}
							fill
							className="object-contain p-4 sm:p-6 md:p-8"
							sizes="100vw"
							priority
						/>
					</div>
				</div>

				{/* Thumbnail rail */}
				{hasMultiple && (
					<div className="mt-3 flex justify-center" onClick={(e) => e.stopPropagation()}>
						<div className="scrollbar-hide flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-white/8 bg-black/30 p-1.5 shadow-lg backdrop-blur-md">
							{images.map((img, index) => (
								<button
									key={`lb-${img.url}-${index}`}
									type="button"
									onClick={() => setCurrentIndex(index)}
									aria-label={getAlt(img, productName, index)}
									aria-current={currentIndex === index ? "true" : undefined}
									className={cn(
										"relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border bg-white/90 transition-all sm:h-16 sm:w-16",
										currentIndex === index
											? "border-white/80 shadow-md ring-1 shadow-black/30 ring-white/60"
											: "border-white/10 opacity-60 hover:opacity-90",
									)}
								>
									<Image
										src={img.url}
										alt={getAlt(img, productName, index)}
										fill
										className="object-contain p-1"
										sizes="64px"
									/>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Mobile arrows */}
				{hasMultiple && (
					<div className="mt-3 flex items-center justify-center gap-3 md:hidden">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								goPrev();
							}}
							className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-4 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
							aria-label={previousLabel}
						>
							<ChevronLeft className="h-5 w-5" aria-hidden="true" />
						</button>

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								goNext();
							}}
							className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-4 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
							aria-label={nextLabel}
						>
							<ChevronRight className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}
