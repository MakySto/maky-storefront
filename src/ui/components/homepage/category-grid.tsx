"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { categoriesFor } from "@/config/categories";
import { categoryUrlFor } from "@/config/category-routes";
import type { CategoryImages } from "@/lib/homepage/showcase";

/**
 * Six category tiles with the category's own photo from Saleor.
 *
 * The photos used to be a fixed map of line icons on rainbow tints, so a photo added to a
 * category in Saleor never reached the homepage. `images` now comes from Saleor (see
 * `category-grid-photos.tsx`); `null` while it streams in, or when Saleor could not be
 * asked — the tile keeps its name, its link and its size either way.
 *
 * The photos are product cut-outs on white, so they are shown WHOLE (`object-contain` with a
 * margin) on a white panel, never cropped to fill: a cover crop of a roof rack is a close-up
 * of a plastic foot. A lifestyle photo added later is letterboxed, never cut.
 *
 * Names come from the same `nav` labels as the menu, so a tile and the menu item it mirrors
 * cannot drift apart; the photo is decorative (`alt=""`) because the link text names it.
 */
export function CategoryGrid({ images }: { images: CategoryImages | null }) {
	const t = useTranslations("nav");
	const th = useTranslations("home");
	const params = useParams<{ channel: string }>();
	const channel = params.channel;
	const categories = categoriesFor("home");

	return (
		<section id="categories" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<h2 className="text-text-primary text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
				{th("categoriesTitle")}
			</h2>
			{/* Three across on desktop, two on a phone — six tiles, two full rows either way. */}
			<ul role="list" className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-3 lg:gap-6">
				{categories.map((category) => {
					const photo = images?.[category.slug];
					return (
						<li key={category.key}>
							<Link
								href={marketHref(channel, categoryUrlFor(channel, category.slug))}
								className="group border-border-subtle bg-surface-card hover:border-border-default focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-lg border transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
							>
								<div className="bg-surface-card relative aspect-[4/3] w-full">
									{photo && (
										<Image
											src={photo}
											alt=""
											fill
											sizes="(min-width: 1280px) 395px, (min-width: 1024px) 31vw, 46vw"
											className="object-contain p-3 transition-transform duration-300 ease-out group-hover:scale-[1.04] sm:p-5"
										/>
									)}
								</div>
								<div className="border-border-subtle flex items-center justify-between gap-2 border-t px-3 py-3 sm:px-5 sm:py-4">
									<span className="text-text-primary text-sm leading-tight font-semibold sm:text-base">
										{t(category.key)}
									</span>
									<ArrowRightIcon
										className="text-text-tertiary group-hover:text-text-link h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
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
