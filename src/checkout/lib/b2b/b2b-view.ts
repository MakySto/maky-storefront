import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import type { B2bUiOutcome, B2bVatVerificationStatus } from "./contract";

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
