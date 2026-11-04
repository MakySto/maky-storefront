import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import type { B2bPaymentLockReleaseStatus, B2bUiOutcome, B2bVatVerificationStatus } from "./contract";

/** What `evaluateB2bAction` returns to the browser (client-safe types only). */
export type B2bEvaluationView = {
	outcome: B2bUiOutcome;
	/** The public checkout as read AFTER the decision, consistent with it; `null` when it could not be read. */
	checkout: ServerCheckout | null;
	/** The VIES answer used in this run, for the step's hint ("valid, decided once delivery is chosen"). */
	vies: B2bVatVerificationStatus | null;
	/** Whether this process can offer the automatic exemption at all (UI on, readiness passed). */
	exemptionAvailable: boolean;
	/** Stable diagnostic code (no ids, no numbers, no secrets). */
	cause: string;
};

export type B2bSaveErrorCode =
	| "DISABLED"
	| "INVALID"
	| "RATE_LIMITED"
	| "FAILED"
	| "CHECKOUT_LOCKED"
	| "CONTEXT_CHANGED";

export type B2bSaveResult = { ok: true } | { ok: false; code: B2bSaveErrorCode };

/**
 * What the payment-lock actions (`releaseB2bPaymentLockAction`, `readB2bPaymentLockAction`) return to the browser:
 * the backend's own words, a boolean and a stable code, never a Saleor message.
 *
 * - `release` — the backend answered the release; `paymentLocked` is what the same answer says about the lock
 *   (`null` when it did not say). Only `paymentLocked === false` lets the customer change anything.
 * - `state` — the lock as read now (public, without the token).
 * - `unavailable` — this process does not offer it right now (B2B checkout switched off, the B2B app's access not
 *   ready, a browser that holds a different checkout, too many requests). Nothing was sent to Saleor with the token.
 * - `failed` — it was asked and no usable answer came (network, a GraphQL error, `NOT_FOUND`).
 */
export type B2bPaymentLockResult =
	| { kind: "release"; status: B2bPaymentLockReleaseStatus; paymentLocked: boolean | null; cause: string }
	| { kind: "state"; paymentLocked: boolean; cause: string }
	| { kind: "unavailable"; cause: string }
	| { kind: "failed"; cause: string };
