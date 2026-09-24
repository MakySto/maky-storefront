import { type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";
import type { SceneryImage } from "@/lib/homepage/scenery";
import { cn } from "@/lib/utils";

interface CategoryHeroProps {
	title: string;
	description?: string | null;
	/** The small capitals over the title — the category's line, or its parent's name. */
	eyebrow?: string | null;
	/** The category's scenery photo (its own, or its parent's), or none. */
	photo?: SceneryImage | null;
	breadcrumbs: BreadcrumbItem[];
	/** The shop's promises along the banner's foot, on a desktop (`HeroBenefits variant="banner"`). */
	benefits?: ReactNode;
}

/**
 * The head of a listing: a photographic banner in the homepage hero's manner — eyebrow, a large
 * title, the category's own words and, on a desktop, the shop's four promises along its foot —
 * lower than the hero, so the products stay near (premium redesign, second pass 2026-09-24).
 *
 * The photo is scenery — the category's own entry in `storefront-imagery.ts`, its parent's for
 * a sub-category, or the owner's banner from Payload once published — graded a touch warmer,
 * with the words as HTML over its darker left. Without a photo it is the same banner in dark
 * graphite with the mountain line drawn along its right edge, never a product cut-out blown up
 * behind the text.
 *
 * On a phone it is a compact band with the words at its foot.
 */
export function CategoryHero({
	title,
	description,
	eyebrow,
	photo,
	breadcrumbs,
	benefits,
}: CategoryHeroProps) {
	return (
		<section className="bg-scrim text-text-inverse relative isolate overflow-hidden">
			{photo ? (
				<>
					<Image
						src={photo.url}
						alt=""
						fill
						priority
						fetchPriority="high"
						sizes="100vw"
						style={
							{ "--banner-pos": photo.position, "--banner-pos-mobile": photo.mobilePosition } as CSSProperties
						}
						className="-z-10 object-cover object-[var(--banner-pos-mobile)] brightness-[1.06] contrast-[1.05] saturate-[1.18] sepia-[0.12] lg:object-[var(--banner-pos)]"
					/>
					<div
						aria-hidden="true"
						className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_0%,var(--color-copper-300),transparent_65%)] opacity-55 mix-blend-soft-light"
					/>
					<div
						aria-hidden="true"
						className="from-scrim/90 via-scrim/50 to-scrim/10 sm:from-scrim/85 sm:via-scrim/40 absolute inset-0 -z-10 bg-linear-to-t sm:bg-linear-to-r sm:via-45% sm:to-transparent sm:to-80%"
					/>
					<div
						aria-hidden="true"
						className="from-scrim/70 absolute inset-x-0 bottom-0 -z-10 hidden h-32 bg-linear-to-t to-transparent lg:block"
					/>
				</>
			) : (
				<>
					<div
						aria-hidden="true"
						className="from-forest-950 via-scrim to-scrim absolute inset-0 -z-10 bg-linear-to-br"
					/>
					<div
						aria-hidden="true"
						className="art-mountains bg-copper-400/35 absolute right-4 bottom-0 -z-10 hidden h-[85%] w-[36rem] max-w-[60%] sm:block lg:right-10"
					/>
				</>
			)}
			<div
				className={cn(
					"max-w-page mx-auto flex flex-col justify-end px-4 pt-14 pb-7 sm:px-6 sm:pb-9 lg:px-8",
					photo
						? "min-h-[16rem] sm:min-h-[19rem] lg:min-h-[25rem] lg:pt-12 lg:pb-8"
						: "min-h-[13rem] lg:min-h-[19rem] lg:pb-8",
				)}
			>
				<Breadcrumbs items={breadcrumbs} tone="onImage" className="mb-4" />
				{eyebrow && (
					<p className="text-text-inverse/85 mb-2 text-xs font-semibold tracking-[0.2em] uppercase sm:text-[0.8125rem]">
						{eyebrow}
					</p>
				)}
				<h1 className="max-w-3xl text-[2.25rem] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance break-words sm:text-5xl lg:text-[4.25rem]">
					{title}
				</h1>
				{description && (
					<p className="text-text-inverse/90 mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed sm:text-base lg:text-lg">
						{description}
					</p>
				)}
				{benefits}
			</div>
		</section>
	);
}
