import type { B2bPaymentLockResult } from "./b2b-view";

/**
 * The customer's way out of a started payment, as a pure state machine (contract revision 2, §5 "Obnova po začatej
 * platbe"): which question to ask the backend next and when, and what to tell the customer meanwhile. The component
 * (`payment-lock-recovery.tsx`) only runs the effects it returns, so every path below is tested without timers.
 *
 *   locked ── "Zmeniť údaje" ─▶ releasing ─┬─ RELEASED, lock gone ─────────────────────────▶ released
 *                                          ├─ RELEASED / CANCELATION_REQUESTED ─▶ waitingCancel ─ read … ─┬▶ released
 *                                          │                                                              └▶ notConfirmed
 *                                          ├─ ATTEMPT_BEING_CREATED ─▶ waitingAttempt ─ release again … ─▶ (any of these)
 *                                          ├─ PAYMENT_HAS_FUNDS ─────────────────────────────────────────▶ funds
 *                                          ├─ not offered by this process ───────────────────────────────▶ unavailable
 *                                          └─ no usable answer ──────────────────────────────────────────▶ failed
 *
 * Rules it keeps:
 * - a change is offered (`released`) only on the backend's own `paymentLocked: false`, never on a status alone and
 *   never because time has passed;
 * - `PAYMENT_HAS_FUNDS` offers no change: the order is finished on the original offer;
 * - the waits are bounded (about 30 s each), and when the confirmation does not come the customer is told so and
 *   offered the next steps (try again, pay the original order, contact the shop) — nothing is refunded, and no new
 *   cart or payment is started by itself.
 */

export type PaymentLockPhase =
	/** The lock was met; nothing has been asked yet. */
	| "locked"
	/** The release request is on its way. */
	| "releasing"
	/** `CANCELATION_REQUESTED`: the payment app was asked to cancel; waiting for `paymentLocked: false`. */
	| "waitingCancel"
	/** `ATTEMPT_BEING_CREATED`: a payment is still being set up; the release is asked again shortly. */
	| "waitingAttempt"
	/** The backend says `paymentLocked: false`: the change can be made now. */
	| "released"
	/** `PAYMENT_HAS_FUNDS`: money is held; no change, the order is finished on the original offer. */
	| "funds"
	/** The wait ran out without the backend's confirmation. */
	| "notConfirmed"
	/** This process does not offer the release right now. */
	| "unavailable"
	/** The release got no usable answer. */
	| "failed";

export type PaymentLockRecoveryState = { phase: PaymentLockPhase; tries: number };

export type PaymentLockEffect =
	| { kind: "none" }
	| { kind: "release"; afterMs: number }
	| { kind: "read"; afterMs: number };

export type PaymentLockStep = { state: PaymentLockRecoveryState; effect: PaymentLockEffect };

/**
 * After `CANCELATION_REQUESTED`: read the lock about once a second at first, then less often (the contract suggests
 * 1 s and about 30 s in all). The payment app usually confirms within seconds.
 */
export const CANCEL_POLL_DELAYS_MS: readonly number[] = [
	1000, 1000, 1000, 2000, 2000, 3000, 3000, 4000, 5000, 8000,
];

/** After `ATTEMPT_BEING_CREATED`: ask for the release again "in a few seconds", about 30 s in all. */
export const ATTEMPT_RETRY_DELAYS_MS: readonly number[] = [2000, 3000, 5000, 5000, 5000, 10000];

export const INITIAL_PAYMENT_LOCK_STATE: PaymentLockRecoveryState = { phase: "locked", tries: 0 };

const NONE: PaymentLockEffect = { kind: "none" };

const at = (phase: PaymentLockPhase, tries = 0): PaymentLockRecoveryState => ({ phase, tries });

/** The phases in which a question is out or scheduled: the customer waits, nothing else is offered. */
export function isPaymentLockBusy(phase: PaymentLockPhase): boolean {
	return phase === "releasing" || phase === "waitingCancel" || phase === "waitingAttempt";
}

/** "Zmeniť údaje" or "Skúsiť znova": one release request, now. */
export function startPaymentLockRelease(): PaymentLockStep {
	return { state: at("releasing"), effect: { kind: "release", afterMs: 0 } };
}

function waitForCancelation(): PaymentLockStep {
	return { state: at("waitingCancel"), effect: { kind: "read", afterMs: CANCEL_POLL_DELAYS_MS[0]! } };
}

function nextAttempt(state: PaymentLockRecoveryState): PaymentLockStep {
	const tries = state.phase === "waitingAttempt" ? state.tries + 1 : 0;
	if (tries >= ATTEMPT_RETRY_DELAYS_MS.length) return { state: at("notConfirmed"), effect: NONE };
	return {
		state: at("waitingAttempt", tries),
		effect: { kind: "release", afterMs: ATTEMPT_RETRY_DELAYS_MS[tries]! },
	};
}

/** What the answer to a release request leads to. `state` is the state the request was sent from. */
export function afterPaymentLockRelease(
	state: PaymentLockRecoveryState,
	result: B2bPaymentLockResult,
): PaymentLockStep {
	switch (result.kind) {
		case "unavailable":
			return { state: at("unavailable"), effect: NONE };
		case "failed":
			// While a payment is still being set up, one lost answer does not end the wait.
			return state.phase === "waitingAttempt" ? nextAttempt(state) : { state: at("failed"), effect: NONE };
		case "state":
			// A release never answers this way; treated as the read it is.
			return result.paymentLocked ? waitForCancelation() : { state: at("released"), effect: NONE };
		case "release":
			switch (result.status) {
				case "PAYMENT_HAS_FUNDS":
					return { state: at("funds"), effect: NONE };
				case "ATTEMPT_BEING_CREATED":
					return nextAttempt(state);
				case "RELEASED":
				case "CANCELATION_REQUESTED":
					// Only the backend's `paymentLocked: false` opens the change; without it, the lock is read until it says so.
					return result.paymentLocked === false
						? { state: at("released"), effect: NONE }
						: waitForCancelation();
			}
	}
}

/** What one read of the lock leads to while waiting for the cancelation. */
export function afterPaymentLockRead(
	state: PaymentLockRecoveryState,
	result: B2bPaymentLockResult,
): PaymentLockStep {
	if (state.phase !== "waitingCancel") return { state, effect: NONE };
	if (result.kind === "state" && !result.paymentLocked) return { state: at("released"), effect: NONE };
	if (result.kind === "release" && result.paymentLocked === false)
		return { state: at("released"), effect: NONE };
	// Not offered any more (switched off, too many reads): stop asking, offer the next steps.
	if (result.kind === "unavailable") return { state: at("notConfirmed"), effect: NONE };
	// Still locked, or one read without an answer: ask again until the wait runs out.
	const tries = state.tries + 1;
	if (tries >= CANCEL_POLL_DELAYS_MS.length) return { state: at("notConfirmed"), effect: NONE };
	return {
		state: at("waitingCancel", tries),
		effect: { kind: "read", afterMs: CANCEL_POLL_DELAYS_MS[tries]! },
	};
}

/** The total a wait may take, for the copy and the tests. */
export const CANCEL_WAIT_MS = CANCEL_POLL_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
export const ATTEMPT_WAIT_MS = ATTEMPT_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
