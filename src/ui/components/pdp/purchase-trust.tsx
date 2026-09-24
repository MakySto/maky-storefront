import { getLocaleFromChannel } from "@/config/locale";
import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { marketHref } from "@/lib/channel-map";

/**
 * Purchase confidence block.
 *
 * Everything here is either a fact already established elsewhere on the site or
 * a link to the page that states the real terms. Nothing is invented: no
 * delivery date, no free shipping, no return window and no warranty period is
 * printed as a number — and none of the approved mockup's "oficiálna distribúcia"
 * or security badges, which nothing backs.
 *
 * The return window in particular is deliberately a link and not a figure — it
 * differs by customer (14 days for a guest, 30 for a registered account), so any
 * single number printed next to the buy button would be wrong for half the
 * customers reading it.
 *
 * Laid out as the approved design's row of round icons with their words (2026-09).
 */
export async function PurchaseTrust({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "footer" });

	const items = [
		{ icon: ShieldCheck, label: t("securePayment"), href: null },
		{ icon: Truck, label: t("shippingAndPayment"), href: "/doprava-a-platba" },
		{ icon: RotateCcw, label: t("returns"), href: "/reklamacie-a-vratenie" },
		{ icon: MessageCircle, label: t("contact"), href: "/kontakt" },
	];

	const icon = (Icon: typeof ShieldCheck) => (
		<span className="border-brand/20 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
			<Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
		</span>
	);

	return (
		<ul className="border-border-subtle text-text-secondary grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-6 text-[0.8125rem] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
			{items.map(({ icon: Icon, label, href }) => (
				<li key={label}>
					{href ? (
						<Link
							href={marketHref(channel, href)}
							// These three sit in the viewport right under the buy button, so
							// the router prefetched all of them on every product page — and
							// under cacheComponents each one costs four or five segment
							// requests, not one. That traffic competed with the LCP image
							// for a policy page almost nobody opens from here. The footer
							// already links to the same three pages with prefetch off.
							prefetch={false}
							className="text-text-secondary hover:text-text-primary group flex items-center gap-2.5 font-medium transition-colors xl:flex-col xl:items-start xl:gap-2"
						>
							{icon(Icon)}
							<span className="leading-snug underline-offset-4 group-hover:underline">{label}</span>
						</Link>
					) : (
						<span className="flex items-center gap-2.5 font-medium xl:flex-col xl:items-start xl:gap-2">
							{icon(Icon)}
							<span className="leading-snug">{label}</span>
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
