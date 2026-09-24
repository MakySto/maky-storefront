import { getTranslations } from "next-intl/server";
import { BadgeCheckIcon, HeadsetIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { cn } from "@/lib/utils";

/**
 * The four short promises of the shop — each one a standing fact.
 *
 * Deliberately no delivery time: today's 5–10 days is a temporary state before the warehouse
 * link, and a global strip would outlive it (owner, 2026-09-24). Shipping is described the way
 * CLAUDE.md §9 allows — the price depends on the product and shows in the cart. No invented
 * guarantee, and no claim that everything is a complete set.
 *
 * One list, three settings, as the approved pages place it:
 *
 * - `hero` — laid over the foot of the homepage photo on a desktop, a light band under it on a
 *   phone;
 * - `banner` — the foot of a category banner, desktop only (a phone's banner has no room);
 * - `band` — the warm strip that closes a listing, the brown icons drawn without a ring.
 */
export async function HeroBenefits({
	channel,
	variant = "hero",
}: {
	channel: string;
	variant?: "hero" | "banner" | "band";
}) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	const items = [
		{ icon: HeadsetIcon, title: t("benefitAdviceTitle"), text: t("benefitAdviceText") },
		{ icon: BadgeCheckIcon, title: t("benefitBrandsTitle"), text: t("benefitBrandsText") },
		{ icon: TruckIcon, title: t("benefitShippingTitle"), text: t("benefitShippingText") },
		{ icon: ShieldCheckIcon, title: t("benefitWarrantyTitle"), text: t("benefitWarrantyText") },
	];

	const list = (
		<ul
			className={cn(
				"grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-8",
				variant === "hero" && "max-w-page mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:pt-0 lg:pb-9",
				variant === "banner" && "mt-8 hidden lg:grid",
				variant === "band" && "max-w-page mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-7",
			)}
		>
			{items.map(({ icon: Icon, title, text }) => (
				<li key={title} className="flex min-w-0 items-center gap-3">
					{variant === "band" ? (
						<Icon className="text-brand h-8 w-8 shrink-0" strokeWidth={2} aria-hidden="true" />
					) : (
						<span
							className={cn(
								"flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2",
								variant === "hero"
									? "border-brand/30 text-brand lg:border-text-inverse/70 lg:text-text-inverse lg:bg-scrim/25 lg:backdrop-blur-sm"
									: "border-copper-300/80 text-text-inverse bg-scrim/25 backdrop-blur-sm",
							)}
						>
							<Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
						</span>
					)}
					<span className="min-w-0">
						<span
							className={cn(
								"block text-sm leading-tight font-bold",
								variant === "hero" && "text-text-primary lg:text-text-inverse",
								variant === "banner" && "text-text-inverse",
								variant === "band" && "text-text-primary sm:text-[0.9375rem]",
							)}
						>
							{title}
						</span>
						<span
							className={cn(
								"mt-0.5 block text-xs leading-snug sm:text-[0.8125rem]",
								variant === "hero" && "text-text-secondary lg:text-text-inverse/75",
								variant === "banner" && "text-text-inverse/80",
								variant === "band" && "text-text-secondary",
							)}
						>
							{text}
						</span>
					</span>
				</li>
			))}
		</ul>
	);

	if (variant === "banner") return list;
	return (
		<div
			className={cn(
				variant === "hero" &&
					"border-border-subtle bg-surface-card border-b lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-0 lg:bg-transparent",
				variant === "band" && "bg-surface-muted border-border-subtle border-y print:hidden",
			)}
		>
			{list}
		</div>
	);
}
