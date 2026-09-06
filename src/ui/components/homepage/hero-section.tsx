"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * `vehicleAction` is a slot, not a button.
 *
 * The hero used to render its own amber car button with no `onClick` — a stub, and the
 * wrong colour besides: CLAUDE.md §4 reserves amber for promotions and gives the purchase
 * and primary actions the action tokens. The real launcher has to resolve the saved
 * vehicle on the server, so it is passed in from the page rather than imported here, and
 * it is EMPTY when the vehicle feature cannot act (no dataset, or no garage). An absent
 * CTA is honest; a CTA that opens an empty selector is not.
 */
export function HeroSection({ vehicleAction }: { vehicleAction?: ReactNode }) {
	const t = useTranslations("nav");
	const tc = useTranslations("common");

	return (
		<section className="relative overflow-hidden bg-gray-900 text-white">
			<div className="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-8 lg:py-32">
				<div className="max-w-2xl">
					<p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">MAKY.STORE</p>
					<h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
						{t("roofRacks")}, {t("roofBoxes")}, {t("towBars")}
					</h1>
					<p className="mt-6 text-lg leading-8 text-gray-300">
						{tc("country") === "Slovensko"
							? "Strešné nosiče, boxy a ťažné zariadenia presne pre vaše auto"
							: "Roof racks, boxes and towbars — a precise fit for your car"}
					</p>

					<div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
						{vehicleAction}
						<a
							href="#categories"
							className="inline-flex items-center gap-1 text-sm font-medium text-gray-300 transition hover:text-white"
						>
							{t("allCategories")}
							<ArrowIcon />
						</a>
					</div>
				</div>
			</div>
			<div className="absolute inset-0 -z-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
		</section>
	);
}

function ArrowIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
			<path
				fillRule="evenodd"
				d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
				clipRule="evenodd"
			/>
		</svg>
	);
}
