"use client";

import Image from "next/image";
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
 * Every roof on offer is a tile: the owner's picture of it, its name and one line that says how to
 * tell it on the car (owner, 2026-11-27: the question had no pictures, and a name such as
 * "Integrované lyžiny" means nothing to somebody who has never bought a rack). The names and the
 * lines are the terminology standard's (v1.2, 2026-11-27, twelve markets), and the names are the
 * ones the listing and the product page use (`ROOF_LABEL_KEY`), so the shopper meets one vocabulary.
 * Tiles are two to a row and equally tall, and a name wraps rather than being cut.
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

			<div className={cn("grid gap-2", roofTypes.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
				{roofTypes.map((roof) => {
					const active = answer?.kind === "confirmed" && answer.roofType === roof;
					return (
						<button
							key={roof}
							type="button"
							aria-pressed={active}
							onClick={() => onAnswer({ kind: "confirmed", roofType: roof })}
							className={cn(
								"border-border-default bg-surface-card text-text-primary hover:border-border-strong focus-visible:ring-ring relative flex h-full flex-col overflow-hidden rounded-md border text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
								roofTypes.length === 1 && "sm:flex-row sm:items-center",
								active && "border-action-primary ring-action-primary hover:border-action-primary ring-1",
							)}
						>
							<RoofIllustration roofType={roof} className={roofTypes.length === 1 ? "sm:w-1/2" : undefined} />
							<span className="block min-w-0 flex-1 p-2.5">
								<span className="block text-sm leading-snug font-semibold">{t(ROOF_LABEL_KEY[roof])}</span>
								<span className="text-text-secondary mt-1 block text-xs leading-snug">
									{t(ROOF_HINT_KEYS[roof])}
								</span>
							</span>
							{active && (
								<span className="bg-action-primary text-action-primary-text absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full">
									<Check className="h-4 w-4" aria-hidden="true" />
								</span>
							)}
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
 * The picture of each roof type: the owner's own illustrations (2026-11-27), one angle, one scale, one
 * background, the thing to look for in blue. They live in `public/roof-types/` under the file names
 * of the terminology standard, cropped to the band the car fills (8:5) and sized for a tile; the
 * originals are kept with the project's files. A better drawing replaces the file of the same name.
 *
 * The standard's identifiers (`normal_roof`, `fixed_points`, `roof_tracks`, `rain_gutters`) are a
 * proposal for new data. The dataset's codes stay as they are, as the standard itself asks where
 * stable codes exist, and this map is the one place that ties a code to its picture.
 */
export const ROOF_IMAGE: Record<RoofType, string> = {
	"naked-roof": "/roof-types/normal-roof.webp",
	"raised-rails": "/roof-types/raised-rails.webp",
	"flush-rails": "/roof-types/flush-rails.webp",
	fixpoint: "/roof-types/fixed-points.webp",
	"t-track": "/roof-types/roof-tracks.webp",
	"rain-gutter": "/roof-types/rain-gutters.webp",
};

/**
 * Decorative for assistive technology (`alt=""`): inside the button the name and the line beside it
 * say the same in words, and an alt text would make a screen reader say the name twice.
 */
export function RoofIllustration({ roofType, className }: { roofType: RoofType; className?: string }) {
	return (
		<Image
			src={ROOF_IMAGE[roofType]}
			alt=""
			width={720}
			height={450}
			sizes="(min-width: 640px) 208px, 46vw"
			className={cn("bg-surface-card aspect-[8/5] h-auto w-full shrink-0 object-cover", className)}
		/>
	);
}
