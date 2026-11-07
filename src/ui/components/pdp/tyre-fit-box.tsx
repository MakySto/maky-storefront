"use client";

import {
	createContext,
	useCallback,
	useContext,
	useId,
	useMemo,
	useRef,
	useState,
	useTransition,
	type MouseEvent,
	type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
	ArrowRightIcon,
	CheckIcon,
	CircleDotIcon,
	CircleHelpIcon,
	MessageSquareIcon,
	SearchIcon,
	ShoppingCartIcon,
	TriangleAlertIcon,
	XIcon,
	type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import { rememberTyreAnswer } from "@/lib/tyre-size/actions";
import { tyreFitState, type TyreFitView, type TyreGateReason } from "@/lib/tyre-size/fit-state";
import { NO_MATCH_ANSWER } from "@/lib/tyre-size/questions";
import { TYRE_LIST_SEPARATOR } from "@/lib/tyre-size/line-metadata";
import type { TyreAlternative, TyreQuestion } from "@/lib/tyre-size/types";
import { SheetTrigger } from "@/ui/components/ui/sheet";
import { TONE_CLASSES } from "@/ui/components/fitment/verdict-presentation";
import { VehicleSelectorSheet } from "@/ui/components/vehicle/vehicle-selector-sheet";

/**
 * The text of the buy button while the choice is not complete: keys of the `tyreSize` namespace. They are chosen at run
 * time (`gateButtonKey`), so the list is written out here for the test that checks every one exists in every language.
 */
export const GATE_BUTTON_KEYS = [
	"selectSize",
	"buttonAsk",
	"buttonOther",
	"buttonFind",
	"buttonContact",
] as const;
export type GateButtonKey = (typeof GATE_BUTTON_KEYS)[number];

/**
 * What the buy buttons need to know about the tyre choice: whether it is complete, why not, what to say and where
 * to take the shopper. `null` outside a `<TyreSizeGate>`, which is every product that is not a snow chain or sock.
 */
interface TyreSizeGateValue {
	complete: boolean;
	reason: TyreGateReason | null;
	/** The button's text while it holds back; `null` when the choice is complete. */
	buttonKey: GateButtonKey | null;
	/**
	 * Does what the button says: opens the window that asks for the size, goes to the question, or goes to the page that
	 * can help. A buy button passes itself, so that closing the window gives the focus back to it.
	 */
	take: (opener?: HTMLElement | null) => void;
	view: TyreFitView;
	/** The question's box, when the page asks one: where `take` scrolls to. */
	questionRef: { current: HTMLDivElement | null };
	knowsCode: boolean;
	setKnowsCode: (value: boolean) => void;
	/** The window opener of the row, for its "change" link. */
	rememberOpener: (event: MouseEvent<HTMLElement>) => void;
	/** The first alternative that can be linked to, if the view has any. */
	linkable: TyreAlternative | null;
	hrefs: TyreGateHrefs;
}

export interface TyreGateHrefs {
	/** The snow-chain list narrowed to the shopper's size. */
	find: string;
	/** The page where the shopper asks the shop about a size it cannot verify. */
	contact: string;
}

const GateContext = createContext<TyreSizeGateValue | null>(null);

export function useTyreSizeGate(): TyreSizeGateValue | null {
	return useContext(GateContext);
}

/** The text of the buy button for each reason it holds back: what the next step is. */
const BUTTON_OF_REASON: Record<TyreGateReason, GateButtonKey> = {
	choose: "selectSize",
	ask: "buttonAsk",
	other: "buttonOther",
	find: "buttonFind",
	contact: "buttonContact",
};

/** The text key of a held-back buy button. A gate that is not complete always has one; "selectSize" is the safe word. */
export const gateButtonKey = (gate: Pick<TyreSizeGateValue, "buttonKey">): GateButtonKey =>
	gate.buttonKey ?? "selectSize";

/**
 * How a held-back buy button looks.
 *
 * What it says is longer than "Pridať do košíka" ("Upresniť pneumatiky", "Zobraziť správnu veľkosť") and on a 360 px
 * phone the button beside the quantity stepper has about 110 px of text, so these labels wrap onto a second line
 * instead of being cut off (a truncated call to action is worse than a tall one).
 *
 * Choosing a size, answering the question and going to the size that fits are steps TOWARD buying, so the button keeps
 * the purchase colour. Going to a list of other chains, or to the people who can verify a size, is the one case in
 * which THIS product cannot be bought for what the shopper told us: there the button is a quiet, bordered one, so a
 * green "buy" colour is never on a button that does not buy. It stays pressable: it takes the shopper on.
 */
export function gateButtonLook(gate: Pick<TyreSizeGateValue, "reason"> | null): {
	variant: "default" | "secondary";
	className: string | undefined;
} {
	if (gate === null) return { variant: "default", className: undefined };
	if (gate.reason === "find" || gate.reason === "contact") {
		return {
			variant: "secondary",
			className:
				"border-border-default text-text-primary border leading-tight whitespace-normal shadow-none hover:shadow-none",
		};
	}
	return { variant: "default", className: "leading-tight whitespace-normal" };
}

/** What each buy button draws: a cart for the one that buys, and for a held-back one where it takes the shopper. */
const BUTTON_ICONS: Record<TyreGateReason | "buy", LucideIcon> = {
	buy: ShoppingCartIcon,
	choose: CircleDotIcon,
	ask: CircleDotIcon,
	other: ArrowRightIcon,
	find: SearchIcon,
	contact: MessageSquareIcon,
};

/**
 * The icon of a buy button: a cart only while pressing it buys. A held-back button shows where it takes the shopper
 * (the tyres, the right size, the list, the people), so a cart is never drawn on a button that does not add to it.
 * A component, not a function that returns one: the lookup in a module-level table keeps the icon the same
 * component from render to render.
 */
export function GateIcon({
	gate,
	className,
}: {
	gate: Pick<TyreSizeGateValue, "reason"> | null;
	className?: string;
}) {
	const Icon = BUTTON_ICONS[gate?.reason ?? "buy"];
	return <Icon className={className} aria-hidden="true" />;
}

/** The label of a held-back button: up to two lines, balanced, where the normal label is one line cut with an ellipsis. */
export const HELD_BACK_LABEL = "line-clamp-2 text-balance";

/** What the verdict is about: a different size, verdict or question is a different thing, and nothing ticked carries over. */
export const viewKey = (view: TyreFitView): string => {
	switch (view.kind) {
		case "no-size":
			return "no-size";
		case "fits":
			return `fits|${view.size}|${view.answer ?? ""}`;
		case "ask":
			return `ask|${view.size}|${view.question.key}`;
		default:
			return `${view.kind}|${view.size}`;
	}
};

const rowShell = "rounded-sm border px-3.5 py-3";
const iconCircle = "bg-surface-card flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-xs";
const linkButton =
	"inline-flex min-h-8 items-center text-sm font-medium underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden";

/**
 * The shopper's tyres, as a snow chain's or sock's product page meets it, and the gate it puts on the buy button.
 *
 * The size is not chosen here. It is given once in the vehicle selector's second tab and remembered
 * (`lib/tyre-size/memory`), and the page only ANSWERS, in one line (`TyreFitRow`) that sits between the price and the
 * buy button: the size is ours, or it is not, or one question settles it. One product on this shop is one manufacturer's
 * code and one code fits dozens to hundreds of sizes, so the size is not a variant: it travels in three hidden fields
 * of the surrounding form and is checked again on the server against the same list before anything reaches the cart
 * (`lib/tyre-size`). Nothing is chosen for the shopper, and the buy button says what the next step is and takes them
 * to it until the choice is complete.
 *
 * What the form carries and when it is complete is `lib/tyre-size/fit-state`, which a test drives against the
 * server's own check; this component only draws it.
 */
export function TyreSizeGate({
	view,
	hrefs,
	children,
}: {
	view: TyreFitView;
	hrefs: TyreGateHrefs;
	children: ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [knowsCode, setKnowsCodeState] = useState(false);

	// What was said belongs to the size and question it was said for. When the verdict changes (another size, a size
	// forgotten) it starts over, in the same render: nothing said for one size is carried to another.
	const key = viewKey(view);
	const [seen, setSeen] = useState(key);
	if (seen !== key) {
		setSeen(key);
		setKnowsCodeState(false);
	}

	const state = tyreFitState(view, { knowsCode });

	const triggerRef = useRef<HTMLButtonElement>(null);
	const questionRef = useRef<HTMLDivElement>(null);
	// What the window gives the focus back to when it closes. Left to itself Radix returns it to the LAST trigger that
	// mounted in the dialog, which is not the button the shopper pressed whenever the row has more than one or the buy
	// button opened the window.
	const openerRef = useRef<HTMLElement | null>(null);
	const rememberOpener = useCallback((event: MouseEvent<HTMLElement>) => {
		openerRef.current = event.currentTarget;
	}, []);

	const linkable = view.kind === "other" ? view.alternatives.find((alt) => alt.href !== null) ?? null : null;
	const { reason } = state;
	const buttonKey: GateButtonKey | null = reason === null ? null : BUTTON_OF_REASON[reason];

	const take = useCallback(
		(opener?: HTMLElement | null) => {
			if (reason === "ask" && questionRef.current) {
				const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
				questionRef.current.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
				questionRef.current.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
				return;
			}
			// `other` is only the reason when the shop sells the right size (`tyreFitState`), so it has a page to go to.
			if (reason === "other" && linkable?.href) {
				router.push(linkable.href);
				return;
			}
			if (reason === "other" || reason === "find") {
				router.push(hrefs.find);
				return;
			}
			if (reason === "contact") {
				router.push(hrefs.contact);
				return;
			}
			// The row's own button, clicked: Radix opens the window as if the shopper had. That click records the row's
			// button as the opener, so the buy button that really was pressed is recorded after it.
			triggerRef.current?.click();
			if (opener) openerRef.current = opener;
		},
		[reason, linkable, router, hrefs.find, hrefs.contact],
	);

	const value = useMemo<TyreSizeGateValue>(
		() => ({
			complete: state.complete,
			reason,
			buttonKey,
			take,
			view,
			questionRef,
			knowsCode,
			setKnowsCode: setKnowsCodeState,
			rememberOpener,
			linkable,
			hrefs,
		}),
		[state.complete, reason, buttonKey, take, view, knowsCode, rememberOpener, linkable, hrefs],
	);

	return (
		<GateContext.Provider value={value}>
			{/* What the form carries. These three are the whole choice. */}
			<input type="hidden" name={TYRE_FIELDS.mode} value={state.fields[TYRE_FIELDS.mode]} />
			<input type="hidden" name={TYRE_FIELDS.size} value={state.fields[TYRE_FIELDS.size]} />
			<input type="hidden" name={TYRE_FIELDS.answer} value={state.fields[TYRE_FIELDS.answer]} />
			{/* The window lives here, around the row AND the buy block: the buy button opens it too (`take`), and every
			    trigger has to sit inside the same dialog. The element that opened it gets the focus back when it closes. */}
			<VehicleSelectorSheet open={open} onOpenChange={setOpen} initialTab="tyres" returnFocusRef={openerRef}>
				{/* The window's own trigger, for the buy button to click (`take`). Hidden: the row's "change" link is the one
				    a shopper sees. */}
				<SheetTrigger asChild>
					<button
						ref={triggerRef}
						type="button"
						hidden
						aria-hidden="true"
						tabIndex={-1}
						onClick={rememberOpener}
					/>
				</SheetTrigger>
				{children}
			</VehicleSelectorSheet>
		</GateContext.Provider>
	);
}

/** The one question: which tyres do you have? Answered with one tap; the shop applies the list. */
function TyreQuestionBox({ size, question }: { size: string; question: TyreQuestion }) {
	const t = useTranslations("tyreSize");
	const router = useRouter();
	const ids = useId();
	const gate = useTyreSizeGate();
	const [pending, startTransition] = useTransition();
	const [failed, setFailed] = useState(false);

	const answer = (value: string) => {
		setFailed(false);
		startTransition(async () => {
			const result = await rememberTyreAnswer(question.key, value);
			if (!result.ok) {
				setFailed(true);
				return;
			}
			// The verdict, the buy button and the hidden fields are server-rendered from the cookie: render them again.
			router.refresh();
		});
	};

	const options = [
		...question.options.map((option) => ({ value: option, label: option })),
		{ value: NO_MATCH_ANSWER, label: t(question.subject === "make" ? "askOtherMake" : "askOtherModel") },
	];

	return (
		<div
			data-testid="tyre-question"
			role="group"
			aria-labelledby={`${ids}-q`}
			aria-busy={pending || undefined}
			className="mt-3"
			// The gate's `take` scrolls to this and focuses the first answer.
			ref={gate?.questionRef}
		>
			<p id={`${ids}-q`} className="text-sm font-semibold">
				{t(question.subject === "make" ? "askMake" : "askModel")}
			</p>
			<div className="mt-2 flex flex-wrap gap-2">
				{options.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						disabled={pending}
						onClick={() => answer(value)}
						className="bg-surface-card text-text-primary focus-visible:ring-ring inline-flex min-h-10 items-center rounded-xs border border-current/30 px-3.5 text-sm font-medium transition-colors hover:border-current focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:opacity-60"
					>
						{label}
					</button>
				))}
			</div>
			<p className="mt-2 text-xs opacity-80">{t("askWhy", { size })}</p>
			{failed ? (
				<p role="alert" className="mt-2 text-sm font-medium">
					{t("errorAnswer")}
				</p>
			) : null}
		</div>
	);
}

/**
 * The answer, in one line.
 *
 * About 60 px for the common cases (nothing asked yet, it fits, it fits on the shopper's tyres, it does not fit), a
 * little more when it asks its one question or names the size that does fit. It sits between the price and the buy
 * button, so the shopper reads the price, the verdict and the button in one glance instead of a form.
 */
export function TyreFitRow() {
	const t = useTranslations("tyreSize");
	const ids = useId();
	const gate = useTyreSizeGate();
	if (!gate) return null;
	const { view } = gate;
	const titleId = `${ids}-title`;

	const change = (
		<SheetTrigger asChild>
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={gate.rememberOpener}
				className={cn(linkButton, "shrink-0")}
			>
				{view.kind === "no-size" ? t("fitEnter") : t("fitChange")}
			</button>
		</SheetTrigger>
	);

	const row = (options: {
		fit: string;
		tone: string;
		icon: ReactNode;
		title: string;
		sub?: ReactNode;
		extra?: ReactNode;
		border?: string;
	}) => (
		<section
			aria-labelledby={titleId}
			className={cn(rowShell, options.border ?? "border-current/15", options.tone)}
			data-testid="tyre-fit-box"
			data-fit={options.fit}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						iconCircle,
						options.fit === "no-size" && "text-text-secondary border-border-default border",
					)}
				>
					{options.icon}
				</span>
				<div className="min-w-0 flex-1">
					<p id={titleId} className="text-[0.9375rem] leading-snug font-bold">
						{options.title}
					</p>
					{options.sub ? (
						<p className="mt-0.5 text-[0.8125rem] leading-snug opacity-90">{options.sub}</p>
					) : null}
				</div>
				{change}
			</div>
			{options.extra}
		</section>
	);

	const icon = (Icon: typeof CheckIcon) => <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />;
	const neutral = "border-border-default bg-surface-card text-text-primary";

	switch (view.kind) {
		case "no-size":
			return row({
				fit: "no-size",
				tone: neutral,
				border: "border-border-default",
				icon: icon(CircleHelpIcon),
				title: t("fitNoSizeTitle"),
				sub: t("fitNoSizeLead"),
			});

		case "unlisted":
			return row({
				fit: "unlisted",
				tone: TONE_CLASSES.unconfirmed,
				icon: icon(TriangleAlertIcon),
				title: t("fitUnlistedTitle", { size: view.size }),
				sub: t("fitUnlistedLead"),
			});

		case "fits": {
			// Green whichever list the size came from (owner, 2026-11-07): the shop holds the size for this product, and
			// the row says so. The list is named in small words under it, never as "check it yourself" over a green buy
			// button, which told a shopper who had just entered their size to do the shop's work.
			let sub: string;
			if (view.question && view.answer !== null && view.answer !== NO_MATCH_ANSWER) {
				sub = t("fitFitsAnswer", { answer: view.answer });
			} else if (view.question) {
				sub = t(view.question.subject === "make" ? "fitFitsOtherMake" : "fitFitsOtherModel", {
					tyres: view.question.options.join(TYRE_LIST_SEPARATOR),
				});
			} else {
				sub = t(view.fromManufacturerList ? "fitFitsManufacturer" : "fitFitsSupplier");
			}
			return row({
				fit: "fits",
				tone: TONE_CLASSES.fits,
				icon: icon(CheckIcon),
				title: t("fitFitsTitle", { size: view.size }),
				sub,
			});
		}

		case "ask":
			return row({
				fit: "ask",
				tone: TONE_CLASSES.unconfirmed,
				icon: icon(TriangleAlertIcon),
				title: t("fitAskTitle", { size: view.size }),
				extra: <TyreQuestionBox size={view.size} question={view.question} />,
			});

		case "other": {
			const [first] = view.alternatives;
			const one = view.alternatives.length === 1;
			const labelOf = (alt: TyreAlternative) => alt.sizeLabel;
			const isCode = (alt: TyreAlternative) => alt.sizeLabel === alt.code;
			const title = one
				? t(isCode(first) ? "fitOtherTitleCode" : "fitOtherTitle", { size: view.size, label: labelOf(first) })
				: t("fitOtherTitleMany", { size: view.size });
			// What is true (the shop does not sell it) and what to do about it (look at what does fit, or ask the people):
			// the sentence is the same one the button below carries out.
			const unsold = `${t(isCode(first) ? "fitOtherUnlistedCode" : "fitOtherUnlisted")} ${t(
				view.elsewhere ? "fitNoFitElsewhere" : "fitWriteUs",
			)}`;
			const sellable = view.alternatives.some((alt) => alt.href !== null);
			const sub = one
				? first.href
					? undefined
					: unsold
				: sellable
					? view.alternatives.map(labelOf).join(" · ")
					: `${view.alternatives.map(labelOf).join(" · ")}. ${unsold}`;
			return row({
				fit: "other",
				tone: TONE_CLASSES.unconfirmed,
				icon: icon(SearchIcon),
				title,
				sub: sub ?? (
					<a href={first.href ?? "#"} className={cn(linkButton, "min-h-0 text-[0.8125rem]")}>
						{t(isCode(first) ? "fitOtherLinkCode" : "fitOtherLink", { label: labelOf(first) })}
					</a>
				),
			});
		}

		case "no-fit":
			return row({
				fit: "no-fit",
				tone: TONE_CLASSES["no-fit"],
				icon: icon(XIcon),
				title: t("fitNoFitTitle", { size: view.size }),
				sub: t(view.elsewhere ? "fitNoFitElsewhere" : "fitNoFitNowhere"),
			});
	}
}

/**
 * The shopper who knows the code and gives no size: one quiet line under the buy button, only while the shop cannot
 * answer for a size (none given, or one it cannot verify). It is a statement, not a form: pressing it says "I know this
 * code", the row changes to say that the shop makes no claim, and the order says so too.
 */
export function TyreKnowsCode() {
	const t = useTranslations("tyreSize");
	const gate = useTyreSizeGate();
	if (!gate || (gate.view.kind !== "no-size" && gate.view.kind !== "unlisted")) return null;

	return gate.knowsCode ? (
		<p className="text-text-secondary text-sm" data-testid="tyre-knows-code" role="status">
			{t("knowsCodeNote")}{" "}
			<button
				type="button"
				onClick={() => gate.setKnowsCode(false)}
				className="text-text-primary focus-visible:ring-ring font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
			>
				{t("knowsCodeUndo")}
			</button>
		</p>
	) : (
		<p>
			<button
				type="button"
				onClick={() => gate.setKnowsCode(true)}
				className="text-text-secondary hover:text-text-primary focus-visible:ring-ring text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
				data-testid="tyre-knows-code"
			>
				{t("knowsCode")}
			</button>
		</p>
	);
}
