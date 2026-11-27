"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, ExternalLink } from "lucide-react";

import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
// One map of the six roof names, shared with the listing and the product page.
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { cn } from "@/lib/utils";
import { type RoofType } from "@/lib/fitment/contract";
import { type RoofAnswer } from "@/lib/fitment/selector-types";

/** The one line under a roof's name that says how to tell it on the car. */
const ROOF_HINT_KEYS: Record<RoofType, string> = {
	"naked-roof": "selector.roofHintNakedRoof",
	"raised-rails": "selector.roofHintRaisedRails",
	"flush-rails": "selector.roofHintFlushRails",
	fixpoint: "selector.roofHintFixpoint",
	"rain-gutter": "selector.roofHintRainGutter",
	"t-track": "selector.roofHintTTrack",
};

/**
 * The roof question, asked EVERY time — including when we know exactly one answer.
 *
 * This component exists because the previous code treated "we hold one roof type for this
 * generation" as "the roof type is settled". It is not. It is a fact about our catalogue,
 * and the shopper's roof is a fact about their car; the two are unrelated, and the first
 * cannot stand in for the second. With one option the question is one picture to confirm,
 * which is a smaller ask than a list — not a reason to skip it.
 *
 * Every roof on offer is a picture, its name and one line that says how to tell it on the car
 * (owner, 2026-11-27: the question had no pictures, and a name such as "Integrované lyžiny"
 * means nothing to somebody who has never bought a rack). The names stay the ones the listing and
 * the product page use (`ROOF_LABEL_KEY`), so the shopper meets one vocabulary.
 *
 * A shopper who cannot tell opens the help: how to look at the roof, the detailed guide in a new
 * tab where this market has one (the window and what was chosen stay as they are), and a way to go
 * on without a roof type. That last one is an answer and never becomes a roof type: it leaves the
 * selection without one, the resolver reports that it cannot confirm, and the shopper is told so
 * here, before the result says it. There is no "another type": the roofs shown are the ones a set
 * is on offer for, so that answer could only end on nothing; whoever has another roof is told what
 * the list is and how to ask.
 */
export function RoofQuestion({
	roofTypes,
	answer,
	onAnswer,
	guidePath,
	onLeave,
	t,
}: {
	roofTypes: RoofType[];
	answer: RoofAnswer | undefined;
	onAnswer: (answer: RoofAnswer) => void;
	/** The roof section of this market's guide; `null` where there is none to link to. */
	guidePath: string | null;
	/** The shopper follows a link that leaves the page, so the window closes. */
	onLeave: () => void;
	t: (key: string) => string;
}) {
	const helpId = useId();
	const [helpOpen, setHelpOpen] = useState(false);
	const unsure = answer?.kind === "unsure";

	return (
		<fieldset>
			<legend className="text-text-primary mb-1 text-sm font-medium">
				{roofTypes.length === 1 ? t("selector.confirmRoofType") : t("selector.chooseRoofType")}
			</legend>
			<p className="text-text-tertiary mb-2 text-xs">{t("selector.roofTypeHelp")}</p>

			<div className="flex flex-col gap-2">
				{roofTypes.map((roof) => {
					const active = answer?.kind === "confirmed" && answer.roofType === roof;
					return (
						<button
							key={roof}
							type="button"
							aria-pressed={active}
							onClick={() => onAnswer({ kind: "confirmed", roofType: roof })}
							className={cn(
								"border-border-default bg-surface-card text-text-primary hover:border-border-strong focus-visible:ring-ring flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
								active && "border-action-primary ring-action-primary hover:border-action-primary ring-1",
							)}
						>
							<RoofIllustration roofType={roof} />
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-semibold">{t(ROOF_LABEL_KEY[roof])}</span>
								<span className="text-text-secondary mt-0.5 block text-xs leading-snug">
									{t(ROOF_HINT_KEYS[roof])}
								</span>
							</span>
							<Check
								className={cn("text-action-primary h-5 w-5 shrink-0", !active && "invisible")}
								aria-hidden="true"
							/>
						</button>
					);
				})}
			</div>

			<button
				type="button"
				aria-expanded={helpOpen || unsure}
				aria-controls={helpId}
				onClick={() => setHelpOpen((open) => !open)}
				className="text-text-primary focus-visible:ring-ring mt-3 inline-flex items-center gap-1 rounded-xs text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-hidden"
			>
				{t("selector.roofHelpToggle")}
				<ChevronDown
					className={cn("h-4 w-4 transition-transform", (helpOpen || unsure) && "rotate-180")}
					aria-hidden="true"
				/>
			</button>

			<div id={helpId} hidden={!(helpOpen || unsure)} className="bg-surface-muted mt-2 rounded-md p-3">
				<p className="text-text-primary text-sm">{t("selector.roofHelpIntro")}</p>
				{guidePath && (
					<p className="mt-2 text-sm">
						<LinkWithChannel
							href={guidePath}
							target="_blank"
							rel="noopener"
							className="text-text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-xs font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-hidden"
						>
							{t("selector.roofHelpArticle")}
							<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
							<span className="sr-only">({t("selector.roofHelpNewTab")})</span>
						</LinkWithChannel>
					</p>
				)}
				<button
					type="button"
					aria-pressed={unsure}
					onClick={() => onAnswer({ kind: "unsure" })}
					className={cn(
						"border-border-default bg-surface-card text-text-primary hover:border-border-strong focus-visible:ring-ring mt-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
						unsure && "border-action-primary hover:border-action-primary font-medium",
					)}
				>
					{t("selector.roofSkip")}
				</button>
				{unsure && (
					<p
						role="status"
						className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed mt-2 rounded-md px-3 py-2 text-sm"
					>
						{t("selector.roofSkipNote")}
					</p>
				)}
			</div>

			<p className="text-text-tertiary mt-3 text-xs">
				{t("selector.roofMissing")}{" "}
				<LinkWithChannel
					href="/kontakt"
					onClick={onLeave}
					className="text-text-secondary focus-visible:ring-ring rounded-xs underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-hidden"
				>
					{t("selector.roofMissingContact")}
				</LinkWithChannel>
			</p>
		</fieldset>
	);
}

/**
 * A schematic roof, drawn rather than photographed.
 *
 * The question is "does your car look like this?", so every answer needs a picture. A line drawing
 * is honest about being schematic, carries no brand, needs no asset pipeline and no network
 * request. The car is the same in all six (the cabin from the side, in `currentColor`); what
 * differs is the one thing the shopper is asked to look for, in the brand colour: the rail and the
 * gap under it, the rail lying on the roof, the door frame a bare roof is clamped by, the two
 * covers of a fixpoint, the channel, the gutter lip.
 *
 * Decorative for assistive technology: the name and the hint beside it say the same in words.
 */
export function RoofIllustration({ roofType }: { roofType: RoofType }) {
	return (
		<svg viewBox="0 0 200 84" className="text-text-secondary h-12 w-28 shrink-0" aria-hidden="true">
			<path d="M40 72L62 44H148L170 72Z" className="fill-surface-muted" />
			<path d="M104 44V72" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<path d="M14 72H186" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			<path
				d="M30 72L54 40Q58 34 66 34H142Q152 34 157 40L178 72"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<g className="text-brand" fill="none" stroke="currentColor">
				{roofType === "raised-rails" && (
					<>
						<path d="M62 22H143" strokeWidth="4" strokeLinecap="round" />
						<path d="M67 22V34M104 22V34M138 22V34" strokeWidth="3" />
					</>
				)}
				{roofType === "flush-rails" && <path d="M60 31H145" strokeWidth="5" strokeLinecap="round" />}
				{roofType === "naked-roof" && <path d="M56 39H150" strokeWidth="2" strokeDasharray="3 4" />}
				{roofType === "fixpoint" && (
					<>
						<rect x="68" y="29" width="14" height="5" rx="1.5" fill="currentColor" stroke="none" />
						<rect x="124" y="29" width="14" height="5" rx="1.5" fill="currentColor" stroke="none" />
					</>
				)}
				{roofType === "t-track" && (
					<>
						<path d="M60 29H145M60 32.5H145" strokeWidth="1.6" />
						<path d="M60 27v8M145 27v8" strokeWidth="1.6" />
					</>
				)}
				{roofType === "rain-gutter" && (
					<path d="M46 40Q50 36 56 36H152Q158 36 162 41" strokeWidth="3" strokeLinecap="round" />
				)}
			</g>
		</svg>
	);
}
