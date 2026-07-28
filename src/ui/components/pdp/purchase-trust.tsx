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
 * printed as a number.
 *
 * The return window in particular is deliberately a link and not a figure — it
 * differs by customer (14 days for a guest, 30 for a registered account), so any
 * single number printed next to the buy button would be wrong for half the
 * customers reading it.
 */
export async function PurchaseTrust({ channel }: { channel: string }) {
	const t = await getTranslations("footer");

	const items = [
		{ icon: ShieldCheck, label: t("securePayment"), href: null },
		{ icon: Truck, label: t("shippingAndPayment"), href: "/doprava-a-platba" },
		{ icon: RotateCcw, label: t("returns"), href: "/reklamacie-a-vratenie" },
		{ icon: MessageCircle, label: t("contact"), href: "/kontakt" },
	];

	return (
		<ul className="border-border-subtle text-text-secondary grid grid-cols-2 gap-x-4 gap-y-2.5 border-t pt-4 text-xs">
			{items.map(({ icon: Icon, label, href }) => (
				<li key={label}>
					{href ? (
						<Link
							href={marketHref(channel, href)}
							className="hover:text-text-primary inline-flex items-center gap-2 transition-colors"
						>
							<Icon className="text-text-tertiary h-4 w-4 shrink-0" aria-hidden />
							<span className="underline-offset-4 hover:underline">{label}</span>
						</Link>
					) : (
						<span className="inline-flex items-center gap-2">
							<Icon className="text-text-tertiary h-4 w-4 shrink-0" aria-hidden />
							{label}
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
