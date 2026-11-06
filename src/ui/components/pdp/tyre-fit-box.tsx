"use client";

import {
	createContext,
	useCallback,
	useContext,
	useId,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckIcon, CircleHelpIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import { tyreFitState, type TyreFitView, type TyreGateReason } from "@/lib/tyre-size/fit-state";
import { TYRE_LIST_SEPARATOR } from "@/lib/tyre-size/line-metadata";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { SheetTrigger } from "@/ui/components/ui/sheet";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";
import { VehicleSelectorSheet } from "@/ui/components/vehicle/vehicle-selector-sheet";

/**
 * What the buy buttons need to know about the tyre choice: whether it is complete, why not, and how to take the
 * shopper to what is missing. `null` outside a `<TyreSizeGate>`, which is every product that is not a snow chain or
 * sock.
 */
interface TyreSizeGateValue {
	complete: boolean;
	reason: TyreGateReason | null;
	/**
	 * Opens the window that asks for the size, or goes to the condition that has to be ticked. A buy button passes
	 * itself, so that closing the window gives the focus back to it.
	 */
	take: (opener?: HTMLElement | null) => void;
}

const GateContext = createContext<TyreSizeGateValue | null>(null);

export function useTyreSizeGate(): TyreSizeGateValue | null {
	return useContext(GateContext);
}

/** The text of a buy button that holds back, by reason: keys of the `tyreSize` namespace. */
export const GATE_BUTTON_KEY: Record<TyreGateReason, "selectSize" | "buttonNoFit" | "buttonConfirm"> = {
	choose: "selectSize",
	"no-fit": "buttonNoFit",
	confirm: "buttonConfirm",
};

/** The key of the text a held-back buy button shows. A gate that is not complete always has a reason; "choose" is the safe word. */
export const gateButtonKey = (gate: Pick<TyreSizeGateValue, "reason">) =>
	GATE_BUTTON_KEY[gate.reason ?? "choose"];

/**
 * How a held-back buy button looks.
 *
 * What it says is longer than "Pridať do košíka" ("Nesedí na váš rozmer", "Potvrďte podmienku") and on a 360 px
 * phone the button beside the quantity stepper has about 110 px of text, so these labels wrap onto a second line
 * instead of being cut off (a truncated call to action is worse than a tall one).
 *
 * A missing size and an unconfirmed condition are steps TOWARD buying, so the button keeps the purchase colour. A
 * size that does not fit is the one state in which this product cannot be bought for what the shopper told us, and a
 * full green button reading "Nesedí" would be an invitation to press it: it becomes a quiet, bordered button and says
 * "unavailable" to assistive technology. It stays pressable on purpose, because pressing it still takes the shopper
 * to the size, which is the way out (the sticky bar on a phone has no other: the box has scrolled away by then).
 */
export function gateButtonLook(gate: Pick<TyreSizeGateValue, "reason"> | null): {
	variant: "default" | "secondary";
	className: string | undefined;
	"aria-disabled": true | undefined;
} {
	if (gate === null) return { variant: "default", className: undefined, "aria-disabled": undefined };
	if (gate.reason === "no-fit") {
		return {
			variant: "secondary",
			className:
				"border-border-default text-text-secondary border leading-tight whitespace-normal shadow-none hover:shadow-none",
			"aria-disabled": true,
		};
	}
	return { variant: "default", className: "leading-tight whitespace-normal", "aria-disabled": undefined };
}

/** The label of a held-back button: up to two lines, balanced, where the normal label is one line cut with an ellipsis. */
export const HELD_BACK_LABEL = "line-clamp-2 text-balance";

/** What the verdict is about: a different size, verdict or condition is a different question. */
const viewKey = (view: TyreFitView): string =>
	view.kind === "no-size"
		? "no-size"
		: view.kind === "no-fit"
			? `no-fit|${view.size}`
			: `fits|${view.size}|${view.condition?.key ?? ""}`;

const boxShell = "rounded-sm border px-4 py-3.5";
const iconCircle =
	"bg-surface-card mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-xs";
const linkButton =
	"inline-flex min-h-8 items-center text-sm font-medium underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden";

/**
 * The shopper's tyre size, as a snow chain's or sock's product page meets it, and the gate it puts on the buy buttons.
 *
 * The size is not chosen here. It is given once in the vehicle selector's second tab and remembered
 * (`lib/tyre-size/memory`), and this box only ANSWERS: the product fits that size, fits it under a condition,
 * does not fit it, or no size is known yet and the box offers to ask. One product on this shop is one manufacturer's
 * code and one code fits dozens to hundreds of sizes, so the size is not a variant: it travels in three hidden fields
 * of the surrounding form and is checked again on the server against the same list before anything reaches the cart
 * (`lib/tyre-size`). Nothing is chosen for the shopper, and the buy button reads what is missing and takes them to it
 * until the choice is complete.
 *
 * What the form carries and when it is complete is `lib/tyre-size/fit-state`, which a test drives against the
 * server's own check; this component only draws it.
 */
export function TyreSizeGate({
	view,
	fittingHref,
	children,
}: {
	view: TyreFitView;
	/** Where the shop's other chains for this size are listed, when it can say. Offered only for a size that does not fit. */
	fittingHref?: string | null;
	children: ReactNode;
}) {
	const t = useTranslations("tyreSize");
	const ids = useId();
	const [open, setOpen] = useState(false);
	const [acknowledged, setAcknowledged] = useState(false);
	const [knowsCode, setKnowsCode] = useState(false);

	// What was ticked belongs to the size and condition it was ticked for. When the verdict changes (another size, a
	// size forgotten) it starts over, in the same render: nothing ticked for one condition is carried to another.
	const key = viewKey(view);
	const [seen, setSeen] = useState(key);
	if (seen !== key) {
		setSeen(key);
		setAcknowledged(false);
		setKnowsCode(false);
	}

	const state = tyreFitState(view, { acknowledged, knowsCode });

	const triggerRef = useRef<HTMLButtonElement>(null);
	const confirmRef = useRef<HTMLInputElement>(null);
	// What the window gives the focus back to when it closes. Left to itself Radix returns it to the LAST trigger that
	// mounted in the dialog, which is not the button the shopper pressed whenever the box has two (its own and the
	// "how do I find the size" link) or the buy button opened the window.
	const openerRef = useRef<HTMLElement | null>(null);
	const rememberOpener = (event: MouseEvent<HTMLElement>) => {
		openerRef.current = event.currentTarget;
	};
	const { reason } = state;
	const take = useCallback(
		(opener?: HTMLElement | null) => {
			if (reason === "confirm" && confirmRef.current) {
				const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
				confirmRef.current.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
				confirmRef.current.focus({ preventScroll: true });
				return;
			}
			// The box's own button, clicked: Radix opens the window as if the shopper had. That click records the box's
			// button as the opener, so the buy button that really was pressed is recorded after it.
			triggerRef.current?.click();
			if (opener) openerRef.current = opener;
		},
		[reason],
	);

	const gate = useMemo(() => ({ complete: state.complete, reason, take }), [state.complete, reason, take]);

	const confirmId = `${ids}-confirm`;
	const knowsId = `${ids}-knows`;
	const titleId = `${ids}-title`;

	const trigger = (label: string, className: string) => (
		<SheetTrigger asChild>
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="dialog"
				onClick={rememberOpener}
				className={className}
			>
				{label}
			</button>
		</SheetTrigger>
	);

	const fields = (
		<>
			{/* What the form carries. The checkboxes have no name on purpose: these three are the whole choice. */}
			<input type="hidden" name={TYRE_FIELDS.mode} value={state.fields[TYRE_FIELDS.mode]} />
			<input type="hidden" name={TYRE_FIELDS.size} value={state.fields[TYRE_FIELDS.size]} />
			<input type="hidden" name={TYRE_FIELDS.condition} value={state.fields[TYRE_FIELDS.condition]} />
		</>
	);

	let box: ReactNode;
	if (view.kind === "no-size") {
		box = (
			<section
				aria-labelledby={titleId}
				className={cn(boxShell, "border-border-default bg-surface-card text-text-primary")}
				data-testid="tyre-fit-box"
				data-fit="no-size"
			>
				{fields}
				<div className="flex items-start gap-3">
					<span className={cn(iconCircle, "text-text-secondary border-border-default border")}>
						<CircleHelpIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<h3 id={titleId} className="text-[0.9375rem] leading-snug font-bold">
							{t("fitNoSizeTitle")}
						</h3>
						<p className="text-text-secondary mt-0.5 text-sm">{t("fitNoSizeLead")}</p>
					</div>
				</div>
				{trigger(
					t("fitEnter"),
					"border-border-default text-text-primary hover:bg-surface-muted focus-visible:ring-ring mt-3 inline-flex h-12 w-full items-center justify-center rounded-xs border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
				)}
				<div className="mt-3 flex items-start gap-2.5">
					<Checkbox id={knowsId} checked={knowsCode} onCheckedChange={setKnowsCode} className="mt-0.5" />
					<label htmlFor={knowsId} className="text-text-secondary cursor-pointer text-sm leading-snug">
						{t("knowsCode")}
					</label>
				</div>
				{knowsCode ? (
					<p className="text-text-secondary mt-2 pl-[1.875rem] text-[0.8125rem]">{t("knowsCodeNote")}</p>
				) : null}
			</section>
		);
	} else if (view.kind === "no-fit") {
		box = (
			<section
				aria-labelledby={titleId}
				className={cn(boxShell, "border-current/15", TONE_CLASSES["no-fit"])}
				data-testid="tyre-fit-box"
				data-fit="no-fit"
			>
				{fields}
				<div className="flex items-start gap-3">
					<span className={iconCircle}>
						<XIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
							<div className="min-w-0 flex-1 basis-56">
								<h3 id={titleId} className="text-[0.9375rem] leading-snug font-bold">
									{t("fitNoFitTitle", { size: view.size })}
								</h3>
								<p className="mt-0.5 text-sm opacity-90">{t("fitNoFitLead")}</p>
							</div>
							<div className="shrink-0">{trigger(t("fitChange"), linkButton)}</div>
						</div>
						{fittingHref ? (
							<p className="mt-2">
								<Link href={fittingHref} className={linkButton}>
									{t("fitShowFitting")}
								</Link>
							</p>
						) : null}
					</div>
				</div>
			</section>
		);
	} else {
		const { condition } = view;
		const tyres = condition ? condition.tyres.join(TYRE_LIST_SEPARATOR) : "";
		// The manufacturer's own list is a verified fit. The supplier's data from the previous shop's cards is what we
		// were told, not what the maker published: it is said so, in the colour of "not confirmed".
		const confirmed = view.fromManufacturerList && !condition;
		box = (
			<section
				aria-labelledby={titleId}
				className={cn(
					boxShell,
					"border-current/15",
					confirmed ? TONE_CLASSES.fits : TONE_CLASSES.unconfirmed,
				)}
				data-testid="tyre-fit-box"
				data-fit={condition ? "fits-with-condition" : confirmed ? "fits" : "fits-supplier"}
			>
				{fields}
				<div className="flex items-start gap-3">
					<span className={iconCircle}>
						{confirmed ? (
							<CheckIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
						) : (
							<TriangleAlertIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
						)}
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
							<div className="min-w-0 flex-1 basis-56">
								<h3 id={titleId} className="text-[0.9375rem] leading-snug font-bold">
									{condition
										? t("fitConditionTitle")
										: view.fromManufacturerList
											? t("fitFitsTitle")
											: t("fitSupplierTitle")}
								</h3>
								<p className="mt-0.5 text-sm font-medium opacity-90">
									{view.fromManufacturerList
										? t("fitSizeManufacturer", { size: view.size })
										: t("fitSizeSupplier", { size: view.size })}
								</p>
							</div>
							<div className="shrink-0">{trigger(t("fitChange"), linkButton)}</div>
						</div>

						{condition ? (
							<>
								<p className="mt-2 text-sm font-medium">
									{t(condition.mode === "only" ? "conditionOnly" : "conditionNot", {
										size: view.size,
										tyres,
									})}
								</p>
								<div className="mt-3 flex items-start gap-2.5">
									<Checkbox
										id={confirmId}
										ref={confirmRef}
										checked={acknowledged}
										onCheckedChange={setAcknowledged}
										className="mt-0.5"
									/>
									<label htmlFor={confirmId} className="cursor-pointer text-sm leading-snug font-medium">
										{t(condition.mode === "only" ? "confirmOnly" : "confirmNot", { tyres })}
									</label>
								</div>
								{acknowledged ? null : <p className="mt-2 text-xs opacity-80">{t("fitConditionLocked")}</p>}
							</>
						) : null}

						{view.fromManufacturerList ? null : (
							<p className="mt-2 text-xs opacity-90">{t("sourceSupplier")}</p>
						)}
					</div>
				</div>
			</section>
		);
	}

	return (
		<GateContext.Provider value={gate}>
			{/* The window lives here, around the box AND the buy block: the buy button opens it too (`take`), and every
			    trigger has to sit inside the same dialog. The element that opened it gets the focus back when it closes. */}
			<VehicleSelectorSheet open={open} onOpenChange={setOpen} initialTab="tyres" returnFocusRef={openerRef}>
				{box}
				{children}
				{view.kind === "fits" ? null : (
					<p className="-mt-2">
						<SheetTrigger asChild>
							<button
								type="button"
								aria-haspopup="dialog"
								onClick={rememberOpener}
								className="text-text-secondary hover:text-text-primary focus-visible:ring-ring text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
							>
								{t("fitHowToFind")}
							</button>
						</SheetTrigger>
					</p>
				)}
			</VehicleSelectorSheet>
		</GateContext.Provider>
	);
}
