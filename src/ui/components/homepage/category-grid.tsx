"use client";

import { type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { categoriesFor } from "@/config/categories";
import { categoryUrlFor } from "@/config/category-routes";
import { cn } from "@/lib/utils";

/**
 * One tile's picture: a `scene` is a photograph that fills the tile; a `studio` picture is the
 * category's product cut-out on white, shown whole on a warm ground — never cropped and never
 * passed off as a lifestyle photo.
 */
export type CategoryTilePhoto = {
	readonly url: string;
	readonly position: string;
	readonly kind: "scene" | "studio";
};

export type CategoryTilePhotos = Readonly<Record<string, CategoryTilePhoto>>;

/** One tagline per category, from the `home` messages. */
const TAGLINES: Readonly<Record<string, string>> = {
	roofRacks: "tileRoofRacks",
	roofBoxes: "tileRoofBoxes",
	bikeCarriers: "tileBikeCarriers",
	skiCarriers: "tileSkiCarriers",
	roofTents: "tileRoofTents",
	carFridges: "tileCarFridges",
};

/**
 * The six main categories as photographic tiles (premium redesign 2026-09).
 *
 * The photo fills the tile and the name sits over a dark fade at its foot. Six in a row on a wide
 * desktop — short visual entries, not product cards — three on a tablet, two on a phone.
 *
 * `photos` is `null` while it streams in or when it could not be read; every tile keeps its name,
 * its link and its size either way, so the swap moves nothing. Names come from the same `nav`
 * labels as the menu; the picture is decorative (`alt=""`), because the link text names it.
 */
export function CategoryGrid({ photos }: { photos: CategoryTilePhotos | null }) {
	const t = useTranslations("nav");
	const th = useTranslations("home");
	const params = useParams<{ channel: string }>();
	const channel = params.channel;
	const categories = categoriesFor("home");

	return (
		<section id="categories" className="max-w-page mx-auto px-4 pt-12 pb-10 sm:px-6 sm:pt-16 lg:px-8">
			<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">
				{th("categoriesTitle")}
			</h2>
			<ul role="list" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
				{categories.map((category, index) => {
					const photo = photos?.[category.slug];
					const tagline = TAGLINES[category.key];
					return (
						<li key={category.key}>
							<Link
								href={marketHref(channel, categoryUrlFor(channel, category.slug))}
								className={cn(
									"group relative isolate flex aspect-[7/8] flex-col justify-end overflow-hidden rounded-sm shadow-sm transition-shadow duration-300 hover:shadow-xl",
									"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
									photo?.kind === "scene" ? "bg-scrim" : "from-surface-muted to-sand-400 bg-linear-to-b",
								)}
							>
								{/* A studio picture stands on the warm ground with the mountains drawn behind it,
								    so the tile reads as designed rather than as a cut-out on white. */}
								{photo?.kind === "studio" && (
									<div
										aria-hidden="true"
										className="art-mountains bg-sand-500/45 absolute inset-x-0 top-[12%] -z-10 h-1/2"
									/>
								)}
								{photo && (
									<Image
										src={photo.url}
										alt=""
										fill
										// The first row of a phone is on the first screen.
										loading={index < 2 ? "eager" : "lazy"}
										sizes="(min-width: 1280px) 224px, (min-width: 768px) 31vw, 46vw"
										style={{ "--tile-pos": photo.position } as CSSProperties}
										className={cn(
											"-z-10 transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.06]",
											photo.kind === "scene"
												? "object-cover object-[var(--tile-pos)]"
												: "object-contain px-4 pt-5 pb-20 mix-blend-multiply",
										)}
									/>
								)}
								<div
									aria-hidden="true"
									className={cn(
										"absolute inset-x-0 bottom-0 -z-10 bg-linear-to-t to-transparent",
										photo?.kind === "scene"
											? "from-scrim/90 via-scrim/35 h-3/4"
											: "from-scrim/85 via-scrim/25 h-1/2",
									)}
								/>
								{/* One text block of the same shape on every tile: two lines kept for the name,
								    set on the lower one, and two for the line under it. A name that wraps
								    ("Nosiče bicyklov") no longer lifts its tile's words above its neighbours'. */}
								<div className="flex items-end justify-between gap-2 p-3.5 sm:p-4">
									<span className="min-w-0">
										<span className="text-text-inverse flex min-h-[2lh] items-end text-base leading-tight font-extrabold tracking-[-0.01em] sm:text-lg xl:text-xl">
											{t(category.key)}
										</span>
										{tagline && (
											<span className="text-text-inverse/80 mt-1 hidden min-h-[2lh] text-[0.8125rem] leading-snug sm:line-clamp-2">
												{th(tagline)}
											</span>
										)}
									</span>
									<ArrowRightIcon
										className="text-text-inverse h-4 w-4 shrink-0 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
										aria-hidden="true"
									/>
								</div>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
