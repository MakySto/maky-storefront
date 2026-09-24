"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { categoryUrlFor } from "@/config/category-routes";

/**
 * The homepage hero: what the shop sells and the two ways in, with a real photo beside it.
 *
 * Both request-time parts are slots filled by the page, each behind its own Suspense
 * boundary with a same-size fallback, so the static shell keeps the title and the copy:
 *
 * - `vehicleAction` names the saved car (it reads the garage cookie on the server) and is
 *   EMPTY when the vehicle feature cannot act — an absent button is honest, one that opens
 *   an empty selector is not;
 * - `showcase` is the lifestyle photo from Saleor (see `hero-showcase.tsx`).
 *
 * Copy left, photo right; on a phone the copy and the buttons come first and the photo
 * follows, so the first screen is the offer rather than a decorative picture.
 */
export function HeroSection({
	vehicleAction,
	showcase,
}: {
	vehicleAction?: ReactNode;
	showcase?: ReactNode;
}) {
	const t = useTranslations("home");
	const params = useParams<{ channel: string }>();
	const boxesHref = marketHref(params.channel, categoryUrlFor(params.channel, "stresne-boxy"));

	return (
		<section className="bg-surface-inverse text-text-inverse">
			<div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-16">
				<div className="lg:col-span-6">
					{/* Real copy from the `home` namespace, not three nav labels glued together.
					    The old line read "Strešné nosiče, Strešné boxy, Ťažné zariadenia" and
					    promised towbars, which CLAUDE.md §6 keeps off the homepage. The subtitle
					    speaks to the whole range; "bars, feet and a fitting kit in one box" only
					    ever described the roof-rack sets. */}
					<h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.025em] text-balance sm:text-5xl lg:text-[3.5rem]">
						{t("heroTitle")}
					</h1>
					<p className="text-text-inverse/75 mt-5 max-w-xl text-lg leading-8 text-pretty">
						{t("heroSubtitle")}
					</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
						{vehicleAction}
						<Link
							href={boxesHref}
							className="border-text-inverse/25 text-text-inverse hover:border-text-inverse/60 hover:bg-text-inverse/10 focus-visible:ring-text-inverse inline-flex h-12 items-center justify-center gap-2 rounded-sm border px-6 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-hidden"
						>
							{t("heroSecondaryCta")}
							<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
						</Link>
					</div>
				</div>

				<div className="lg:col-span-6">{showcase}</div>
			</div>
		</section>
	);
}
