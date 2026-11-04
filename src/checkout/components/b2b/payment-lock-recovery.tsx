"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { readB2bPaymentLockAction, releaseB2bPaymentLockAction } from "@/checkout/lib/b2b/actions";
import type { B2bPaymentLockResult } from "@/checkout/lib/b2b/b2b-view";
import {
	afterPaymentLockRead,
	afterPaymentLockRelease,
	INITIAL_PAYMENT_LOCK_STATE,
	isPaymentLockBusy,
	startPaymentLockRelease,
	type PaymentLockPhase,
	type PaymentLockRecoveryState,
	type PaymentLockStep,
} from "@/checkout/lib/b2b/payment-lock-recovery";
import { rethrowNextInternalError } from "@/checkout/lib/rethrow-next-internal-error";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { marketHref } from "@/lib/channel-map";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/ui/button";

/**
 * Runs the recovery state machine (`payment-lock-recovery.ts`): the release and the reads go to the server actions,
 * the waits are timers, and an answer that arrives after "Skúsiť znova" or after the panel is gone is dropped.
 */
export function usePaymentLockRecovery(params: {
	checkoutId: string;
	localeSlug?: string;
	onReleased?: () => void;
}) {
	const { checkoutId, localeSlug } = params;
	const [state, setState] = useState<PaymentLockRecoveryState>(INITIAL_PAYMENT_LOCK_STATE);
	const generation = useRef(0);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onReleased = useRef(params.onReleased);
	useEffect(() => {
		onReleased.current = params.onReleased;
	});

	const stop = useCallback(() => {
		generation.current += 1;
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	}, []);
	useEffect(() => stop, [stop]);

	const start = useCallback(() => {
		stop();
		const gen = generation.current;
		const current = () => gen === generation.current;
		// A wait that `stop` cancels never resolves: the loop below simply ends there.
		const wait = (ms: number) =>
			new Promise<void>((resolve) => {
				timer.current = setTimeout(resolve, ms);
			});

		void (async () => {
			let step: PaymentLockStep = startPaymentLockRelease();
			for (;;) {
				if (!current()) return;
				setState(step.state);
				if (step.state.phase === "released") onReleased.current?.();
				const { effect } = step;
				if (effect.kind === "none") return;
				if (effect.afterMs > 0) await wait(effect.afterMs);
				if (!current()) return;

				let result: B2bPaymentLockResult;
				try {
					result =
						effect.kind === "release"
							? await releaseB2bPaymentLockAction({ checkoutId, localeSlug })
							: await readB2bPaymentLockAction({ checkoutId });
				} catch (error) {
					rethrowNextInternalError(error);
					result = { kind: "failed", cause: "action-threw" };
				}
				if (!current()) return;
				step =
					effect.kind === "release"
						? afterPaymentLockRelease(step.state, result)
						: afterPaymentLockRead(step.state, result);
			}
		})();
	}, [checkoutId, localeSlug, stop]);

	return { phase: state.phase, start };
}

/** A way to the payment of the original offer: a step of this checkout, or a page (from the cart or a product). */
export type PaymentLockDestination = { onClick: () => void } | { href: string };

type PaymentLockRecoveryProps = {
	checkoutId: string;
	/** The checkout's channel, for the link to the shop's contact page. */
	channelSlug: string;
	localeSlug?: string;
	/**
	 * What the customer wanted to do, for the wording: change the checkout's details, change the cart, or pay (a new
	 * payment refused because one is already in progress).
	 */
	subject: "details" | "cart" | "payment";
	/** Called once, when the backend has confirmed `paymentLocked: false`. */
	onReleased?: () => void;
	/** "Zaplatiť s pôvodnými údajmi": the same offer, which can always be paid again. Omitted on the payment step. */
	payOriginal?: PaymentLockDestination;
	/** "Dokončiť objednávku" when the payment already holds money. */
	finishOrder?: PaymentLockDestination;
	className?: string;
};

type Tone = "info" | "success" | "warning" | "error";

/** Room the checkout's sticky action bar takes at the bottom of a phone screen. */
const STICKY_BAR_PX = 96;

const TONE: Record<Tone, { box: string; icon: typeof Info; iconClass: string }> = {
	info: { box: "bg-status-info-bg border-status-info-border", icon: Info, iconClass: "text-status-info" },
	success: {
		box: "bg-status-success-bg border-status-success-border",
		icon: CheckCircle2,
		iconClass: "text-status-success",
	},
	warning: {
		box: "bg-status-warning-bg border-status-warning-border",
		icon: AlertTriangle,
		iconClass: "text-status-warning",
	},
	error: {
		box: "bg-status-danger-bg border-status-danger-border",
		icon: XCircle,
		iconClass: "text-status-danger",
	},
};

const PHASE_TONE: Record<PaymentLockPhase, Tone> = {
	locked: "warning",
	releasing: "info",
	waitingCancel: "info",
	waitingAttempt: "info",
	released: "success",
	funds: "info",
	notConfirmed: "warning",
	unavailable: "error",
	failed: "error",
};

type Action = "release" | "retry" | "payOriginal" | "finishOrder" | "contact";

const RELEASE_LABEL = {
	details: "actions.releaseDetails",
	cart: "actions.releaseCart",
	payment: "actions.releasePayment",
} as const;

/** A link that looks like the small outline button next to it (`Button` renders a `<button>` only). */
const LINK_BUTTON =
	"border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center " +
	"justify-center gap-2 rounded-xs border px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-all " +
	"duration-200 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 " +
	"focus-visible:ring-offset-2 focus-visible:outline-hidden";

const PHASE_ACTIONS: Record<PaymentLockPhase, readonly Action[]> = {
	locked: ["release", "payOriginal"],
	releasing: [],
	waitingCancel: [],
	waitingAttempt: [],
	released: [],
	funds: ["finishOrder"],
	notConfirmed: ["retry", "payOriginal", "contact"],
	unavailable: ["payOriginal", "contact"],
	failed: ["retry", "payOriginal", "contact"],
};

/**
 * "Platba už prebieha" with the way out (contract revision 2, §5): end the started payment and then change the
 * details or the cart, pay the original offer, or ask the shop. Shown wherever a change was refused because of a
 * started payment (`B2B_CHECKOUT_LOCKED`) or the company check found the checkout locked.
 *
 * Nothing changes the checkout by itself: the customer's own change is made again by the customer once the backend
 * has confirmed the lock is gone, and no refund, new cart or new payment is ever started from here.
 */
export const PaymentLockRecovery: FC<PaymentLockRecoveryProps> = ({
	checkoutId,
	channelSlug,
	localeSlug,
	subject,
	onReleased,
	payOriginal,
	finishOrder,
	className,
}) => {
	const t = useTranslations("checkout.paymentLock");
	const { phase, start } = usePaymentLockRecovery({ checkoutId, localeSlug, onReleased });
	const box = useRef<HTMLDivElement>(null);
	// The panel appears because something the customer did was refused. On a phone it is often below the fold, under
	// the sticky action bar, so it is brought into view once, when it appears (not again while it changes).
	useEffect(() => {
		const element = box.current;
		if (!element || typeof window === "undefined") return;
		const rect = element.getBoundingClientRect();
		if (rect.top >= 0 && rect.bottom <= window.innerHeight - STICKY_BAR_PX) return;
		const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
	}, []);
	const tone = TONE[PHASE_TONE[phase]];
	const Icon = tone.icon;
	const busy = isPaymentLockBusy(phase);

	const message =
		phase === "locked" || phase === "released"
			? t(`${phase}.${subject}`)
			: t(phase as Exclude<PaymentLockPhase, "locked" | "released">);

	const actions = PHASE_ACTIONS[phase].filter(
		(action) => (action !== "payOriginal" || payOriginal) && (action !== "finishOrder" || finishOrder),
	);

	// The checkout is its own route outside the market segment: a full navigation, as the cart's checkout link does.
	const destination = (
		action: "payOriginal" | "finishOrder",
		target: PaymentLockDestination,
		label: string,
	) =>
		"href" in target ? (
			<a key={action} href={target.href} className={LINK_BUTTON}>
				{label}
			</a>
		) : (
			<Button key={action} type="button" size="sm" variant="outline-solid" onClick={target.onClick}>
				{label}
			</Button>
		);

	return (
		<div
			ref={box}
			className={cn("text-foreground flex items-start gap-3 rounded-lg border p-4", tone.box, className)}
			role={PHASE_TONE[phase] === "error" ? "alert" : "status"}
			aria-live="polite"
			aria-busy={busy || undefined}
			data-payment-lock={phase}
		>
			{busy ? (
				<span className="mt-0.5 shrink-0">
					<LoadingSpinner />
				</span>
			) : (
				<Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone.iconClass)} aria-hidden />
			)}
			<div className="min-w-0 flex-1 space-y-3">
				<p className="text-sm">{message}</p>
				{actions.length ? (
					<div className="flex flex-wrap gap-2">
						{actions.map((action) => {
							switch (action) {
								case "release":
								case "retry":
									return (
										<Button key={action} type="button" size="sm" variant="outline-solid" onClick={start}>
											{t(action === "retry" ? "actions.retry" : RELEASE_LABEL[subject])}
										</Button>
									);
								case "payOriginal":
									return destination(action, payOriginal!, t("actions.payOriginal"));
								case "finishOrder":
									return destination(action, finishOrder!, t("actions.finishOrder"));
								case "contact":
									return (
										<Link
											key={action}
											href={marketHref(channelSlug, "/kontakt")}
											prefetch={false}
											className={LINK_BUTTON}
										>
											{t("actions.contact")}
										</Link>
									);
							}
						})}
					</div>
				) : null}
			</div>
		</div>
	);
};
