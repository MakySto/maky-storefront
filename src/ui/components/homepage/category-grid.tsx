"use client";

import { type ReactElement } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { marketHref } from "@/lib/channel-map";
import { categoriesFor } from "@/config/categories";
import { categoryUrlFor } from "@/config/category-routes";
import {
	BikeIcon,
	ChainIcon,
	FridgeIcon,
	RoofBoxIcon,
	RoofRackIcon,
	RoofTentIcon,
	SkiIcon,
	TowBarIcon,
} from "@/ui/components/shared/category-icons";

/**
 * Per-category art and tint. Keyed by the category key from `@/config/categories`,
 * which owns the slug — this map owns only how a category looks. A key with no
 * entry here still renders; it just gets the neutral tint.
 */
const CATEGORY_ART: Record<string, { icon: (props: { className?: string }) => ReactElement; color: string }> =
	{
		roofRacks: { icon: RoofRackIcon, color: "bg-sky-50 text-sky-700" },
		roofBoxes: { icon: RoofBoxIcon, color: "bg-amber-50 text-amber-700" },
		bikeCarriers: { icon: BikeIcon, color: "bg-green-50 text-green-700" },
		skiCarriers: { icon: SkiIcon, color: "bg-blue-50 text-blue-700" },
		roofTents: { icon: RoofTentIcon, color: "bg-emerald-50 text-emerald-700" },
		carFridges: { icon: FridgeIcon, color: "bg-cyan-50 text-cyan-700" },
		snowChains: { icon: ChainIcon, color: "bg-slate-50 text-slate-700" },
		towBars: { icon: TowBarIcon, color: "bg-orange-50 text-orange-700" },
	};

const NEUTRAL_ART = { icon: RoofRackIcon, color: "bg-slate-50 text-slate-700" };

export function CategoryGrid() {
	const t = useTranslations("nav");
	const params = useParams<{ channel: string }>();
	const channel = params.channel;
	const categories = categoriesFor("home");

	return (
		<section id="categories" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
			<h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{t("allCategories")}</h2>
			{/* Six across on desktop, matching the six surfaced categories. A seventh
          wraps rather than squeezing, which is the right failure mode when a
          withheld category is surfaced again. */}
			<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				{categories.map((category) => {
					const { icon: Icon, color } = CATEGORY_ART[category.key] ?? NEUTRAL_ART;
					return (
						<Link
							key={category.key}
							href={marketHref(channel, categoryUrlFor(channel, category.slug))}
							className="group flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:border-gray-200 hover:shadow-md"
						>
							<div
								className={`flex h-14 w-14 items-center justify-center rounded-xl ${color} transition group-hover:scale-110`}
							>
								<Icon className="h-7 w-7" />
							</div>
							<span className="text-sm font-medium text-gray-900">{t(category.key)}</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
