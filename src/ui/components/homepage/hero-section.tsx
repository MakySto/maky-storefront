"use client";

import { useTranslations } from "next-intl";

export function HeroSection() {
	const t = useTranslations("nav");
	const th = useTranslations("home");
	const tf = useTranslations("fitment");

	return (
		<section className="relative overflow-hidden bg-gray-900 text-white">
			<div className="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-8 lg:py-32">
				<div className="max-w-2xl">
					<p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">MAKY.STORE</p>
					{/* Real copy from the `home` namespace, not three nav labels glued together.
					    The old line read "Strešné nosiče, Strešné boxy, Ťažné zariadenia" —
					    capitalised mid-sentence because they are menu labels, and it promised
					    towbars, which CLAUDE.md §6 keeps off the homepage and which hold zero
					    products in sk-eur. The subtitle below was a hardcoded two-way fork on
					    `common.country === "Slovensko"`, so nine of the twelve locales were
					    served English regardless of their own language. */}
					<h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
						{th("heroTitle")}
					</h1>
					<p className="mt-6 text-lg leading-8 text-gray-300">{th("heroSubtitle")}</p>

					<div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
						>
							<CarIcon />
							{tf("selectVehicle")}
						</button>
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

function CarIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
			<path d="M6.5 3c-1.051 0-2.093.04-3.125.117A1.49 1.49 0 002 4.607V10.5h-.5a.5.5 0 00-.5.5v2a2 2 0 002 2h1a2 2 0 002-2h8a2 2 0 002 2h1a2 2 0 002-2v-2a.5.5 0 00-.5-.5H18V4.607a1.49 1.49 0 00-1.375-1.49A44.07 44.07 0 0013.5 3h-7zM5 13a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0zM4.5 5a.5.5 0 01.5-.5h10a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V5z" />
		</svg>
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
