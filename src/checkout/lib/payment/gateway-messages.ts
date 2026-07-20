import { type PaymentGatewayFragment } from "@/checkout/graphql";

type GatewayLike = Pick<PaymentGatewayFragment, "id" | "name">;

export type CheckoutGatewayMessages = {
	unsupported: string;
	dummyMissingBody: string;
	noneTitle: string;
	noneBody: string;
	unsupportedTitle: string;
	dummyMissingTitle: string;
	noGatewayConfigured: string;
	stripeUseCardForm: string;
	paymentFailed: string;
	paymentTryAgain: string;
	paymentWebhookFailed: string;
	paymentInitFailed: string;
};

type GatewayMessageKey =
	| "unsupported"
	| "dummyMissingBody"
	| "noneTitle"
	| "noneBody"
	| "unsupportedTitle"
	| "dummyMissingTitle"
	| "noGatewayConfigured"
	| "stripeUseCardForm"
	| "paymentFailed"
	| "paymentTryAgain"
	| "paymentWebhookFailed"
	| "paymentInitFailed";

type GatewayTranslator = (key: GatewayMessageKey, values?: Record<string, string>) => string;

/** Builds gateway copy from `checkout.gateways` — shared by client hooks and server actions. */
export function buildCheckoutGatewayMessages(t: GatewayTranslator): CheckoutGatewayMessages {
	return {
		unsupported: t("unsupported"),
		dummyMissingBody: t("dummyMissingBody"),
		noneTitle: t("noneTitle"),
		noneBody: t("noneBody"),
		unsupportedTitle: t("unsupportedTitle"),
		dummyMissingTitle: t("dummyMissingTitle"),
		noGatewayConfigured: t("noGatewayConfigured"),
		stripeUseCardForm: t("stripeUseCardForm"),
		paymentFailed: t("paymentFailed"),
		paymentTryAgain: t("paymentTryAgain"),
		paymentWebhookFailed: t("paymentWebhookFailed"),
		paymentInitFailed: t("paymentInitFailed"),
	};
}

export function formatGatewayList(gateways: ReadonlyArray<GatewayLike> | null | undefined): string {
	return (gateways ?? []).map((gateway) => `${gateway.name ?? gateway.id} (${gateway.id})`).join(", ");
}

// ---------------------------------------------------------------------------
// Payment-lib message registry (krok 2A i18n)
//
// Plain (non-hook) payment libs — the transport fallback, the Stripe transaction
// formatters, `update-billing` and the checkoutComplete error mapper — cannot call
// next-intl hooks. `useCheckoutPaymentMessages` installs the translated copy here
// on render (module-level coordination, same style as `setCheckoutTransport`);
// every pay/billing flow mounts that hook via the payment step before any of these
// libs can run.
// ---------------------------------------------------------------------------

/** Copy needed by plain payment libs — catalog keys live under `checkout.payment.*`. */
export type CheckoutPaymentLibMessages = {
	/** `checkout.payment.billingSaveFailed` */
	billingSaveFailed: string;
	/** `checkout.payment.invalidValue` */
	invalidValue: string;
	/** `checkout.payment.gatewayInitFailed` */
	gatewayInitFailed: string;
	/** `checkout.payment.stripeWebhookFailed` */
	stripeWebhookFailed: string;
	/** `checkout.payment.stripeProcessFailed` */
	stripeProcessFailed: string;
	/** `checkout.payment.failed` */
	paymentFailed: string;
	/** `checkout.payment.notFullyPaid` */
	notFullyPaid: string;
	/** `checkout.payment.alreadyCompleted` */
	alreadyCompleted: string;
	/** `checkout.payment.freeOrderTotalChanged` */
	freeOrderTotalChanged: string;
};

/**
 * EN-source safety net mirroring the `checkout.payment.*` catalog — used only if a payment
 * lib somehow runs before `useCheckoutPaymentMessages` mounted (not reachable through
 * the checkout UI). English because it is the catalog source language (never a market-
 * specific fallback); a vitest test asserts these stay in sync with
 * `src/i18n/messages/en-US.json`.
 */
const FALLBACK_PAYMENT_LIB_MESSAGES: CheckoutPaymentLibMessages = {
	billingSaveFailed: "The billing address could not be saved.",
	invalidValue: "Invalid value",
	gatewayInitFailed: "Payment gateway initialization failed.",
	stripeWebhookFailed: "The payment could not be processed right now. Please try again in a moment.",
	stripeProcessFailed: "The payment could not be processed. Please try again.",
	paymentFailed: "Payment failed",
	notFullyPaid:
		"The payment does not yet cover the full order total. Refresh the page — if the funds were authorized, complete the order using the button below. Do not pay again until the status is confirmed.",
	alreadyCompleted: "This order has already been placed. You will find the confirmation in your email.",
	freeOrderTotalChanged:
		"Your order total has changed and now requires payment. Please review and try again.",
};

let registeredPaymentLibMessages: CheckoutPaymentLibMessages | null = null;

/** Installed by `useCheckoutPaymentMessages` so plain payment libs resolve translated copy. */
export function registerCheckoutPaymentLibMessages(messages: CheckoutPaymentLibMessages): void {
	registeredPaymentLibMessages = messages;
}

/** Translated payment-lib copy when the hook has registered; sk-SK fallback otherwise. */
export function getCheckoutPaymentLibMessages(): CheckoutPaymentLibMessages {
	return registeredPaymentLibMessages ?? FALLBACK_PAYMENT_LIB_MESSAGES;
}

/**
 * Shown when only unsupported production gateways are available on the checkout.
 * The customer sees generic customer-safe copy; the concrete gateway list (names + raw
 * ids) is diagnostic detail and goes to the console only.
 */
export function getUnsupportedGatewayMessage(
	gateways: ReadonlyArray<GatewayLike> | null | undefined,
	messages: CheckoutGatewayMessages,
): string {
	const listed = formatGatewayList(gateways);
	if (listed) {
		console.error(`[checkout] Unsupported payment gateways for this storefront: ${listed}`);
	}
	return messages.unsupported;
}

const FAILED_TRANSACTION_EVENT_TYPES = new Set([
	"AUTHORIZATION_FAILURE",
	"AUTHORIZATION_ADJUSTMENT_FAILURE",
	"CHARGE_FAILURE",
	"REFUND_FAILURE",
	"CANCEL_FAILURE",
]);

type TransactionInitializePayload =
	| {
			errors?: ReadonlyArray<{ message?: string | null }> | null;
			transactionEvent?: { type?: string | null; message?: string | null } | null;
			transaction?: { id?: string | null } | null;
	  }
	| null
	| undefined;

/** Returns a user-facing message when transactionInitialize did not succeed. */
export function getTransactionInitializeError(
	payload: TransactionInitializePayload,
	messages: CheckoutGatewayMessages,
): string | null {
	const errors = payload?.errors;
	if (errors?.length) {
		return errors[0]?.message || messages.paymentFailed;
	}

	const eventType = payload?.transactionEvent?.type;
	const eventMessage = payload?.transactionEvent?.message;

	if (eventType && FAILED_TRANSACTION_EVENT_TYPES.has(eventType)) {
		if (eventMessage?.toLowerCase().includes("failed to delivery request")) {
			console.error(`[checkout] Payment app webhook delivery failed (${eventType}): ${eventMessage}`);
			return messages.paymentWebhookFailed;
		}

		return eventMessage || messages.paymentFailed;
	}

	if (!payload?.transaction?.id) {
		return messages.paymentInitFailed;
	}

	return null;
}
