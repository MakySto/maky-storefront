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
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type BodyType, type RoofType, type VehicleSelection } from "@/lib/fitment/contract";
import { loadSelectorStep } from "@/lib/fitment/selector-actions";
import { type SelectorStep } from "@/lib/fitment/selector-types";
import { saveVehicle } from "@/lib/garage/actions";
import { GARAGE_MAX_VEHICLES } from "@/lib/garage/cookie";

type Draft = {
	makeId?: string;
	makeName?: string;
	modelId?: string;
	modelName?: string;
	generationId?: string;
	generationName?: string;
	year?: number;
	roofType?: RoofType;
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
	const router = useRouter();
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
	const pickGeneration = (id: string, name: string) =>
		applyDraft({
			...draft,
			generationId: id,
			generationName: name,
			year: undefined,
			roofType: undefined,
			bodyType: undefined,
			doors: undefined,
		});

	// Year and qualifier answers do not change which options exist, so they are pure
	// local state — no round trip.
	const pickYear = (year: number) => setDraft((d) => ({ ...d, year }));

	const goBack = () => {
		const d = draft;
		if (d.year !== undefined) {
			setError(null);
			setDraft({ ...d, year: undefined, roofType: undefined, bodyType: undefined, doors: undefined });
			return;
		}
		if (d.generationId) {
			applyDraft({ makeId: d.makeId, makeName: d.makeName, modelId: d.modelId, modelName: d.modelName });
			return;
		}
		if (d.modelId) {
			applyDraft({ makeId: d.makeId, makeName: d.makeName });
			return;
		}
		applyDraft({});
	};

	const qualifiers = step?.qualifiers ?? null;
	const needsRoof = Boolean(qualifiers?.roofTypes) && draft.roofType === undefined;
	const needsBody = Boolean(qualifiers?.bodyTypes) && draft.bodyType === undefined;
	const needsDoors = Boolean(qualifiers?.doors) && draft.doors === undefined;
	const canConfirm =
		Boolean(draft.makeId && draft.modelId && draft.generationId && draft.year) &&
		!needsRoof &&
		!needsBody &&
		!needsDoors;

	const confirm = () => {
		if (!canConfirm) return;
		const selection: VehicleSelection = {
			makeId: draft.makeId!,
			modelId: draft.modelId!,
			generationId: draft.generationId!,
			year: draft.year!,
			...(draft.roofType ? { roofType: draft.roofType } : {}),
			...(draft.bodyType ? { bodyType: draft.bodyType } : {}),
			...(draft.doors !== undefined ? { doors: draft.doors } : {}),
		};
		startSaving(async () => {
			const result = await saveVehicle(selection);
			if (result.ok) {
				setDraft({});
				onOpenChange(false);
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
							<Breadcrumb draft={draft} onBack={goBack} backLabel={t("selector.back")} />

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

							{draft.modelId && !draft.generationId && (
								<OptionList
									legend={t("selector.chooseGeneration")}
									options={(step.generations ?? []).map((g) => ({ key: g.id, label: g.name }))}
									onPick={(key, label) => pickGeneration(key, label)}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{draft.generationId && draft.year === undefined && (
								<OptionList
									legend={t("selector.chooseYear")}
									options={(step.years ?? []).map((y) => ({ key: String(y), label: String(y) }))}
									onPick={(key) => pickYear(Number(key))}
									emptyLabel={t("selector.emptyStep")}
									columns
								/>
							)}

							{draft.year !== undefined && qualifiers?.roofTypes && (
								<OptionList
									legend={t("selector.chooseRoofType")}
									hint={t("selector.roofTypeHelp")}
									selected={draft.roofType}
									options={qualifiers.roofTypes.map((r) => ({ key: r, label: t(ROOF_LABEL_KEYS[r]) }))}
									onPick={(key) => setDraft((d) => ({ ...d, roofType: key as RoofType }))}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{draft.year !== undefined && qualifiers?.bodyTypes && (
								<OptionList
									legend={t("selector.chooseBodyType")}
									selected={draft.bodyType}
									options={qualifiers.bodyTypes.map((b) => ({ key: b, label: t(BODY_LABEL_KEYS[b]) }))}
									onPick={(key) => setDraft((d) => ({ ...d, bodyType: key as BodyType }))}
									emptyLabel={t("selector.emptyStep")}
								/>
							)}

							{draft.year !== undefined && qualifiers?.doors && (
								<OptionList
									legend={t("selector.chooseDoors")}
									selected={draft.doors === undefined ? undefined : String(draft.doors)}
									options={qualifiers.doors.map((d) => ({ key: String(d), label: String(d) }))}
									onPick={(key) => setDraft((d) => ({ ...d, doors: Number(key) }))}
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
				</div>
			</SheetContent>
		</Sheet>
	);
}

function Breadcrumb({ draft, onBack, backLabel }: { draft: Draft; onBack: () => void; backLabel: string }) {
	const parts = [
		draft.makeName,
		draft.modelName,
		draft.generationName,
		draft.year ? String(draft.year) : null,
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
