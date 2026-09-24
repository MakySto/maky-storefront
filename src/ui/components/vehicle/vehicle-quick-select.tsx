"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, ChevronsUpDownIcon, Loader2 } from "lucide-react";

import { SheetTrigger } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { REVERSE_MAP } from "@/lib/channel-map";
import { type VehicleSelection } from "@/lib/fitment/contract";
import { loadSelectorStep } from "@/lib/fitment/selector-actions";
import { type SelectorOption, type SelectorStep } from "@/lib/fitment/selector-types";
import { chooseVehicle } from "@/lib/garage/actions";
import { searchWithoutPagination, vehicleConfirmDestination } from "@/lib/garage/confirm-destination";
import { VehicleSelectorSheet } from "./vehicle-selector-sheet";

export type VehicleQuickSelectInitial = {
	makeId: string;
	modelId: string;
	year: number;
	models: SelectorOption[];
	years: number[];
};

/**
 * "Značka · Model · Rok výroby" and the green button — the approved homepage's vehicle block,
 * answered in place (owner, 2026-09-24: "pod zoznamom kategórií chcem konfigurátor ako na
 * obrázku").
 *
 * The same selector, not a second one: each field asks `loadSelectorStep`, the server action
 * the sheet asks, in the same order (make → model → year), so the lists are the same lists.
 * What three fields cannot ask — the generation when a year names two, the roof, the body, the
 * doors, a month on a window boundary — the button hands to `VehicleSelectorSheet`, opened at
 * that question with the three answers already in it. Nothing is guessed to skip a question.
 *
 * When the year settles everything, the button confirms the car itself, through the same
 * `chooseVehicle` as the sheet: USE, not save, and from the market root the same move to
 * `/konfigurator`. Trying a car never saves it to the garage and never narrows a listing by
 * itself; with the car already in use and the fields unchanged, the button is the explicit
 * "Zobraziť nosiče pre moje auto" link that does.
 */
export function VehicleQuickSelect({
	makes,
	initial,
	activeHref,
	layout = "block",
	afterConfirmPath = null,
	className,
}: {
	makes: SelectorOption[];
	/** The car in use, so the fields open on it. */
	initial?: VehicleQuickSelectInitial | null;
	/** Where the button goes while the fields still show the car in use. */
	activeHref?: string | null;
	/** `block` — the homepage panel; `bar` — one row above a listing. */
	layout?: "block" | "bar";
	/**
	 * Where a car confirmed here leads, channel-relative — on a listing, the same listing with
	 * the vehicle filter on: the button says "show the compatible products", and that click is
	 * the explicit one. Without it the selector's own rule applies (see `confirm`).
	 */
	afterConfirmPath?: string | null;
	className?: string;
}) {
	const t = useTranslations("home");
	const tFitment = useTranslations("fitment");
	const tGarage = useTranslations("garage");
	const router = useRouter();
	const pathname = usePathname();
	const { channel } = useParams<{ channel?: string }>();
	const fieldId = useId();

	const [makeId, setMakeId] = useState(initial?.makeId ?? "");
	const [modelId, setModelId] = useState(initial?.modelId ?? "");
	const [year, setYear] = useState(initial ? String(initial.year) : "");
	const [models, setModels] = useState<SelectorOption[] | null>(initial?.models ?? null);
	const [years, setYears] = useState<number[] | null>(initial?.years ?? null);
	const [step, setStep] = useState<SelectorStep | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [loading, startLoading] = useTransition();
	const [saving, startSaving] = useTransition();
	// Only the newest answer may land: a slow reply for the previous make must not refill the
	// model list after the shopper moved on.
	const request = useRef(0);

	const makeName = makes.find((m) => m.id === makeId)?.name;
	const modelName = models?.find((m) => m.id === modelId)?.name;
	const yearNumber = year ? Number(year) : undefined;

	const load = (input: Parameters<typeof loadSelectorStep>[0], apply: (step: SelectorStep) => void) => {
		const ticket = ++request.current;
		setError(null);
		startLoading(async () => {
			const result = await loadSelectorStep(input);
			if (ticket === request.current) apply(result);
		});
	};

	// Changing an earlier answer clears the later ones — a model left over from another make is
	// a wrong car, not a stale label.
	const pickMake = (id: string) => {
		setMakeId(id);
		setModelId("");
		setYear("");
		setModels(null);
		setYears(null);
		setStep(null);
		if (id) load({ makeId: id }, (result) => setModels(result.models ?? []));
	};
	const pickModel = (id: string) => {
		setModelId(id);
		setYear("");
		setYears(null);
		setStep(null);
		if (id) load({ makeId, modelId: id }, (result) => setYears(result.years ?? []));
	};
	const pickYear = (value: string) => {
		setYear(value);
		setStep(null);
		if (value) load({ makeId, modelId, year: Number(value) }, setStep);
	};

	const unchanged =
		Boolean(initial) &&
		makeId === initial?.makeId &&
		modelId === initial?.modelId &&
		yearNumber === initial?.year;

	// Everything the year settles: one generation, and no roof, body, door or month question.
	const qualifiers = step?.qualifiers ?? null;
	const settled =
		Boolean(step?.generation) &&
		!step?.generationCandidates &&
		!qualifiers?.roofTypes &&
		!qualifiers?.bodyTypes &&
		!qualifiers?.doors &&
		!step?.monthDecides;

	const confirm = () => {
		const generation = step?.generation;
		if (!settled || !generation || !makeId || !modelId || yearNumber === undefined) return;
		const selection: VehicleSelection = {
			makeId,
			modelId,
			generationId: generation.id,
			year: yearNumber,
			// A value the generation settles is filled in, as the sheet does — never dropped.
			...(qualifiers?.resolved.bodyType ? { bodyType: qualifiers.resolved.bodyType } : {}),
			...(qualifiers?.resolved.doors !== undefined ? { doors: qualifiers.resolved.doors } : {}),
		};
		startSaving(async () => {
			const result = await chooseVehicle(selection);
			if (!result.ok) {
				setError(tGarage("errorGeneric"));
				return;
			}
			const friendly = channel ? REVERSE_MAP[channel] ?? channel : null;
			const destination = afterConfirmPath ?? vehicleConfirmDestination(pathname);
			if (destination) {
				router.push(friendly ? `/${friendly}${destination}` : destination);
				return;
			}
			const nextSearch = searchWithoutPagination(window.location.search);
			if (nextSearch !== null) {
				router.replace(`${pathname}${nextSearch}`);
				return;
			}
			router.refresh();
		});
	};

	const bar = layout === "bar";
	const fieldClass = cn(
		"border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus:border-cta focus:ring-cta w-full appearance-none rounded-xs border pr-10 pl-3.5 text-sm transition-colors focus:ring-1 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60",
		bar ? "h-11" : "h-12",
	);
	const labelClass = "text-text-primary mb-1.5 block text-[0.8125rem] font-semibold";
	const buttonClass = cn(
		"bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-cta inline-flex w-full items-center justify-center gap-2.5 rounded-xs px-6 text-[0.9375rem] font-semibold whitespace-nowrap shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:opacity-70 lg:w-auto",
		bar ? "h-11" : "h-12",
	);
	const busy = loading || saving;
	const buttonIcon = busy ? (
		<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
	) : (
		<ArrowRightIcon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} aria-hidden="true" />
	);

	const select = (
		id: string,
		label: string,
		value: string,
		onChange: (value: string) => void,
		placeholder: string,
		options: { value: string; label: string }[] | null,
	) => (
		<div className="min-w-0">
			<label htmlFor={`${fieldId}-${id}`} className={labelClass}>
				{label}
			</label>
			<span className="relative block">
				<select
					id={`${fieldId}-${id}`}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					disabled={options === null}
					className={cn(fieldClass, !value && "text-text-tertiary")}
				>
					<option value="">{placeholder}</option>
					{options?.map((option) => (
						<option key={option.value} value={option.value} className="text-text-primary">
							{option.label}
						</option>
					))}
				</select>
				<ChevronsUpDownIcon
					className="text-text-tertiary pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2"
					aria-hidden="true"
				/>
			</span>
		</div>
	);

	let action: React.ReactNode;
	if (unchanged && activeHref) {
		action = (
			<Link href={activeHref} className={buttonClass}>
				{t("heroShowForMyCar")}
				{buttonIcon}
			</Link>
		);
	} else if (settled) {
		action = (
			<button type="button" onClick={confirm} disabled={busy} className={buttonClass}>
				{t("vehicleShowCompatible")}
				{buttonIcon}
			</button>
		);
	} else {
		// The sheet asks whatever is left, starting after the answers given here — or from the
		// make when none is.
		action = (
			<VehicleSelectorSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				initialDraft={
					makeId
						? {
								makeId,
								makeName,
								...(modelId ? { modelId, modelName } : {}),
								...(modelId && yearNumber !== undefined ? { year: yearNumber } : {}),
							}
						: {}
				}
			>
				<SheetTrigger asChild>
					<button type="button" disabled={busy} aria-haspopup="dialog" className={buttonClass}>
						{t("vehicleShowCompatible")}
						{buttonIcon}
					</button>
				</SheetTrigger>
			</VehicleSelectorSheet>
		);
	}

	return (
		<div className={className}>
			<div
				className={cn(
					"grid gap-3",
					bar
						? "sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,11rem))_auto] lg:items-end"
						: "sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,13rem))_auto] lg:items-end lg:gap-4",
				)}
			>
				{select(
					"make",
					t("vehicleMake"),
					makeId,
					pickMake,
					t("vehiclePickMake"),
					makes.map((m) => ({ value: m.id, label: m.name })),
				)}
				{select(
					"model",
					t("vehicleModel"),
					modelId,
					pickModel,
					t("vehiclePickModel"),
					makeId && models ? models.map((m) => ({ value: m.id, label: m.name })) : null,
				)}
				{select(
					"year",
					t("vehicleYear"),
					year,
					pickYear,
					t("vehiclePickYear"),
					modelId && years ? years.map((y) => ({ value: String(y), label: String(y) })) : null,
				)}
				<div className="sm:col-span-3 lg:col-span-1">{action}</div>
			</div>
			<p className="sr-only" aria-live="polite">
				{loading ? tFitment("selector.loading") : ""}
			</p>
			{error && (
				<p role="alert" className="text-status-danger mt-3 text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
