"use client";

import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { TyreCardFit, TyreCardFitKind } from "@/lib/tyre-size/types";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";

/**
 * What a snow-chain card says about the tyre size the shopper gave: the product page's verdict in one line.
 *
 * The same four answers as the page's box (`tyre-fit-box`), in the same words (the `tyreSize` messages the box
 * already uses), so a card and its page never disagree about "does it fit":
 *
 *   fits                 the manufacturer's list holds the size            green, a tick
 *   fits-supplier        the supplier's data from the previous shop's card amber, a warning
 *   fits-with-condition  the list attaches a tyre make or model to it      amber, a warning
 *   no-fit               the list does not hold the size                   quiet, a cross
 *
 * "Does not fit" is deliberately not the red of the box: beside it stand 130 other cards that say the same when the
 * shopper asked for all chains, and a wall of red would shout louder than the one answer they came for.
 */
const LOOK: Record<TyreCardFitKind, { tone: string; icon: typeof CheckIcon }> = {
	fits: { tone: cn("rounded-xs px-2 py-1", TONE_CLASSES.fits), icon: CheckIcon },
	"fits-supplier": { tone: cn("rounded-xs px-2 py-1", TONE_CLASSES.unconfirmed), icon: TriangleAlertIcon },
	"fits-with-condition": {
		tone: cn("rounded-xs px-2 py-1", TONE_CLASSES.unconfirmed),
		icon: TriangleAlertIcon,
	},
	"no-fit": { tone: "rounded-xs px-2 py-1 text-text-tertiary", icon: XIcon },
};

export function TyreFitLine({ fit, className }: { fit: TyreCardFit; className?: string }) {
	const t = useTranslations("tyreSize");
	const { tone, icon: Icon } = LOOK[fit.kind];
	const label =
		fit.kind === "no-fit"
			? t("fitNoFitTitle", { size: fit.size })
			: fit.kind === "fits-with-condition"
				? t("fitConditionTitle")
				: fit.kind === "fits-supplier"
					? t("fitSupplierTitle")
					: t("fitFitsTitle");

	return (
		<p
			data-testid="card-tyre-fit"
			data-fit={fit.kind}
			className={cn(
				"flex items-start gap-1.5 text-[0.8125rem] leading-snug",
				fit.kind === "no-fit" ? "font-medium" : "font-semibold",
				tone,
				className,
			)}
		>
			<Icon className="mt-[0.1875rem] h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
			<span className="min-w-0">{label}</span>
		</p>
	);
}
