import { getCheckoutPaymentLibMessages } from "../gateway-messages";
import { type PaymentGatewayLike } from "../types";

/**
 * Saleor Stripe app gateway id (v2).
 * @see https://docs.saleor.io/developer/app-store/apps/stripe
 *
 * Verified against the live sk-eur checkout contract 2026-07-18:
 * availablePaymentGateways = [{ id: "saleor.app.payment.stripe", name: "Stripe",
 * currencies: ["EUR"], config: [] }]; paymentGatewayInitialize returns
 * { stripePublishableKey: "pk_test_…" }; transactionInitialize with
 * data.paymentIntent.paymentMethod returns data.paymentIntent.stripeClientSecret.
 * The id is the app manifest identifier (stable across app reinstalls), not the
 * installation-specific App global id. Full module restored in B.8 (was
 * predicates-only in B.4.4); user-facing copy hardcoded SK (B.7).
 */
export const STRIPE_GATEWAY_ID = "saleor.app.payment.stripe";

/**
 * Guard sentinel when Stripe is on the checkout but the storefront flag is off.
 * The customer-facing copy is the `checkout.errors.cardPaymentsDisabled` catalog key —
 * the guard's only production caller (`initializeCheckoutTransactionAction`) translates
 * at the boundary; this sk literal remains as the guard's non-null return contract.
 */
export const STRIPE_PAYMENT_NOT_ENABLED_MESSAGE = "Platby kartou nie sú v tomto prostredí povolené.";

/** Config returned by paymentGatewayInitialize for the Stripe app. */
export type StripeGatewayConfigData = {
	stripePublishableKey?: string;
};

export type StripeGatewayConfig = {
	id: string;
	data?: StripeGatewayConfigData | null;
};

export function isStripeGateway(gatewayId: string): boolean {
	return gatewayId === STRIPE_GATEWAY_ID;
}

export function findStripeGateway(
	gateways: ReadonlyArray<PaymentGatewayLike> | null | undefined,
): PaymentGatewayLike | undefined {
	return gateways?.find((gateway) => isStripeGateway(gateway.id));
}

/**
 * Stripe Elements checkout — opt-in via env (required on cloud/staging where NODE_ENV is production).
 * Publishable keys come from Saleor's paymentGatewayInitialize, not from env.
 */
export function isStripePaymentEnabled(): boolean {
	if (process.env.ENABLE_STRIPE_PAYMENTS === "true") {
		return true;
	}
	if (process.env.NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS === "true") {
		return true;
	}
	return process.env.NODE_ENV === "development";
}

/** Payment-step wallet buttons (Apple Pay / Google Pay / Link). Opt out with `false`. */
export function isStripeExpressCheckoutEnabled(): boolean {
	if (!isStripePaymentEnabled()) {
		return false;
	}

	if (process.env.NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT === "false") {
		return false;
	}

	return true;
}

/**
 * Server-side guard for transactionInitialize — blocks Stripe when the storefront flag is off.
 */
export function getStripePaymentGuardError(gatewayId: string | null | undefined): string | null {
	if (!gatewayId || !isStripeGateway(gatewayId)) {
		return null;
	}
	if (isStripePaymentEnabled()) {
		return null;
	}
	return STRIPE_PAYMENT_NOT_ENABLED_MESSAGE;
}

export function parseStripeGatewayConfig(data: unknown): StripeGatewayConfigData | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	const record = data as Record<string, unknown>;
	const publishableKey = record.stripePublishableKey;

	if (typeof publishableKey !== "string" || !publishableKey.trim()) {
		return null;
	}

	return { stripePublishableKey: publishableKey };
}

export type StripePaymentIntentData = {
	stripeClientSecret?: string;
};

export type StripeTransactionData = {
	paymentIntent?: StripePaymentIntentData;
};

export function parseStripeTransactionData(data: unknown): StripeTransactionData | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	const record = data as Record<string, unknown>;
	const paymentIntent = record.paymentIntent;

	if (!paymentIntent || typeof paymentIntent !== "object") {
		return null;
	}

	const intentRecord = paymentIntent as Record<string, unknown>;
	const clientSecret = intentRecord.stripeClientSecret;

	return {
		paymentIntent: {
			stripeClientSecret: typeof clientSecret === "string" ? clientSecret : undefined,
		},
	};
}

export function getStripeClientSecret(data: unknown): string | null {
	const parsed = parseStripeTransactionData(data);
	const secret = parsed?.paymentIntent?.stripeClientSecret;
	return secret?.trim() ? secret : null;
}

/**
 * How the shopper chose to pay — two Stripe surfaces, different signals.
 *
 * - **Express Checkout** (wallet buttons): `onConfirm.expressPaymentType` (`apple_pay`, `google_pay`, `link`, …).
 * - **Payment Element** (Pay button / card form): `onChange.value.type` and/or `elements.submit().selectedPaymentMethod`.
 *
 * Saleor's Stripe app expects `paymentIntent.paymentMethod` on `transactionInitialize`. The hosted app
 * rejects `"unknown"`; Stripe returns that for saved Link inside Payment Element while `onChange` still
 * reports `"link"`. Express wallets never go through `elements.submit()` for method detection.
 */
export type StripeInitializePaymentMethodContext =
	| {
			surface: "expressCheckout";
			expressPaymentType: string;
	  }
	| {
			surface: "paymentElement";
			/** PaymentElement `onChange` → `value.type` */
			changeType?: string | null;
			/** `elements.submit()` → `selectedPaymentMethod` */
			submitType?: string | null;
	  };

function normalizeStripePaymentMethodType(type: string | null | undefined): string | null {
	const normalized = type?.trim() || null;
	if (!normalized || normalized === "unknown") {
		return null;
	}
	return normalized;
}

/** Maps Stripe UI signals to Saleor `paymentIntent.paymentMethod`. Never returns `"unknown"`. */
export function resolveStripePaymentMethodForInitialize(
	context: StripeInitializePaymentMethodContext,
): string | null {
	if (context.surface === "expressCheckout") {
		return normalizeStripePaymentMethodType(context.expressPaymentType);
	}

	const fromChange = normalizeStripePaymentMethodType(context.changeType);
	if (fromChange) {
		return fromChange;
	}

	return normalizeStripePaymentMethodType(context.submitType);
}

const FAILED_TRANSACTION_EVENT_TYPES = new Set([
	"AUTHORIZATION_FAILURE",
	"AUTHORIZATION_ADJUSTMENT_FAILURE",
	"CHARGE_FAILURE",
	"REFUND_FAILURE",
	"CANCEL_FAILURE",
]);

/** Either outcome satisfies checkout when authorizeStatus becomes FULL. */
export const SUCCESSFUL_TRANSACTION_EVENT_TYPES = new Set([
	"AUTHORIZATION_SUCCESS",
	"AUTHORIZATION_ADJUSTMENT_SUCCESS",
	"CHARGE_SUCCESS",
	"CHARGE_BACK",
]);

type TransactionPayload = {
	errors?: ReadonlyArray<{ message?: string | null }> | null;
	transactionEvent?: { type?: string | null; message?: string | null } | null;
	transaction?: { id?: string | null } | null;
};

/** User-facing error when paymentGatewayInitialize did not return Stripe config. */
export function getPaymentGatewayInitializeError(
	payload: TransactionPayload | null | undefined,
): string | null {
	const errors = payload?.errors;
	if (errors?.length) {
		return errors[0]?.message || getCheckoutPaymentLibMessages().gatewayInitFailed;
	}
	return null;
}

/** User-facing error when transactionInitialize or transactionProcess did not succeed. */
export function getStripeTransactionError(payload: TransactionPayload | null | undefined): string | null {
	const initError = getPaymentGatewayInitializeError(payload);
	if (initError) {
		return initError;
	}

	const messages = getCheckoutPaymentLibMessages();
	const eventType = payload?.transactionEvent?.type;
	const eventMessage = payload?.transactionEvent?.message;

	if (eventType && FAILED_TRANSACTION_EVENT_TYPES.has(eventType)) {
		if (eventMessage?.toLowerCase().includes("failed to delivery request")) {
			return messages.stripeWebhookFailed;
		}

		return eventMessage || messages.paymentFailed;
	}

	if (!payload?.transaction?.id) {
		return messages.stripeProcessFailed;
	}

	return null;
}
