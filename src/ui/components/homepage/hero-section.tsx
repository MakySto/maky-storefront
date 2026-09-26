import { type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { categoryUrlFor } from "@/config/category-routes";
import { marketHref } from "@/lib/channel-map";
import type { SceneryImage } from "@/lib/homepage/scenery";
import { offersCategory, offersFullRange, type MarketAssortment } from "@/lib/market-assortment";
import { HeroBenefits } from "./hero-benefits";

/**
 * The homepage hero: one photograph across the whole width, the words over its darker left
 * side, the car and what is on its roof to the right (premium redesign 2026-09).
 *
 * The photo is scenery (`getScenery`), in the static shell and fetched first: it is the page's
 * largest paint. The two request-time parts are slots filled by the page, each behind its own
 * Suspense boundary with a same-size fallback, so the words and the buttons never wait:
 *
 * - `vehicleAction` — "Vybrať moje auto", or with a saved car "Zobraziť nosiče pre moje auto"
 *   and the car's name with "Zmeniť auto" under it;
 * - `productCard` — the translucent card naming the product in the photo, where this market
 *   sells it.
 *
 * The text is HTML over the photo, never baked into it, and the photo's crop is set per width:
 * the car stays in frame on a phone as on a desktop.
 */
export async function HeroSection({
	channel,
	assortment,
	photo,
	vehicleAction,
	productCard,
}: {
	channel: string;
	/** What this market sells — the lead and the second action name only that. */
	assortment: MarketAssortment;
	photo: SceneryImage | null;
	vehicleAction?: ReactNode;
	productCard?: ReactNode;
}) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	// The approved second action is the roof boxes. A market that does not sell them — every
	// foreign one on 2026-09-25, where it led to "Seite nicht gefunden" — gets the roof racks,
	// and a market with neither gets no second action at all rather than a dead one.
	const secondary = offersCategory(assortment, "stresne-boxy")
		? { slug: "stresne-boxy", label: t("heroSecondaryCta") }
		: offersCategory(assortment, "stresne-nosice")
			? { slug: "stresne-nosice", label: t("heroSecondaryCtaRoofRacks") }
			: null;

	return (
		<section className="relative">
			<div className="bg-scrim text-text-inverse relative isolate overflow-hidden">
				{/* A phone shows the photo as a band on top that fades into the dark ground the words
				    stand on — the car stays visible instead of disappearing behind the headline. From
				    `lg` the photo covers the whole hero and the words sit over its darker left. */}
				<div className="absolute inset-x-0 top-0 -z-10 h-[15.5rem] sm:h-[22rem] lg:inset-0 lg:h-auto">
					{photo && (
						<Image
							src={photo.url}
							alt=""
							fill
							priority
							fetchPriority="high"
							sizes="100vw"
							style={
								{ "--hero-pos": photo.position, "--hero-pos-mobile": photo.mobilePosition } as CSSProperties
							}
							// A touch warmer and crisper than the file: the approved hero is late light, and the
							// scenery photos from the product galleries are shot flat.
							className="object-cover object-[var(--hero-pos-mobile)] brightness-[1.06] contrast-[1.05] saturate-[1.18] sepia-[0.12] lg:object-[var(--hero-pos)]"
						/>
					)}
					<div
						aria-hidden="true"
						className="via-scrim/25 to-scrim absolute inset-0 bg-linear-to-b from-transparent lg:hidden"
					/>
				</div>
				{/* Warm late light over the cool scenery, as the approved hero's golden hour: a copper
				    glow from the top right and a warm grade over the whole photo, both blended so they
				    tint the landscape and never shift the product's own colour. */}
				<div
					aria-hidden="true"
					className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_82%_0%,var(--color-copper-300),transparent_65%)] opacity-60 mix-blend-soft-light"
				/>
				<div
					aria-hidden="true"
					className="to-copper-200 absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent opacity-25 mix-blend-soft-light"
				/>
				{/* Darkening where the words are, on a desktop: the left, and the foot under the benefits. */}
				<div
					aria-hidden="true"
					className="from-scrim/80 via-scrim/35 absolute inset-0 -z-10 hidden bg-linear-to-r via-45% to-transparent to-75% lg:block"
				/>
				<div
					aria-hidden="true"
					className="from-scrim/75 absolute inset-x-0 bottom-0 -z-10 hidden h-40 bg-linear-to-t to-transparent lg:block"
				/>

				<div className="max-w-page relative mx-auto flex flex-col px-4 pt-[13.5rem] pb-10 sm:px-6 sm:pt-[19rem] lg:min-h-[37rem] lg:px-8 lg:pt-20 lg:pb-32">
					<div className="max-w-2xl">
						<p className="text-text-inverse/85 text-xs font-semibold tracking-[0.2em] uppercase sm:text-[0.8125rem]">
							{t("heroEyebrow")}
						</p>
						{/* The page's one H1. The <title> keeps its own wording (`heroTitle`). */}
						<h1 className="mt-4 text-[2.625rem] leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.5rem]">
							{t("heroHeadline")}
						</h1>
						<p className="text-text-inverse/90 mt-5 max-w-xl text-base leading-relaxed text-pretty sm:text-lg lg:text-xl">
							{offersFullRange(assortment) ? t("heroLead") : t("heroLeadRoofRacks")}
						</p>

						<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
							{vehicleAction}
							{secondary && (
								<Link
									href={marketHref(channel, categoryUrlFor(channel, secondary.slug))}
									className="border-text-inverse/85 bg-scrim/25 text-text-inverse hover:bg-text-inverse/12 focus-visible:ring-text-inverse inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-xs border-2 px-6 text-base font-semibold backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-hidden"
								>
									{secondary.label}
									<ArrowRightIcon
										className="h-[1.125rem] w-[1.125rem]"
										strokeWidth={2.25}
										aria-hidden="true"
									/>
								</Link>
							)}
						</div>
					</div>

					{productCard}
				</div>
			</div>

			{/* Over the foot of the photo on a desktop; its own light band under it on a phone. */}
			<HeroBenefits channel={channel} />
		</section>
	);
}
