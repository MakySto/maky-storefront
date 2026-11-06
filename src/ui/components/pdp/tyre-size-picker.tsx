"use client";

import {
	createContext,
	useCallback,
	useContext,
	useId,
	useMemo,
	useReducer,
	useRef,
	type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDownIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import { TYRE_LIST_SEPARATOR } from "@/lib/tyre-size/line-metadata";
import {
	initialPickerState,
	reducePicker,
	viewPicker,
	type PickerAction,
	type PickerState,
} from "@/lib/tyre-size/picker-state";
import type { TyrePickerData } from "@/lib/tyre-size/types";
import { Checkbox } from "@/ui/components/ui/checkbox";

/**
 * What the buy buttons need to know about the tyre choice: whether it is complete, and how to take the customer to
 * it. `null` outside a `<TyreSizeGate>`, which is every product that is not a snow chain or sock.
 */
interface TyreSizeGateValue {
	complete: boolean;
	focusPicker: () => void;
}

const GateContext = createContext<TyreSizeGateValue | null>(null);

export function useTyreSizeGate(): TyreSizeGateValue | null {
	return useContext(GateContext);
}

const fieldClass =
	"border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus:border-cta focus:ring-cta h-12 w-full appearance-none rounded-xs border pr-10 pl-3.5 text-sm transition-colors focus:ring-1 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The tyre-size choice of a snow chain or sock, and the gate it puts on the buy buttons.
 *
 * One product on this shop is one manufacturer's code, and one code fits dozens to hundreds of tyre sizes, so the
 * size is not a variant: it is chosen here, travels in three hidden fields of the surrounding form, and is checked
 * again on the server against the same list before anything reaches the cart (`lib/tyre-size`). Nothing is chosen
 * for the customer, and the buy button reads "choose a tyre size" and takes them back here until the choice is
 * complete.
 *
 * Everything the picker does is `lib/tyre-size/picker-state`, which a test drives against the server's own check;
 * this component only draws it.
 */
export function TyreSizeGate({ data, children }: { data: TyrePickerData; children: ReactNode }) {
	const [state, dispatch] = useReducer(
		(current: PickerState, action: PickerAction) => reducePicker(data, current, action),
		data,
		initialPickerState,
	);
	const view = viewPicker(data, state);

	const fieldsetRef = useRef<HTMLFieldSetElement>(null);
	const rimRef = useRef<HTMLSelectElement>(null);
	const sizeRef = useRef<HTMLSelectElement>(null);

	const mode = state.mode;
	const rim = state.rim;
	const focusPicker = useCallback(() => {
		const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		fieldsetRef.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
		const target = mode === "code" ? null : rim === "" && rimRef.current ? rimRef.current : sizeRef.current;
		(target ?? fieldsetRef.current?.querySelector<HTMLElement>("input:not([type=hidden]), select"))?.focus({
			preventScroll: true,
		});
	}, [mode, rim]);

	const gate = useMemo(() => ({ complete: view.complete, focusPicker }), [view.complete, focusPicker]);

	return (
		<GateContext.Provider value={gate}>
			<TyreSizePicker
				data={data}
				state={state}
				view={view}
				dispatch={dispatch}
				fieldsetRef={fieldsetRef}
				rimRef={rimRef}
				sizeRef={sizeRef}
			/>
			{children}
		</GateContext.Provider>
	);
}

function TyreSizePicker({
	data,
	state,
	view,
	dispatch,
	fieldsetRef,
	rimRef,
	sizeRef,
}: {
	data: TyrePickerData;
	state: PickerState;
	view: ReturnType<typeof viewPicker>;
	dispatch: (action: PickerAction) => void;
	fieldsetRef: React.RefObject<HTMLFieldSetElement | null>;
	rimRef: React.RefObject<HTMLSelectElement | null>;
	sizeRef: React.RefObject<HTMLSelectElement | null>;
}) {
	const t = useTranslations("tyreSize");
	const id = useId();
	const rimId = `${id}-rim`;
	const sizeId = `${id}-size`;
	const conditionId = `${id}-condition`;
	const confirmId = `${id}-confirm`;
	const knowsId = `${id}-knows`;

	const knowsCode = state.mode === "code";
	// While the customer says they know the code, the selects show their placeholders, not the size picked
	// before: that size is not sent (the form carries mode=code and no size), so it must not look chosen. The choice
	// itself is kept in `state`, so withdrawing the statement brings it back.
	const rimShown = knowsCode ? "" : state.rim;
	const sizeShown = knowsCode ? "" : state.size;
	const showRim = data.rims.length > 1;
	const { condition } = view;
	const tyres = condition ? condition.tyres.join(TYRE_LIST_SEPARATOR) : "";

	return (
		<fieldset
			ref={fieldsetRef}
			className="border-border-default bg-surface-card scroll-mt-24 space-y-4 rounded-xs border px-4 pt-1 pb-4 sm:px-5 sm:pt-2 sm:pb-5"
			data-testid="tyre-size-picker"
		>
			<legend className="text-text-primary px-1 text-base font-semibold">{t("heading")}</legend>
			<p className="text-text-secondary text-sm">{t("intro")}</p>

			{/* What the form carries. The selects below have no name on purpose: these three are the whole choice. */}
			<input type="hidden" name={TYRE_FIELDS.mode} value={view.fields[TYRE_FIELDS.mode]} />
			<input type="hidden" name={TYRE_FIELDS.size} value={view.fields[TYRE_FIELDS.size]} />
			<input type="hidden" name={TYRE_FIELDS.condition} value={view.fields[TYRE_FIELDS.condition]} />

			<div className={cn("grid gap-3", showRim && "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
				{showRim ? (
					<div>
						<label htmlFor={rimId} className="text-text-primary mb-1.5 block text-[0.8125rem] font-semibold">
							{t("rim")}
						</label>
						<span className="relative block">
							<select
								id={rimId}
								ref={rimRef}
								value={rimShown}
								disabled={knowsCode}
								onChange={(event) => dispatch({ type: "rim", rim: event.target.value })}
								className={cn(fieldClass, !rimShown && "text-text-tertiary")}
							>
								<option value="">{t("rimPlaceholder")}</option>
								{data.rims.map((group) => (
									<option key={group.rim} value={group.rim} className="text-text-primary">
										R{group.rim}
									</option>
								))}
							</select>
							<ChevronsUpDownIcon
								className="text-text-tertiary pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2"
								aria-hidden="true"
							/>
						</span>
					</div>
				) : null}

				<div>
					<label htmlFor={sizeId} className="text-text-primary mb-1.5 block text-[0.8125rem] font-semibold">
						{t("size")}
					</label>
					<span className="relative block">
						<select
							id={sizeId}
							ref={sizeRef}
							value={sizeShown}
							disabled={knowsCode || state.rim === ""}
							aria-describedby={condition ? conditionId : undefined}
							onChange={(event) => dispatch({ type: "size", size: event.target.value })}
							className={cn(fieldClass, !sizeShown && "text-text-tertiary")}
						>
							<option value="">{rimShown === "" ? t("sizePlaceholderFirst") : t("sizePlaceholder")}</option>
							{view.sizeOptions.map((size) => (
								<option key={size.label} value={size.label} className="text-text-primary">
									{size.label}
								</option>
							))}
						</select>
						<ChevronsUpDownIcon
							className="text-text-tertiary pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2"
							aria-hidden="true"
						/>
					</span>
				</div>
			</div>

			{condition ? (
				<div
					id={conditionId}
					className="bg-status-warning-bg border-status-warning-border text-status-warning space-y-3 rounded-xs border px-3.5 py-3 text-sm"
				>
					<p className="flex items-start gap-2 font-medium">
						<TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
						<span>
							{t(condition.mode === "only" ? "conditionOnly" : "conditionNot", {
								size: view.fields[TYRE_FIELDS.size],
								tyres,
							})}
						</span>
					</p>
					<div className="flex items-start gap-2.5">
						<Checkbox
							id={confirmId}
							checked={state.acknowledged}
							onCheckedChange={(acknowledged) => dispatch({ type: "acknowledge", acknowledged })}
							className="mt-0.5"
						/>
						<label htmlFor={confirmId} className="cursor-pointer leading-snug">
							{t(condition.mode === "only" ? "confirmOnly" : "confirmNot", { tyres })}
						</label>
					</div>
				</div>
			) : null}

			{!knowsCode ? <p className="text-text-tertiary text-[0.8125rem]">{t("notListed")}</p> : null}

			<div className="space-y-2">
				<div className="flex items-start gap-2.5">
					<Checkbox
						id={knowsId}
						checked={knowsCode}
						onCheckedChange={(knows) => dispatch({ type: "knows-code", knowsCode: knows })}
						className="mt-0.5"
					/>
					<label htmlFor={knowsId} className="text-text-secondary cursor-pointer text-sm leading-snug">
						{t("knowsCode")}
					</label>
				</div>
				{knowsCode ? (
					<p className="text-text-secondary pl-[1.875rem] text-[0.8125rem]">{t("knowsCodeNote")}</p>
				) : null}
			</div>

			{data.fromManufacturerList ? (
				<p className="text-text-tertiary text-xs">{t("sourceManufacturer")}</p>
			) : (
				<p className="text-status-warning flex items-start gap-1.5 text-xs">
					<TriangleAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					<span>{t("sourceSupplier")}</span>
				</p>
			)}
		</fieldset>
	);
}
