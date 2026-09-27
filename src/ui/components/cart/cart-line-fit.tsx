import Link from "next/link";
import { ArrowRight, CarFront, Check, CircleHelp, Globe, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";
import type { CartLineFitment } from "@/ui/components/fitment/cart-line-fitment";

const ICON: Record<CartLineFitment["tone"], typeof Check> = {
	fits: Check,
	"no-fit": X,
	unconfirmed: CircleHelp,
	universal: Globe,
	offer: CarFront,
};

/** A line made for another car is described, not judged: neutral, like the product page's box. */
const OFFER_CLASSES = "bg-surface-muted text-text-secondary";

/**
 * One cart line's compatibility with the saved car, in the product page's words: "Kompatibilné
 * podľa údajov výrobcu · TOYOTA RAV4 XA40 · 2012", or "Nepasuje na vaše vozidlo · …" — or, for a
 * line made for another car, "Ponuka pre AUDI A4 Avant B8" and the way to the offers for the saved
 * one. A statement only — the line stays in the cart and buyable whatever it says.
 *
 * `onNavigate` closes the drawer when the shopper follows the link out of it.
 */
export function CartLineFit({
	fitment,
	className,
	onNavigate,
}: {
	fitment: CartLineFitment;
	className?: string;
	onNavigate?: () => void;
}) {
	const Icon = ICON[fitment.tone];
	const badge = (
		<p
			className={cn(
				"rounded-2xs inline-flex max-w-full items-start gap-1.5 px-2 py-1 text-xs leading-snug font-medium",
				fitment.tone === "offer" ? OFFER_CLASSES : TONE_CLASSES[fitment.tone],
				!fitment.alternative && className,
			)}
		>
			<Icon className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
			<span className="min-w-0">
				{fitment.label}
				{fitment.vehicle && <span className="font-normal opacity-90"> · {fitment.vehicle}</span>}
			</span>
		</p>
	);
	if (!fitment.alternative) return badge;
	return (
		<div className={cn("flex flex-col items-start", className)}>
			{badge}
			<Link
				href={fitment.alternative.href}
				onClick={onNavigate}
				className="text-brand mt-1 inline-flex min-h-6 items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline"
			>
				{fitment.alternative.label}
				<ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			</Link>
		</div>
	);
}
