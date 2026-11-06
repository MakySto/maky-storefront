"use client";

/**
 * The second tab of the vehicle selector: the size of the shopper's tyres.
 *
 * Snow chains and snow socks are chosen by tyre size, not by car, and the shop has no tyre sizes for cars. So the
 * size is asked for the way the car is: once, in this window, and remembered (`lib/tyre-size/memory`), and every page
 * then answers from it: the listing narrows to what fits, the product page says whether it fits.
 *
 * Two ways in, because customers arrive with two kinds of knowledge. Someone who can read their tyre types the size,
 * or pastes what is written on the sidewall, and the server matches it to the list's own spelling. Someone who
 * cannot picks it in three steps (width, profile, rim) and is only ever offered combinations the list holds. The
 * list never reaches the browser: every step is a server action (`lib/tyre-size/actions`), like the vehicle steps.
 *
 * Everything interactive here is a `type="button"` or an input without a name. The selector is mounted from the
 * product page, beside the add-to-cart form, and a stray submit there would add the product to the cart.
 */

import { useCallback, useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleHelp, Loader2 } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { forgetTyreSize, loadTyreStep, rememberTyreSize, type TyreStepResult } from "@/lib/tyre-size/actions";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";

/** How long the input waits after the last key before it asks the server whether the list holds that size. */
const TYPING_PAUSE_MS = 300;

type Errors = "save" | "forget" | null;

export interface TyreSelector {
	steps: TyreStepResult["steps"] | null;
	/** The size already remembered, as the list spells it. */
	current: string | null;
	text: string;
	width: number | undefined;
	profile: number | undefined;
	rim: string | undefined;
	/** The list's size the input or the steps name, ready to be used. */
	match: string | null;
	unknownText: boolean;
	allWidths: boolean;
	loading: boolean;
	saving: boolean;
	error: Errors;
	/** Call when the tab becomes visible: reads the remembered size and the first step. */
	open: () => void;
	setText: (value: string) => void;
	pickWidth: (width: number) => void;
	pickProfile: (profile: number) => void;
	pickRim: (rim: string) => void;
	toggleAllWidths: () => void;
	save: () => void;
	forget: () => void;
}

/**
 * The tab's state and its calls to the server. A hook of the sheet rather than of the tab, because the sheet starts
 * the first load from the click that opens the tab: a fetch is a reaction to an event, not an effect.
 */
export function useTyreSelector({ onDone }: { onDone: (size: string | null) => void }): TyreSelector {
	const [steps, setSteps] = useState<TyreStepResult["steps"] | null>(null);
	const [current, setCurrent] = useState<string | null>(null);
	const [text, setTextState] = useState("");
	const [width, setWidth] = useState<number | undefined>();
	const [profile, setProfile] = useState<number | undefined>();
	const [rim, setRim] = useState<string | undefined>();
	const [match, setMatch] = useState<string | null>(null);
	const [unknownText, setUnknownText] = useState(false);
	const [allWidths, setAllWidths] = useState(false);
	const [error, setError] = useState<Errors>(null);
	const [loading, startLoading] = useTransition();
	const [saving, startSaving] = useTransition();

	// Answers can arrive out of order (a slow one for "205/5" after the one for "205/55 R16"): only the newest counts.
	const latest = useRef(0);
	const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (pause.current) clearTimeout(pause.current);
		},
		[],
	);

	const ask = useCallback(
		(input: Parameters<typeof loadTyreStep>[0], then: (result: TyreStepResult) => void) => {
			const request = ++latest.current;
			startLoading(async () => {
				const result = await loadTyreStep(input);
				if (request !== latest.current) return;
				then(result);
			});
		},
		[],
	);

	const open = useCallback(() => {
		setError(null);
		ask({}, (result) => {
			setSteps(result.steps);
			setCurrent(result.current);
			setTextState(result.current ?? "");
			setMatch(result.current);
			setUnknownText(false);
			setWidth(undefined);
			setProfile(undefined);
			setRim(undefined);
		});
	}, [ask]);

	const setText = useCallback(
		(value: string) => {
			setTextState(value);
			setWidth(undefined);
			setProfile(undefined);
			setRim(undefined);
			setMatch(null);
			setUnknownText(false);
			setError(null);
			if (pause.current) clearTimeout(pause.current);
			if (value.trim() === "") return;
			pause.current = setTimeout(() => {
				ask({ text: value }, (result) => {
					setMatch(result.match);
					setUnknownText(result.unknownText);
				});
			}, TYPING_PAUSE_MS);
		},
		[ask],
	);

	const pickWidth = useCallback(
		(value: number) => {
			if (pause.current) clearTimeout(pause.current);
			setTextState("");
			setMatch(null);
			setUnknownText(false);
			setWidth(value);
			setProfile(undefined);
			setRim(undefined);
			ask({ width: value }, (result) => setSteps(result.steps));
		},
		[ask],
	);

	const pickProfile = useCallback(
		(value: number) => {
			if (width === undefined) return;
			setProfile(value);
			setRim(undefined);
			setMatch(null);
			ask({ width, profile: value }, (result) => setSteps(result.steps));
		},
		[ask, width],
	);

	const pickRim = useCallback(
		(value: string) => {
			if (width === undefined || profile === undefined) return;
			setRim(value);
			ask({ width, profile, rim: value }, (result) => {
				setSteps(result.steps);
				setMatch(result.match);
				// The input shows the size the steps came to, spelled as the list spells it.
				if (result.match) setTextState(result.match);
			});
		},
		[ask, profile, width],
	);

	const toggleAllWidths = useCallback(() => setAllWidths((all) => !all), []);

	const save = useCallback(() => {
		if (!match) return;
		setError(null);
		startSaving(async () => {
			const result = await rememberTyreSize(match);
			if (result.ok) onDone(result.size);
			else setError("save");
		});
	}, [match, onDone]);

	const forget = useCallback(() => {
		setError(null);
		startSaving(async () => {
			const result = await forgetTyreSize();
			if (result.ok) onDone(null);
			else setError("forget");
		});
	}, [onDone]);

	return {
		steps,
		current,
		text,
		width,
		profile,
		rim,
		match,
		unknownText,
		allWidths,
		loading,
		saving,
		error,
		open,
		setText,
		pickWidth,
		pickProfile,
		pickRim,
		toggleAllWidths,
		save,
		forget,
	};
}

const chip =
	"border-border-default text-text-primary hover:bg-surface-muted focus-visible:ring-ring inline-flex h-11 min-w-[3.375rem] items-center justify-center rounded-md border px-3 text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden";
const chipSelected = "border-action-primary bg-surface-muted font-semibold";

/** The body of the tab and its footer, filling the sheet below the tab bar. */
export function TyreSizeTab({ selector }: { selector: TyreSelector }) {
	const t = useTranslations("tyreSize");
	const inputId = useId();
	const s = selector;

	const widths = s.steps?.widths ?? [];
	// The usual widths up front; the one the shopper chose stays visible whatever "more" says.
	const shownWidths = s.allWidths ? widths : widths.filter((w) => w.common || w.value === s.width);
	const hasMoreWidths = widths.length > shownWidths.length || s.allWidths;

	const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		// Not a form: this sheet is mounted beside the add-to-cart form, and Enter must only ever mean "use this size".
		event.preventDefault();
		if (s.match && !s.saving) s.save();
	};

	return (
		<>
			<div className="flex-1 overflow-y-auto px-4 py-4">
				<div className="space-y-5">
					<div>
						<h3 className="text-text-primary text-lg font-bold">{t("tabHeading")}</h3>
						<p className="text-text-secondary mt-1 text-sm">{t("tabLead")}</p>
					</div>

					{/* How a tyre's size is read: the three numbers, named. For the shopper who has the tyre in front of them. */}
					<div
						role="img"
						aria-label={t("readLabel")}
						className="bg-surface-inverse text-text-inverse grid grid-cols-3 rounded-sm py-3.5"
					>
						{(
							[
								["205", t("readWidth")],
								["55", t("readProfile")],
								["R16", t("readRim")],
							] as const
						).map(([value, caption], position) => (
							<div
								key={caption}
								className={cn("px-2 text-center", position === 1 && "border-x border-current/25")}
							>
								<p className="text-2xl leading-tight font-bold tracking-wide">{value}</p>
								<p className="mt-1 text-xs opacity-80">{caption}</p>
							</div>
						))}
					</div>

					<div>
						<label
							htmlFor={inputId}
							className="text-text-primary mb-1.5 block text-[0.8125rem] font-semibold"
						>
							{t("inputLabel")}
						</label>
						<div className="relative">
							<input
								id={inputId}
								type="text"
								inputMode="text"
								autoComplete="off"
								autoCapitalize="characters"
								spellCheck={false}
								value={s.text}
								placeholder={t("inputPlaceholder")}
								aria-invalid={s.unknownText || undefined}
								aria-describedby={`${inputId}-result`}
								onChange={(event) => s.setText(event.target.value)}
								onKeyDown={onEnter}
								className={cn(
									"bg-surface-card text-text-primary placeholder:text-text-tertiary focus:ring-ring h-12 w-full rounded-xs border pr-11 pl-3.5 text-base font-semibold transition-colors focus:ring-2 focus:outline-hidden",
									s.match
										? "border-fitment-fits"
										: s.unknownText
											? "border-fitment-unconfirmed"
											: "border-border-default hover:border-text-tertiary",
								)}
							/>
							<span className="absolute top-1/2 right-3.5 flex -translate-y-1/2" aria-hidden="true">
								{s.loading ? (
									<Loader2 className="text-text-tertiary h-5 w-5 animate-spin" />
								) : s.match ? (
									<Check className="text-fitment-fits h-5 w-5" strokeWidth={2.5} />
								) : null}
							</span>
						</div>

						<div id={`${inputId}-result`} aria-live="polite">
							{s.match ? (
								<p
									className={cn(
										"mt-2 flex items-start gap-3 rounded-sm border border-current/15 px-3.5 py-3",
										TONE_CLASSES.fits,
									)}
								>
									<Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
									<span className="text-sm">
										<span className="block font-bold">{t("matchFound", { size: s.match })}</span>
										<span className="mt-0.5 block opacity-90">{t("matchHint")}</span>
									</span>
								</p>
							) : s.unknownText ? (
								<p
									className={cn(
										"mt-2 flex items-start gap-3 rounded-sm border border-current/15 px-3.5 py-3",
										TONE_CLASSES.unconfirmed,
									)}
								>
									<CircleHelp className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
									<span className="text-sm">
										<span className="block font-bold">{t("unknownTitle")}</span>
										<span className="mt-0.5 block opacity-90">{t("unknownHint")}</span>
									</span>
								</p>
							) : null}
						</div>
					</div>

					<p className="text-text-tertiary flex items-center gap-3 text-xs font-semibold tracking-wider uppercase">
						<span className="bg-border-default h-px flex-1" aria-hidden="true" />
						{t("orSteps")}
						<span className="bg-border-default h-px flex-1" aria-hidden="true" />
					</p>

					<fieldset>
						<div className="mb-2 flex items-baseline justify-between">
							<legend className="text-text-primary text-sm font-bold">{t("stepWidth")}</legend>
							{s.width !== undefined && <span className="text-sm font-bold">{s.width}</span>}
						</div>
						<div className="flex flex-wrap gap-2">
							{shownWidths.map(({ value }) => (
								<button
									key={value}
									type="button"
									aria-pressed={s.width === value}
									onClick={() => s.pickWidth(value)}
									className={cn(chip, s.width === value && chipSelected)}
								>
									{value}
								</button>
							))}
							{(hasMoreWidths || widths.length > shownWidths.length) && (
								<button
									type="button"
									aria-expanded={s.allWidths}
									onClick={s.toggleAllWidths}
									className={cn(chip, "text-text-secondary border-dashed")}
								>
									{s.allWidths ? t("fewerWidths") : t("moreWidths")}
								</button>
							)}
						</div>
					</fieldset>

					{s.width !== undefined && (
						<fieldset>
							<div className="mb-2 flex items-baseline justify-between">
								<legend className="text-text-primary text-sm font-bold">{t("stepProfile")}</legend>
								{s.profile !== undefined && <span className="text-sm font-bold">{s.profile}</span>}
							</div>
							<div className="flex flex-wrap gap-2">
								{(s.steps?.profiles ?? []).map((value) => (
									<button
										key={value}
										type="button"
										aria-pressed={s.profile === value}
										onClick={() => s.pickProfile(value)}
										className={cn(chip, s.profile === value && chipSelected)}
									>
										{value}
									</button>
								))}
							</div>
						</fieldset>
					)}

					{s.width !== undefined && s.profile !== undefined && (
						<fieldset>
							<div className="mb-2 flex items-baseline justify-between">
								<legend className="text-text-primary text-sm font-bold">{t("stepRim")}</legend>
								{s.rim !== undefined && <span className="text-sm font-bold">R{s.rim}</span>}
							</div>
							<div className="flex flex-wrap gap-2">
								{(s.steps?.rims ?? []).map((value) => (
									<button
										key={value}
										type="button"
										aria-pressed={s.rim === value}
										onClick={() => s.pickRim(value)}
										className={cn(chip, s.rim === value && chipSelected)}
									>
										R{value}
									</button>
								))}
							</div>
						</fieldset>
					)}

					<p className="text-text-tertiary text-[0.8125rem]">{t("otherFormats")}</p>

					{s.error && (
						<p
							role="alert"
							className="bg-status-danger-bg text-status-danger border-status-danger-border rounded-md border px-3 py-2 text-sm"
						>
							{s.error === "save" ? t("errorSave") : t("errorForget")}
						</p>
					)}
				</div>
			</div>

			<div className="border-border-default border-t px-4 py-4">
				<Button
					type="button"
					onClick={s.save}
					disabled={!s.match || s.saving}
					className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover w-full"
				>
					{s.saving ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					) : (
						<Check className="h-4 w-4" aria-hidden="true" />
					)}
					{s.match ? t("useSize", { size: s.match }) : t("useSizeEmpty")}
				</Button>
				{s.current && (
					<button
						type="button"
						onClick={s.forget}
						disabled={s.saving}
						className="text-text-secondary hover:text-text-primary mt-3 block w-full text-center text-sm underline underline-offset-4 disabled:opacity-60"
					>
						{t("forget", { size: s.current })}
					</button>
				)}
			</div>
		</>
	);
}
