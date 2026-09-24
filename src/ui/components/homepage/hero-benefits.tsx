import { getTranslations } from "next-intl/server";
import { BadgeCheckIcon, HeadsetIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";

/**
 * The four short promises under the hero — each one a standing fact of the shop.
 *
 * Deliberately no delivery time: today's 5–10 days is a temporary state before the warehouse
 * link, and a global strip would outlive it (owner, 2026-09-24). Shipping is described the way
 * CLAUDE.md §9 allows — the price depends on the product and shows in the cart. No invented
 * guarantee, and no claim that everything is a complete set.
 *
 * One list for every width: laid over the foot of the photo on a desktop, a light band under it
 * on a phone.
 */
export async function HeroBenefits({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	const items = [
		{ icon: HeadsetIcon, title: t("benefitAdviceTitle"), text: t("benefitAdviceText") },
		{ icon: BadgeCheckIcon, title: t("benefitBrandsTitle"), text: t("benefitBrandsText") },
		{ icon: TruckIcon, title: t("benefitShippingTitle"), text: t("benefitShippingText") },
		{ icon: ShieldCheckIcon, title: t("benefitWarrantyTitle"), text: t("benefitWarrantyText") },
	];

	return (
		<div className="border-border-subtle bg-surface-card border-b lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-0 lg:bg-transparent">
			<ul className="max-w-page mx-auto grid grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:gap-8 lg:px-8 lg:pt-0 lg:pb-9">
				{items.map(({ icon: Icon, title, text }) => (
					<li key={title} className="flex min-w-0 items-center gap-3">
						<span className="border-brand/25 text-brand lg:border-copper-300/60 lg:text-text-inverse lg:bg-scrim/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border lg:backdrop-blur-sm">
							<Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
						</span>
						<span className="min-w-0">
							<span className="text-text-primary lg:text-text-inverse block text-sm leading-tight font-semibold">
								{title}
							</span>
							<span className="text-text-secondary lg:text-text-inverse/75 mt-0.5 block text-xs leading-snug sm:text-[0.8125rem]">
								{text}
							</span>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
