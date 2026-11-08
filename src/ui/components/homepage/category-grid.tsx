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
	snowChains: "tileSnowChains",
};

/**
 * The main categories as photographic tiles (premium redesign 2026-09; seven since the snow chains
 * joined on 2026-11-08).
 *
 * The photo fills the tile and the name sits over a dark fade at its foot. On a wide desktop they
 * stand in one row (six, or seven when the market sells the chains too) — short visual entries,
 * not product cards — three on a tablet, two on a phone.
 *
 * `photos` is `null` while it streams in or when it could not be read; every tile keeps its name,
 * its link and its size either way, so the swap moves nothing. Names come from the same `nav`
 * labels as the menu; the picture is decorative (`alt=""`), because the link text names it.
 */
export function CategoryGrid({
	photos,
	offered,
}: {
	photos: CategoryTilePhotos | null;
	/**
	 * The slugs this market sells (`lib/market-assortment.ts`), read once by the page so the
	 * fallback and the tiles with their photos show the same set. A tile for a shelf the market
	 * does not have led to "Seite nicht gefunden" in eleven markets (2026-09-25).
	 */
	offered: readonly string[];
}) {
	const t = useTranslations("nav");
	const th = useTranslations("home");
	const params = useParams<{ channel: string }>();
	const channel = params.channel;
	const categories = categoriesFor("home").filter((category) => offered.includes(category.slug));
	// Seven tiles share one row from xl, each about 180px wide: the name steps down a size so that
	// "Autochladničky" stays inside its tile, and a long word breaks rather than runs out of it.
	const crowded = categories.length > 6;

	// One tile is not a choice between categories: a market that sells a single shelf reaches it
	// from the hero, the menu and the vehicle block, and the section would stand there as a lone
	// card under a "shop by category" heading.
	if (categories.length < 2) return null;

	return (
		<section id="categories" className="max-w-page mx-auto px-4 pt-12 pb-10 sm:px-6 sm:pt-16 lg:px-8">
			<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">
				{th("categoriesTitle")}
			</h2>
			<ul
				role="list"
				className={cn(
					"mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3",
					// A seventh tile must not stand alone in a second row: seven fit one row from xl.
					crowded ? "xl:grid-cols-7" : "xl:grid-cols-6",
				)}
			>
				{categories.map((category, index) => {
					const photo = photos?.[category.slug];
					const tagline = TAGLINES[category.key];
					return (
						<li key={category.key}>
							<Link
								href={marketHref(channel, categoryUrlFor(channel, category.slug))}
								className={cn(
									"group relative isolate flex aspect-[7/8] flex-col justify-end overflow-hidden rounded-sm shadow-sm transition-shadow duration-300 hover:shadow-xl",
									// Seven in a row are about 180px wide: taller, so the words still leave room for the picture.
									crowded && "xl:aspect-[7/10]",
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
												: // The picture stops above the words: from sm the name takes two lines and the tagline
													// two more (about 7rem with the padding), and a picture that reached into them
													// put white letters on a light wheel or fridge (owner, 2026-11-08).
													"object-contain px-4 pt-5 pb-20 mix-blend-multiply sm:pb-[7.5rem]",
										)}
									/>
								)}
								<div
									aria-hidden="true"
									className={cn(
										"absolute inset-x-0 bottom-0 -z-10 bg-linear-to-t to-transparent",
										photo?.kind === "scene"
											? "from-scrim/90 via-scrim/35 h-3/4"
											: // From sm taller and darker than the old half-height fade (a phone has no tagline and keeps it): the words of a tile whose picture is a
												// light cut-out (a wheel, a rack, a fridge) stand on beige, and white on beige did not read.
												"from-scrim/85 via-scrim/25 sm:from-scrim/90 sm:via-scrim/55 h-1/2 sm:h-[62%] sm:via-70%",
									)}
								/>
								{/* One text block of the same shape on every tile: two lines kept for the name,
								    set on the lower one, and two for the line under it. A name that wraps
								    ("Nosiče bicyklov") no longer lifts its tile's words above its neighbours'. */}
								<div className="flex items-end justify-between gap-2 p-3.5 sm:p-4">
									<span className="min-w-0">
										<span
											className={cn(
												"text-text-inverse flex min-h-[2lh] items-end text-base leading-tight font-extrabold tracking-[-0.01em] break-words sm:text-lg",
												crowded ? "xl:text-[1.0625rem]" : "xl:text-xl",
											)}
										>
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
