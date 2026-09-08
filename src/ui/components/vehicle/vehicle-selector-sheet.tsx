"use client";

/**
 * The one vehicle selector.
 *
 * Header, hero, garage and configurator all mount THIS component. Two selectors would
 * become two definitions of what a vehicle is, and the first time they disagreed the
 * shopper would get two different answers to "does this fit?" on the same visit.
 *
 * The tree is never shipped to the browser: each step is fetched from a server action,
 * so the bundle carries the interaction and the server keeps the data.
 *
 * Two rules the UI enforces on itself:
 *
 *   - Changing an earlier answer clears the later ones. A model left over from another
 *     make is not a stale label, it is a wrong car.
 *   - A qualifier is only asked when the generation genuinely varies in it, and it is
 *     NEVER pre-selected when it does. Guessing a roof type is how somebody ends up with
 *     feet that do not attach to their car.
 */

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type BodyType, type RoofType, type VehicleSelection } from "@/lib/fitment/contract";
import { loadSelectorStep } from "@/lib/fitment/selector-actions";
import { type MonthAnswer, type RoofAnswer, type SelectorStep } from "@/lib/fitment/selector-types";
import { type GenerationCandidate } from "@/lib/fitment/selector-plan";
import { chooseVehicle } from "@/lib/garage/actions";
import { GARAGE_MAX_VEHICLES } from "@/lib/garage/cookie";
import { vehicleConfirmDestination } from "@/lib/garage/confirm-destination";
import { REVERSE_MAP } from "@/lib/channel-map";

type Draft = {
	makeId?: string;
	makeName?: string;
	modelId?: string;
	modelName?: string;
	/** Asked BEFORE the generation. It is the fact the shopper actually has. */
	year?: number;
	/** Only ever set when the year landed in two generations and the shopper separated them. */
	generationId?: string;
	/**
	 * The roof answer, not a roof type. "Iný typ" and "Neviem rozpoznať" are answers, and
	 * neither of them is the single roof type we happen to stock for this car.
	 */
	roofAnswer?: RoofAnswer;
	/**
	 * Month of MANUFACTURE, asked only when a month-precise window boundary needs it.
	 * "Neviem" is an answer and is recorded as one, so the step reads as done and the
	 * outcome is NEEDS_DETAIL rather than a silent guess.
	 */
	monthAnswer?: MonthAnswer;
	bodyType?: BodyType;
	doors?: number;
};

type Props = {
	/** The clickable element. Rendered inside SheetTrigger via asChild by the caller. */
	children: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const ROOF_LABEL_KEYS: Record<RoofType, string> = {
	"naked-roof": "roofNakedRoof",
	"raised-rails": "roofRaisedRails",
	"flush-rails": "roofFlushRails",
	fixpoint: "roofFixpoint",
	"rain-gutter": "roofRainGutter",
	"t-track": "roofTTrack",
};

const BODY_LABEL_KEYS: Record<BodyType, string> = {
	hatchback: "bodyHatchback",
	estate: "bodyEstate",
	saloon: "bodySaloon",
	suv: "bodySuv",
	mpv: "bodyMpv",
	van: "bodyVan",
	coupe: "bodyCoupe",
	convertible: "bodyConvertible",
	pickup: "bodyPickup",
};

export function VehicleSelectorSheet({ children, open, onOpenChange }: Props) {
	const t = useTranslations("fitment");
	// Save failures come from the garage action, so they read from the garage namespace.
	const tg = useTranslations("garage");
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();
	const { channel } = useParams<{ channel?: string }>();
	const [draft, setDraft] = useState<Draft>({});
	const [step, setStep] = useState<SelectorStep | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, startLoading] = useTransition();
	const [saving, startSaving] = useTransition();

	/**
	 * Every step change goes through here: set the draft, then ask the server what the
	 * next step contains.
	 *
	 * Deliberately NOT an effect. Fetching in an effect keyed on `draft` means setting
	 * state inside the effect body, which cascades renders — the repo's lint rule rejects
	 * it, and rightly: the fetch is a reaction to an EVENT (a click), not a
	 * synchronisation with an external system.
	 */
	const applyDraft = useCallback((next: Draft) => {
		setDraft(next);
		setError(null);
		startLoading(async () => {
			const result = await loadSelectorStep({
				makeId: next.makeId,
				modelId: next.modelId,
				year: next.year,
				generationId: next.generationId,
			});
			setStep(result);
		});
	}, []);

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (nextOpen) applyDraft({});
	};

	// Clearing downstream answers is the whole point: a model left over from another
	// make is not a stale label, it is a wrong car.
	const pickMake = (id: string, name: string) => applyDraft({ makeId: id, makeName: name });
	const pickModel = (id: string, name: string) =>
		applyDraft({ makeId: draft.makeId, makeName: draft.makeName, modelId: id, modelName: name });

	// The year DOES change which options exist now — it is what decides the generation —
	// so it is a server step rather than local state.
	const pickYear = (year: number) =>
		applyDraft({
			makeId: draft.makeId,
			makeName: draft.makeName,
			modelId: draft.modelId,
			modelName: draft.modelName,
			year,
		});

	// Only reached when one year named two generations. The shopper answered a question
	// about the car ("estate or hatchback"), not about our internal codes.
	const pickGenerationCandidate = (id: string) => applyDraft({ ...draft, generationId: id });

	const goBack = () => {
		const d = draft;
		// Unwind in the order the questions were asked, newest first.
		if (d.roofAnswer !== undefined || d.monthAnswer !== undefined) {
			setError(null);
			setDraft({ ...d, roofAnswer: undefined, monthAnswer: undefined });
			return;
		}
		if (d.generationId) {
			applyDraft({ ...d, generationId: undefined });
			return;
		}
		if (d.year !== undefined) {
			applyDraft({
				makeId: d.makeId,
				makeName: d.makeName,
				modelId: d.modelId,
				modelName: d.modelName,
			});
			return;
		}
		if (d.modelId) {
			applyDraft({ makeId: d.makeId, makeName: d.makeName });
			return;
		}
		applyDraft({});
	};

	const qualifiers = step?.qualifiers ?? null;
	const generation = step?.generation ?? null;

	// The roof is confirmed EVERY time the dataset expresses one, including when it
	// expresses exactly one. Holding a single roof type says what we can offer; it says
	// nothing about what is on this car. This is the question that used to be skipped.
	const needsRoof = Boolean(qualifiers?.roofTypes) && draft.roofAnswer === undefined;
	const needsBody = Boolean(qualifiers?.bodyTypes) && draft.bodyType === undefined;
	const needsDoors = Boolean(qualifiers?.doors) && draft.doors === undefined;
	// Asked only when a month-precise window boundary falls on this year. When every
	// window here is year-precise the month cannot move the answer, so there is no
	// question — and "I don't know" is a valid answer to the one we do ask.
	const needsMonth = Boolean(step?.monthDecides) && draft.monthAnswer === undefined;

	const canConfirm =
		Boolean(draft.makeId && draft.modelId && generation && draft.year !== undefined) &&
		!needsRoof &&
		!needsBody &&
		!needsDoors;

	const confirm = () => {
		if (!canConfirm || !generation) return;
		// Only a CONFIRMED roof becomes a roof type. "Iný typ" and "Neviem rozpoznať" are
		// real answers and they are not this one — carrying either of them through as the
		// single roof we stock is exactly the substitution this flow exists to prevent.
		// Leaving it unset makes the resolver say it cannot confirm, which is the truth.
		const roofType = draft.roofAnswer?.kind === "confirmed" ? draft.roofAnswer.roofType : undefined;
		const selection: VehicleSelection = {
			makeId: draft.makeId!,
			modelId: draft.modelId!,
			generationId: generation.id,
			year: draft.year!,
			...(roofType ? { roofType } : {}),
			// A value the generation itself settles is FILLED IN, not dropped. Dropping it
			// is what handed the resolver an unanswered qualifier and produced AMBIGUOUS.
			...(draft.bodyType ?? qualifiers?.resolved.bodyType
				? { bodyType: (draft.bodyType ?? qualifiers?.resolved.bodyType)! }
				: {}),
			...((draft.doors ?? qualifiers?.resolved.doors) !== undefined
				? { doors: (draft.doors ?? qualifiers?.resolved.doors)! }
				: {}),
			// Only a stated month travels. "Neviem" deliberately sends nothing, so the
			// window comparison stays unresolved and answers NEEDS_DETAIL.
			...(draft.monthAnswer?.kind === "month" ? { manufactureMonth: draft.monthAnswer.month } : {}),
		};
		startSaving(async () => {
			// USE, not save. Confirming a car is a shopping choice, not a request to keep
			// it — so it can never be refused for a full garage. Saving is its own button
			// on `/{market}/garage`.
			const result = await chooseVehicle(selection);
			if (result.ok) {
				setDraft({});
				onOpenChange(false);

				// From the homepage, confirming used to close the sheet and do nothing
				// else — the hero asks for the car and the answer never arrives. Every
				// other surface already answers in place, and pushing a shopper off a
				// cart or a checkout because they picked a car would be worse than not
				// helping, so `vehicleConfirmDestination` navigates from the market root
				// and nowhere else.
				const destination = vehicleConfirmDestination(pathname);
				if (destination) {
					const friendly = channel ? REVERSE_MAP[channel] ?? channel : null;
					router.push(friendly ? `/${friendly}${destination}` : destination);
					return;
				}

				// The active vehicle changes what several server-rendered surfaces say.
				router.refresh();
				return;
			}
			setError(errorMessageKey(result.error));
		});
	};

	function errorMessageKey(code: string): string {
		switch (code) {
			case "unknown-vehicle":
				return tg("errorUnknownVehicle");
			case "year-out-of-range":
				return tg("errorYear");
			case "invalid-qualifier":
				return tg("errorQualifier");
			case "limit-reached":
				return tg("limitReached", { max: GARAGE_MAX_VEHICLES });
			case "provider-unavailable":
				return tg("unavailable");
			case "garage-disabled":
				return tg("notConfigured");
			default:
				return tg("errorGeneric");
		}
	}

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			{children}
			<SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
				<SheetHeader className="border-border-default flex-row items-center justify-between border-b px-4 py-4">
					<SheetTitle>{t("selector.title")}</SheetTitle>
					<SheetCloseButton />
				</SheetHeader>

				{step?.isFixture && (
					<p className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed border-b border-current/20 px-4 py-2 text-xs">
						{t("demoNotice")}
					</p>
				)}

				<div className="flex-1 overflow-y-auto px-4 py-4">
					{loading && !step && (
						<p className="text-text-tertiary flex items-center gap-2 text-sm">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							{t("selector.loading")}
						</p>
					)}

					{step?.unavailable && (
						<p className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed rounded-md border border-current/20 px-3 py-2 text-sm">
							{t("selector.unavailable")}
						</p>
					)}

					{step && !step.unavailable && (
						<div className="space-y-6">
							<Breadcrumb
								draft={draft}
								generationName={generation?.name ?? null}
								onBack={goBack}
								backLabel={t("selector.back")}
							/>

							{!draft.makeId && (
								<OptionList
									legend={t("selector.chooseMake")}
									options={step.makes.map((m) => ({ key: m.id, label: m.name }))}
									onPick={(key, label) => pickMake(key, label)}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{draft.makeId && !draft.modelId && (
								<OptionList
									legend={t("selector.chooseModel")}
									options={(step.models ?? []).map((m) => ({ key: m.id, label: m.name }))}
									onPick={(key, label) => pickModel(key, label)}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{/* Year of MANUFACTURE, before any generation. It is the fact the
							    shopper can read off their registration document; "B9" is not. */}
							{draft.modelId && draft.year === undefined && (
								<OptionList
									legend={t("selector.chooseYear")}
									hint={t("selector.yearHelp")}
									options={(step.years ?? []).map((y) => ({ key: String(y), label: String(y) }))}
									onPick={(key) => pickYear(Number(key))}
									emptyLabel={t("selector.emptyStep")}
									columns
								/>
							)}

							{/* Only when one year genuinely names two generations. The question
							    is answerable by looking at the car, never a bare internal code. */}
							{step.generationCandidates && (
								<OptionList
									legend={t("selector.chooseVariant")}
									hint={t("selector.variantHelp")}
									options={step.generationCandidates.map((g) => ({
										key: g.id,
										label: candidateLabel(g, t),
									}))}
									onPick={(key) => pickGenerationCandidate(key)}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{generation && qualifiers?.roofTypes && (
								<RoofConfirmation
									roofTypes={qualifiers.roofTypes}
									answer={draft.roofAnswer}
									onAnswer={(answer) => setDraft((d) => ({ ...d, roofAnswer: answer }))}
									t={t}
								/>
							)}

							{generation && qualifiers?.bodyTypes && (
								<OptionList
									legend={t("selector.chooseBodyType")}
									selected={draft.bodyType}
									options={qualifiers.bodyTypes.map((b) => ({ key: b, label: t(BODY_LABEL_KEYS[b]) }))}
									onPick={(key) => setDraft((d) => ({ ...d, bodyType: key as BodyType }))}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{generation && qualifiers?.doors && (
								<OptionList
									legend={t("selector.chooseDoors")}
									selected={draft.doors === undefined ? undefined : String(draft.doors)}
									options={qualifiers.doors.map((d) => ({ key: String(d), label: String(d) }))}
									onPick={(key) => setDraft((d) => ({ ...d, doors: Number(key) }))}
									emptyLabel={t("selector.emptyStep")}
									columns
								/>
							)}

							{/* Asked only when it decides something, and answerable with "I don't
							    know" — which yields NEEDS_DETAIL, not a guess in either direction. */}
							{generation && needsMonth && (
								<OptionList
									legend={t("selector.chooseMonth")}
									hint={t("selector.monthHelp")}
									selected={
										draft.monthAnswer === undefined
											? undefined
											: draft.monthAnswer.kind === "unknown"
												? "unknown"
												: String(draft.monthAnswer.month)
									}
									options={[...monthOptions(locale), { key: "unknown", label: t("selector.monthUnknown") }]}
									onPick={(key) =>
										setDraft((d) => ({
											...d,
											monthAnswer:
												key === "unknown" ? { kind: "unknown" } : { kind: "month", month: Number(key) },
										}))
									}
									emptyLabel={t("selector.emptyStep")}
									columns
								/>
							)}
						</div>
					)}

					{error && (
						<p
							role="alert"
							className="bg-status-danger-bg text-status-danger border-status-danger-border mt-4 rounded-md border px-3 py-2 text-sm"
						>
							{error}
						</p>
					)}
				</div>

				<div className="border-border-default border-t px-4 py-4">
					<Button
						type="button"
						onClick={confirm}
						disabled={!canConfirm || saving}
						// Brand action colour, not the purchase CTA and not the compatibility
						// green: confirming a vehicle is neither a purchase nor a fit claim.
						className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover w-full"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<Check className="h-4 w-4" aria-hidden="true" />
						)}
						{t("selector.confirm")}
					</Button>
					{/*
					 * The only way into the garage from anywhere but the configurator page.
					 *
					 * `/{market}/garage` has always worked and every car on it has a working
					 * delete button, but nothing outside `VehicleSummary` — which renders on
					 * `/{market}/konfigurator` only — ever linked to it. So a shopper who
					 * filled the three slots was told to "remove some first" by a message
					 * that offered no way to do it, and the owner of the shop could not find
					 * the page either. The header opens this sheet, so one link here makes
					 * the garage reachable from the header as well.
					 */}
					<LinkWithChannel
						href="/garage"
						onClick={() => onOpenChange(false)}
						className="text-text-secondary hover:text-text-primary mt-3 block text-center text-sm underline underline-offset-4"
					>
						{t("myGarage")}
					</LinkWithChannel>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * Month names from the platform, not from the message files.
 *
 * Twelve names in twelve locales would be 144 strings to translate, review and keep in
 * parity, all of which `Intl` already knows and gets right — including the genitive forms
 * Slavic locales use in dates. The only translated string here is "I don't know".
 */
function monthOptions(locale: string): { key: string; label: string }[] {
	const format = new Intl.DateTimeFormat(locale, { month: "long" });
	return Array.from({ length: 12 }, (_, i) => ({
		key: String(i + 1),
		label: format.format(new Date(Date.UTC(2001, i, 1))),
	}));
}

/**
 * A generation candidate, named the way a person can answer it.
 *
 * Body type and door count first, production span second. Never the bare internal name on
 * its own: "B9" and "939" are our keys, and asking somebody to pick between two of them is
 * asking them to guess.
 */
function candidateLabel(g: GenerationCandidate, t: (key: string) => string): string {
	const shape = g.bodyTypes?.length === 1 ? t(BODY_LABEL_KEYS[g.bodyTypes[0]!]) : null;
	// An open-ended generation reads "2015\u2013", which is the ordinary way a production
	// span that has not ended is written.
	const span = `${g.productionYearFrom}\u2013${g.productionYearTo ?? ""}`;
	return [shape, span, g.name].filter(Boolean).join(" \u00b7 ");
}

/**
 * The roof question, asked EVERY time — including when we know exactly one answer.
 *
 * This component exists because the previous code treated "we hold one roof type for this
 * generation" as "the roof type is settled". It is not. It is a fact about our catalogue,
 * and the shopper's roof is a fact about their car; the two are unrelated, and the first
 * cannot stand in for the second. With one option the question is a single picture and a
 * yes/no, which is a smaller ask than a list — not a reason to skip it.
 *
 * "Iný typ" and "Neviem rozpoznať" are answers, and neither becomes a roof type. They
 * leave the selection without one, the resolver reports that it cannot confirm, and the
 * shopper gets help identifying the roof instead of a fit we invented for them.
 */
function RoofConfirmation({
	roofTypes,
	answer,
	onAnswer,
	t,
}: {
	roofTypes: RoofType[];
	answer: RoofAnswer | undefined;
	onAnswer: (answer: RoofAnswer) => void;
	t: (key: string) => string;
}) {
	const single = roofTypes.length === 1 ? roofTypes[0]! : null;
	const selectedKey =
		answer === undefined ? undefined : answer.kind === "confirmed" ? answer.roofType : answer.kind;

	return (
		<fieldset>
			<legend className="text-text-primary mb-1 text-sm font-medium">
				{single ? t("selector.confirmRoofType") : t("selector.chooseRoofType")}
			</legend>
			<p className="text-text-tertiary mb-2 text-xs">{t("selector.roofTypeHelp")}</p>

			{single ? (
				<div className="border-border-default mb-2 rounded-md border p-3">
					<RoofIllustration roofType={single} />
					<p className="text-text-primary mt-2 text-sm font-medium">{t(ROOF_LABEL_KEYS[single])}</p>
					<p className="text-text-secondary mt-1 text-sm">{t("selector.roofSingleQuestion")}</p>
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				{single ? (
					<RoofChoice
						label={t("selector.roofYes")}
						active={selectedKey === single}
						onClick={() => onAnswer({ kind: "confirmed", roofType: single })}
					/>
				) : (
					roofTypes.map((roof) => (
						<RoofChoice
							key={roof}
							label={t(ROOF_LABEL_KEYS[roof])}
							active={selectedKey === roof}
							onClick={() => onAnswer({ kind: "confirmed", roofType: roof })}
						/>
					))
				)}
				<RoofChoice
					label={t("selector.roofOther")}
					active={selectedKey === "other"}
					onClick={() => onAnswer({ kind: "other" })}
				/>
				<RoofChoice
					label={t("selector.roofUnsure")}
					active={selectedKey === "unsure"}
					onClick={() => onAnswer({ kind: "unsure" })}
				/>
			</div>

			{answer?.kind === "other" && (
				<p
					role="status"
					className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed mt-2 rounded-md px-3 py-2 text-sm"
				>
					{t("selector.roofOtherHelp")}
				</p>
			)}
			{answer?.kind === "unsure" && (
				<p
					role="status"
					className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed mt-2 rounded-md px-3 py-2 text-sm"
				>
					{t("selector.roofUnsureHelp")}
				</p>
			)}
		</fieldset>
	);
}

function RoofChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"border-border-default text-text-primary hover:bg-surface-muted focus-visible:ring-ring rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
				active && "border-action-primary bg-surface-muted font-medium",
			)}
		>
			{label}
		</button>
	);
}

/**
 * A schematic roof, drawn rather than photographed.
 *
 * The question is "does your car look like this?", so it needs a picture. A line drawing
 * is honest about being schematic, carries no brand, needs no asset pipeline and no
 * network request, and is legible in both themes because it inherits `currentColor`.
 */
function RoofIllustration({ roofType }: { roofType: RoofType }) {
	return (
		<svg viewBox="0 0 160 60" className="text-text-secondary h-16 w-full" role="img" aria-hidden="true">
			{/* Car silhouette, shared by every variant. */}
			<path
				d="M18 46 L30 30 Q34 25 42 25 L108 25 Q118 25 124 31 L142 46"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<line x1="10" y1="46" x2="150" y2="46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			{roofType === "raised-rails" && (
				<>
					<path d="M44 22 L106 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
					<path d="M48 22 L48 26 M102 22 L102 26" stroke="currentColor" strokeWidth="2" />
				</>
			)}
			{roofType === "flush-rails" && (
				<path d="M46 24 L104 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
			)}
			{roofType === "fixpoint" && (
				<>
					<circle cx="52" cy="25" r="2.5" fill="currentColor" />
					<circle cx="98" cy="25" r="2.5" fill="currentColor" />
				</>
			)}
			{roofType === "rain-gutter" && (
				<path d="M40 27 L110 27" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
			)}
			{roofType === "t-track" && (
				<path d="M46 23 L104 23 M46 26 L104 26" stroke="currentColor" strokeWidth="1.5" />
			)}
		</svg>
	);
}

function Breadcrumb({
	draft,
	generationName,
	onBack,
	backLabel,
}: {
	draft: Draft;
	/** The DERIVED generation, shown only once the year has actually settled one. */
	generationName: string | null;
	onBack: () => void;
	backLabel: string;
}) {
	// Year before generation, matching the order the questions were asked.
	const parts = [
		draft.makeName,
		draft.modelName,
		draft.year ? String(draft.year) : null,
		generationName,
	].filter(Boolean);
	if (parts.length === 0) return null;
	return (
		<div className="flex items-center gap-2">
			<Button type="button" variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
				<ChevronLeft className="h-4 w-4" aria-hidden="true" />
				{backLabel}
			</Button>
			<p className="text-text-tertiary truncate text-sm">{parts.join(" · ")}</p>
		</div>
	);
}

function OptionList({
	legend,
	hint,
	options,
	onPick,
	emptyLabel,
	selected,
	columns = false,
}: {
	legend: string;
	hint?: string;
	options: { key: string; label: string }[];
	onPick: (key: string, label: string) => void;
	emptyLabel: string;
	selected?: string;
	columns?: boolean;
}) {
	return (
		<fieldset>
			<legend className="text-text-primary mb-1 text-sm font-medium">{legend}</legend>
			{hint && <p className="text-text-tertiary mb-2 text-xs">{hint}</p>}
			{options.length === 0 ? (
				<p className="text-text-tertiary text-sm">{emptyLabel}</p>
			) : (
				<div className={cn("gap-2", columns ? "grid grid-cols-3" : "flex flex-col")}>
					{options.map((option) => (
						<button
							key={option.key}
							type="button"
							aria-pressed={selected === option.key}
							onClick={() => onPick(option.key, option.label)}
							className={cn(
								"border-border-default text-text-primary hover:bg-surface-muted focus-visible:ring-ring rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
								selected === option.key && "border-action-primary bg-surface-muted font-medium",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</fieldset>
	);
}
