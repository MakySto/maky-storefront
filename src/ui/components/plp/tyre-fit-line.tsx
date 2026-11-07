"use client";

import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { TyreCardFit, TyreCardFitKind } from "@/lib/tyre-size/types";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";

/**
 * What a snow-chain card says about the tyre size the shopper gave: the product page's verdict in one line.
 *
 * The same three answers as the page's box (`tyre-fit-box`), in the same words (the `tyreSize` messages the box
 * already uses), so a card and its page never disagree about "does it fit":
 *
 *   fits   the shop holds the size for the product      green, a tick
 *   ask    the list attaches a tyre make or model to it  amber, a question mark
 *   no-fit the list does not hold the size              quiet, a cross
 *
 * There is no fourth, "fits, but check it yourself": the owner (2026-11-07) wants a card green when the product has the
 * size and absent from the narrowed list when it has not, like the roof racks. Where the size came from is said on the
 * product page, in small words under the green row, not as a warning on the card.
 *
 * "Does not fit" is deliberately not the red of the box: beside it stand 130 other cards that say the same when the
 * shopper asked for all chains, and a wall of red would shout louder than the one answer they came for.
 */
const LOOK: Record<TyreCardFitKind, { tone: string; icon: typeof CheckIcon }> = {
	fits: { tone: cn("rounded-xs px-2 py-1", TONE_CLASSES.fits), icon: CheckIcon },
	ask: { tone: cn("rounded-xs px-2 py-1", TONE_CLASSES.unconfirmed), icon: CircleHelpIcon },
	"no-fit": { tone: "rounded-xs px-2 py-1 text-text-tertiary", icon: XIcon },
};

export function TyreFitLine({ fit, className }: { fit: TyreCardFit; className?: string }) {
	const t = useTranslations("tyreSize");
	const { tone, icon: Icon } = LOOK[fit.kind];
	const label =
		fit.kind === "no-fit"
			? t("fitNoFitTitle", { size: fit.size })
			: fit.kind === "ask"
				? t("cardAsk")
				: t("fitFitsTitle", { size: fit.size });

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
