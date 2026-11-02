import "server-only";

import type { PaymentPreflightCode } from "@/checkout/lib/checkout-action-types";
import type { ServerCheckout } from "@/checkout/lib/checkout-types";
import {
	getCheckoutPayAmount,
	hasMaterialCheckoutTotalChange,
} from "@/checkout/lib/payment/checkout-pay-amount";

import { evaluateB2b, type EvaluateB2bDeps } from "./evaluate-b2b";

/**
 * The server-side check before a payment starts (card, express sheet, and a zero-total order), whether or not the
 * client sent an amount (zadanie 02, §4). It re-reads the checkout, confirms the B2B state where the workflow
 * applies, and compares the live amount due with the one the customer was shown.
 *
 * `ready` is the only result a payment may start on. `refresh_required` carries the new quote, so the summary and
 * the Stripe Elements amount are renewed and the customer confirms again; `blocked` starts nothing.
 */

export type PaymentPreflight =
	| { kind: "ready"; checkout: ServerCheckout; cause: string }
	| {
			kind: "refresh_required";
			code: Extract<PaymentPreflightCode, "TOTAL_CHANGED" | "B2B_CONTEXT_CHANGED">;
			checkout: ServerCheckout;
			cause: string;
	  }
	| {
			kind: "blocked";
			code: Extract<PaymentPreflightCode, "CHECKOUT_LOCKED" | "FINAL_STATE_UNCONFIRMED">;
			checkout: ServerCheckout | null;
			cause: string;
	  };

export async function runPaymentPreflight(
	params: { checkoutId: string; expectedAmount?: number | null },
	deps: EvaluateB2bDeps,
): Promise<PaymentPreflight> {
	const evaluation = await evaluateB2b({ checkoutId: params.checkoutId, mode: "confirm" }, deps);
	const { outcome, checkout, cause } = evaluation;

	if (outcome.kind === "locked") return { kind: "blocked", code: "CHECKOUT_LOCKED", checkout, cause };
	if (outcome.kind === "unconfirmed" || !checkout) {
		return { kind: "blocked", code: "FINAL_STATE_UNCONFIRMED", checkout, cause };
	}
	if (outcome.kind === "changed")
		return { kind: "refresh_required", code: "B2B_CONTEXT_CHANGED", checkout, cause };

	const liveAmount = getCheckoutPayAmount(checkout);
	if (liveAmount === null)
		return { kind: "blocked", code: "FINAL_STATE_UNCONFIRMED", checkout, cause: "no-total" };

	if (
		typeof params.expectedAmount === "number" &&
		hasMaterialCheckoutTotalChange(params.expectedAmount, liveAmount)
	) {
		// A decision this run wrote is what moved the total (e.g. an exemption that ran out): say so.
		const code = cause.startsWith("applied-") ? "B2B_CONTEXT_CHANGED" : "TOTAL_CHANGED";
		return { kind: "refresh_required", code, checkout, cause };
	}

	return { kind: "ready", checkout, cause };
}
