import { type CSSProperties } from "react";
import Image from "next/image";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";
import type { SceneryImage } from "@/lib/homepage/scenery";
import { cn } from "@/lib/utils";

interface CategoryHeroProps {
	title: string;
	description?: string | null;
	/** The category's scenery photo (its own, or its parent's), or none. */
	photo?: SceneryImage | null;
	breadcrumbs: BreadcrumbItem[];
}

/**
 * The head of a listing: a photographic banner, lower than the homepage hero so the products
 * are not pushed away (premium redesign 2026-09).
 *
 * The photo is scenery — the category's own entry in `storefront-imagery.ts`, its parent's for
 * a sub-category, or the owner's banner from Payload once published — with the title, the
 * breadcrumbs and Saleor's description as HTML over its darker left. Without a photo it is the
 * same banner in dark graphite with the mountain line drawn along its right edge, never a
 * product cut-out blown up behind the text.
 *
 * On a phone it is a compact band with the words at its foot.
 */
export function CategoryHero({ title, description, photo, breadcrumbs }: CategoryHeroProps) {
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
						className="-z-10 object-cover object-[var(--banner-pos-mobile)] lg:object-[var(--banner-pos)]"
					/>
					<div
						aria-hidden="true"
						className="from-scrim/90 via-scrim/50 to-scrim/10 sm:via-scrim/45 absolute inset-0 -z-10 bg-linear-to-t sm:bg-linear-to-r sm:to-transparent"
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
					"max-w-page mx-auto flex flex-col justify-end px-4 pt-16 pb-7 sm:px-6 sm:pb-9 lg:px-8",
					photo
						? "min-h-[15rem] sm:min-h-[17rem] lg:min-h-[21rem] lg:pb-11"
						: "min-h-[12rem] lg:min-h-[15rem] lg:pb-10",
				)}
			>
				<Breadcrumbs items={breadcrumbs} tone="onImage" className="mb-3" />
				<h1 className="max-w-3xl text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] text-balance break-words sm:text-5xl lg:text-[3.5rem]">
					{title}
				</h1>
				{description && (
					<p className="text-text-inverse/85 mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed sm:text-base lg:text-[1.0625rem]">
						{description}
					</p>
				)}
			</div>
		</section>
	);
}
