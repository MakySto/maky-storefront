import type { CheckoutErrorFragment, ValidationRulesFragment } from "@/checkout/graphql";
import type { ServerCheckout } from "@/checkout/lib/checkout-types";
import type { TransactionInitializePayload } from "@/checkout/lib/payment/types";

export type CheckoutFieldError = Pick<CheckoutErrorFragment, "field" | "message" | "code">;

export type CheckoutActionResult =
	| { ok: true; checkout: ServerCheckout }
	| { ok: false; error?: string; fieldErrors?: CheckoutFieldError[] };

export type SimpleActionResult =
	| { ok: true }
	| { ok: false; error?: string; fieldErrors?: CheckoutFieldError[] };

export type AddressValidationRulesActionResult =
	| { ok: true; rules: ValidationRulesFragment }
	| { ok: false; error: string };

/**
 * Machine codes of the payment preflight (zadanie 02, §4), carried next to the translated `error` so the client
 * never has to compare strings:
 * - `TOTAL_CHANGED` / `B2B_CONTEXT_CHANGED` — refresh: `checkout` is the new quote; renew the summary and the
 *   Stripe amount and let the customer confirm again;
 * - `CHECKOUT_LOCKED` — a payment for this checkout is already in progress: recovery, never a second intent;
 * - `FINAL_STATE_UNCONFIRMED` — the final total could not be confirmed: nothing starts.
 */
export type PaymentPreflightCode =
	| "TOTAL_CHANGED"
	| "B2B_CONTEXT_CHANGED"
	| "CHECKOUT_LOCKED"
	| "FINAL_STATE_UNCONFIRMED";

export type TransactionInitializeActionResult =
	| { ok: true; data: NonNullable<TransactionInitializePayload> }
	| { ok: false; error: string; code?: PaymentPreflightCode; checkout?: ServerCheckout | null };

export type CheckoutCompleteActionResult =
	| { ok: true; orderId: string }
	| {
			ok: false;
			error: string;
			fieldErrors?: CheckoutFieldError[];
			code?: PaymentPreflightCode;
			checkout?: ServerCheckout | null;
	  };

export type PaymentGatewayInitializePayload = {
	errors?: ReadonlyArray<{ message?: string | null }> | null;
	gatewayConfigs?: ReadonlyArray<{
		id: string;
		data?: unknown;
		errors?: ReadonlyArray<{ message?: string | null }> | null;
	}> | null;
};

export type PaymentGatewaysInitializeActionResult =
	| { ok: true; data: NonNullable<PaymentGatewayInitializePayload> }
	| { ok: false; error: string };

export type TransactionProcessPayload = {
	errors?: ReadonlyArray<{ message?: string | null }> | null;
	transactionEvent?: { type?: string | null; message?: string | null } | null;
	transaction?: { id?: string | null } | null;
	data?: unknown;
};

export type TransactionProcessActionResult =
	| { ok: true; data: NonNullable<TransactionProcessPayload> }
	| { ok: false; error: string };
