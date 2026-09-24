import { getLocaleFromChannel } from "@/config/locale";
import Link from "next/link";
import { BadgeCheck, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { marketHref } from "@/lib/channel-map";

/**
 * Purchase confidence, as the approved buy box lays it out: four brown icons, each with a title
 * and a line under it (second pass, 2026-09-24).
 *
 * Everything here is either a fact already established elsewhere on the site or a link to the
 * page that states the real terms: payment over an encrypted connection, shipping priced by the
 * product and shown in the cart (CLAUDE.md §9), returns — "at least 14 days", which is true for
 * every customer, because the extended 30 days hold only for an order placed while signed in and
 * must never read as unconditional — and the statutory two-year warranty. No delivery date, no
 * free shipping, and none of the mockup's "oficiálna distribúcia", which nothing backs.
 */
export async function PurchaseTrust({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "product" });

	const items = [
		{ icon: ShieldCheck, title: t("trustPaymentTitle"), text: t("trustPaymentText"), href: null },
		{ icon: Truck, title: t("trustShippingTitle"), text: t("trustShippingText"), href: "/doprava-a-platba" },
		{
			icon: RotateCcw,
			title: t("trustReturnsTitle"),
			text: t("trustReturnsText"),
			href: "/reklamacie-a-vratenie",
		},
		{ icon: BadgeCheck, title: t("trustWarrantyTitle"), text: t("trustWarrantyText"), href: null },
	];

	const body = (Icon: typeof ShieldCheck, title: string, text: string, linked: boolean) => (
		<>
			<Icon className="text-brand h-8 w-8 shrink-0" strokeWidth={2} aria-hidden />
			<span className="min-w-0">
				<span
					className={
						"text-text-primary block text-[0.8125rem] leading-snug font-bold" +
						(linked ? " underline-offset-4 group-hover:underline" : "")
					}
				>
					{title}
				</span>
				<span className="text-text-secondary block text-xs leading-snug">{text}</span>
			</span>
		</>
	);

	return (
		<ul className="border-border-subtle grid grid-cols-2 gap-x-4 gap-y-5 border-t pt-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
			{items.map(({ icon: Icon, title, text, href }) => (
				<li key={title}>
					{href ? (
						<Link
							href={marketHref(channel, href)}
							// These sit in the viewport right under the buy button, so the router
							// prefetched them on every product page — and under cacheComponents each
							// costs four or five segment requests, competing with the LCP image for a
							// policy page almost nobody opens from here. The footer links them too.
							prefetch={false}
							className="group flex items-start gap-2.5 xl:flex-col xl:gap-2"
						>
							{body(Icon, title, text, true)}
						</Link>
					) : (
						<span className="flex items-start gap-2.5 xl:flex-col xl:gap-2">
							{body(Icon, title, text, false)}
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
