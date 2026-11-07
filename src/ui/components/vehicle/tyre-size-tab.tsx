"use client";

/**
 * The second tab of the vehicle selector: the size of the shopper's tyres.
 *
 * Snow chains and snow socks are chosen by tyre size, not by car, and the shop has no tyre sizes for cars. So the
 * size is asked for the way the car is: once, in this window, and remembered (`lib/tyre-size/memory`), and every page
 * then answers from it: the listing narrows to what fits, the product page says whether it fits.
 *
 * One way in and one alternative. The way in is the order a tyre is read: width, profile, rim, three fields, each
 * offering only what the list holds after the one before. The alternative is typing the whole size (or pasting what
 * is written on the sidewall), which the server matches to the list's own spelling and, for a well-formed size the list
 * does not hold, remembers anyway and says the shop cannot verify. A size the shop does not SELL for is not a size
 * that does not exist. The list never reaches the browser: every step is a server action (`lib/tyre-size/actions`),
 * like the vehicle steps.
 *
 * Everything interactive here is a `type="button"` or an input without a name. The selector is mounted from the
 * product page, beside the add-to-cart form, and a stray submit there would add the product to the cart.
 */

import { useCallback, useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, CircleHelp, Loader2, TriangleAlert } from "lucide-react";

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
	/** The size the input or the steps name, ready to be used. */
	match: string | null;
	/** `match` is a size the shop's lists hold. False for a well-formed size they do not: remembered, not verified. */
	listed: boolean;
	unknownText: boolean;
	/** A car is in use: the size given now is remembered for it. */
	vehicleInUse: boolean;
	/** How the size is entered: three fields, or typed whole. */
	entry: "steps" | "text";
	loading: boolean;
	saving: boolean;
	error: Errors;
	/** Call when the tab becomes visible: reads the remembered size and the first step. */
	open: () => void;
	setText: (value: string) => void;
	pickWidth: (width: number) => void;
	pickProfile: (profile: number) => void;
	pickRim: (rim: string) => void;
	setEntry: (entry: "steps" | "text") => void;
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
	const [listed, setListed] = useState(false);
	const [unknownText, setUnknownText] = useState(false);
	const [vehicleInUse, setVehicleInUse] = useState(false);
	const [entry, setEntryState] = useState<"steps" | "text">("steps");
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
			setVehicleInUse(result.vehicleInUse);
			setTextState(result.current ?? "");
			setMatch(result.current);
			setListed(result.current !== null);
			// Someone who gave a size sees it as they gave it; someone who did not is offered the three fields.
			setEntryState(result.current ? "text" : "steps");
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
			setListed(false);
			setUnknownText(false);
			setError(null);
			if (pause.current) clearTimeout(pause.current);
			if (value.trim() === "") return;
			pause.current = setTimeout(() => {
				ask({ text: value }, (result) => {
					setMatch(result.match);
					setListed(result.listed);
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
			setListed(false);
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
			setListed(false);
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
				setListed(result.listed);
				// The input shows the size the steps came to, spelled as the list spells it.
				if (result.match) setTextState(result.match);
			});
		},
		[ask, profile, width],
	);

	const setEntry = useCallback((next: "steps" | "text") => {
		setEntryState(next);
		setError(null);
	}, []);

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
		listed,
		unknownText,
		vehicleInUse,
		entry,
		loading,
		saving,
		error,
		open,
		setText,
		pickWidth,
		pickProfile,
		pickRim,
		setEntry,
		save,
		forget,
	};
}

const selectClass =
	"bg-surface-card text-text-primary focus:ring-ring border-border-default hover:border-text-tertiary h-12 w-full appearance-none rounded-xs border pr-9 pl-3 text-base font-semibold transition-colors focus:ring-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50";

/** One of the three fields: a native select, so a phone shows its own wheel and a keyboard works without help. */
function SizeSelect({
	id,
	label,
	value,
	disabled,
	placeholder,
	onChange,
	children,
}: {
	id: string;
	label: string;
	value: string;
	disabled: boolean;
	placeholder: string;
	onChange: (value: string) => void;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0">
			<label htmlFor={id} className="text-text-secondary mb-1.5 block text-xs font-semibold">
				{label}
			</label>
			<div className="relative">
				<select
					id={id}
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
					className={selectClass}
				>
					<option value="" disabled>
						{placeholder}
					</option>
					{children}
				</select>
				<ChevronDown
					className="text-text-tertiary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
					aria-hidden="true"
				/>
			</div>
		</div>
	);
}

/** The body of the tab and its footer, filling the sheet below the tab bar. */
export function TyreSizeTab({ selector }: { selector: TyreSelector }) {
	const t = useTranslations("tyreSize");
	const ids = useId();
	const s = selector;

	const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		// Not a form: this sheet is mounted beside the add-to-cart form, and Enter must only ever mean "use this size".
		event.preventDefault();
		if (s.match && !s.saving) s.save();
	};

	const typing = s.entry === "text";

	return (
		<>
			<div className="flex-1 overflow-y-auto px-4 py-4">
				<div className="space-y-4">
					<div>
						<h3 className="text-text-primary text-lg font-bold">{t("tabHeading")}</h3>
						<p className="text-text-secondary mt-1 text-sm">{t("tabLead")}</p>
					</div>

					{typing ? (
						<div>
							<label
								htmlFor={`${ids}-text`}
								className="text-text-secondary mb-1.5 block text-xs font-semibold"
							>
								{t("inputLabel")}
							</label>
							<div className="relative">
								<input
									id={`${ids}-text`}
									type="text"
									inputMode="text"
									autoComplete="off"
									autoCapitalize="characters"
									spellCheck={false}
									value={s.text}
									placeholder={t("inputPlaceholder")}
									aria-invalid={s.unknownText || undefined}
									aria-describedby={`${ids}-result`}
									onChange={(event) => s.setText(event.target.value)}
									onKeyDown={onEnter}
									className={cn(
										"bg-surface-card text-text-primary placeholder:text-text-tertiary focus:ring-ring h-12 w-full rounded-xs border pr-11 pl-3.5 text-base font-semibold transition-colors focus:ring-2 focus:outline-hidden",
										s.match && s.listed
											? "border-fitment-fits"
											: s.unknownText || s.match
												? "border-fitment-unconfirmed"
												: "border-border-default hover:border-text-tertiary",
									)}
								/>
								<span className="absolute top-1/2 right-3.5 flex -translate-y-1/2" aria-hidden="true">
									{s.loading ? (
										<Loader2 className="text-text-tertiary h-5 w-5 animate-spin" />
									) : s.match && s.listed ? (
										<Check className="text-fitment-fits h-5 w-5" strokeWidth={2.5} />
									) : null}
								</span>
							</div>
							<p className="text-text-tertiary mt-2 text-[0.8125rem]">{t("otherFormats")}</p>
						</div>
					) : (
						<div className="grid grid-cols-3 gap-2.5" role="group" aria-label={t("tabHeading")}>
							<SizeSelect
								id={`${ids}-width`}
								label={t("selectWidth")}
								value={s.width === undefined ? "" : String(s.width)}
								disabled={false}
								placeholder="—"
								onChange={(value) => s.pickWidth(Number(value))}
							>
								{(s.steps?.widths ?? []).map(({ value }) => (
									<option key={value} value={value}>
										{value}
									</option>
								))}
							</SizeSelect>
							<SizeSelect
								id={`${ids}-profile`}
								label={t("selectProfile")}
								value={s.profile === undefined ? "" : String(s.profile)}
								disabled={s.width === undefined}
								placeholder="—"
								onChange={(value) => s.pickProfile(Number(value))}
							>
								{(s.steps?.profiles ?? []).map((value) => (
									<option key={value} value={value}>
										{value}
									</option>
								))}
							</SizeSelect>
							<SizeSelect
								id={`${ids}-rim`}
								label={t("selectRim")}
								value={s.rim ?? ""}
								disabled={s.width === undefined || s.profile === undefined}
								placeholder="—"
								onChange={s.pickRim}
							>
								{(s.steps?.rims ?? []).map((value) => (
									<option key={value} value={value}>
										R{value}
									</option>
								))}
							</SizeSelect>
						</div>
					)}

					<div id={`${ids}-result`} aria-live="polite">
						{s.match && s.listed ? (
							<p className={cn("flex items-start gap-2.5 rounded-sm px-3 py-2.5 text-sm", TONE_CLASSES.fits)}>
								<Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
								<span className="font-semibold">{t("matchListed", { size: s.match })}</span>
							</p>
						) : s.match ? (
							<p
								className={cn(
									"flex items-start gap-2.5 rounded-sm px-3 py-2.5 text-sm",
									TONE_CLASSES.unconfirmed,
								)}
							>
								<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
								<span>
									<span className="block font-semibold">{t("matchUnlisted", { size: s.match })}</span>
									<span className="mt-0.5 block opacity-90">{t("matchUnlistedHint")}</span>
								</span>
							</p>
						) : s.unknownText ? (
							<p
								className={cn(
									"flex items-start gap-2.5 rounded-sm px-3 py-2.5 text-sm",
									TONE_CLASSES.unconfirmed,
								)}
							>
								<CircleHelp className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
								<span>
									<span className="block font-semibold">{t("unknownTitle")}</span>
									<span className="mt-0.5 block opacity-90">{t("unknownHint")}</span>
								</span>
							</p>
						) : null}
					</div>

					<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<button
							type="button"
							onClick={() => s.setEntry(typing ? "steps" : "text")}
							className="text-text-secondary hover:text-text-primary focus-visible:ring-ring text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
						>
							{typing ? t("enterBySteps") : t("enterFull")}
						</button>
					</div>

					{/* How a tyre's size is read, for the shopper who has the tyre in front of them: collapsed, because most do not need it. */}
					<details className="border-border-default group rounded-sm border">
						<summary className="text-text-primary focus-visible:ring-ring cursor-pointer list-none px-3.5 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-hidden">
							{t("howTitle")}
						</summary>
						<div className="px-3.5 pb-3.5">
							<div
								role="img"
								aria-label={t("readLabel")}
								className="bg-surface-inverse text-text-inverse grid grid-cols-3 rounded-sm py-3"
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
										<p className="text-xl leading-tight font-bold tracking-wide">{value}</p>
										<p className="mt-1 text-xs opacity-80">{caption}</p>
									</div>
								))}
							</div>
							<p className="text-text-secondary mt-2.5 text-[0.8125rem]">{t("howBody")}</p>
						</div>
					</details>

					{s.vehicleInUse ? (
						<p className="text-text-tertiary text-[0.8125rem]">{t("tabVehicleNote")}</p>
					) : null}

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
