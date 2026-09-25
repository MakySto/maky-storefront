import { Check, CircleHelp, Globe, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE_CLASSES, type VerdictTone } from "@/ui/components/fitment/verdict-presentation";
import type { CartLineFitment } from "@/ui/components/fitment/cart-line-fitment";

const ICON: Record<VerdictTone, typeof Check> = {
	fits: Check,
	"no-fit": X,
	unconfirmed: CircleHelp,
	universal: Globe,
};

/**
 * One cart line's compatibility with the saved car, in the product page's words: "Kompatibilné
 * podľa údajov výrobcu · TOYOTA RAV4 XA40 · 2012", or "Nepasuje na vaše vozidlo · …". A
 * statement only — the line stays in the cart and buyable whatever it says.
 */
export function CartLineFit({ fitment, className }: { fitment: CartLineFitment; className?: string }) {
	const Icon = ICON[fitment.tone];
	return (
		<p
			className={cn(
				"rounded-2xs inline-flex max-w-full items-start gap-1.5 px-2 py-1 text-xs leading-snug font-medium",
				TONE_CLASSES[fitment.tone],
				className,
			)}
		>
			<Icon className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
			<span className="min-w-0">
				{fitment.label} <span className="font-normal opacity-90">· {fitment.vehicle}</span>
			</span>
		</p>
	);
}
