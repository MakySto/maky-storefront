import { type PaymentGatewayLike } from "../types";

/** Known Saleor Dummy Payment app IDs (legacy + current). */
export const DUMMY_GATEWAY_IDS = ["saleor.io.dummy-payment-app", "mirumee.payments.dummy"] as const;

/**
 * Guard sentinel (non-linguistic error code) when dummy payment is blocked in this
 * environment. The customer-facing copy is the `checkout.errors.testPaymentUnavailable`
 * catalog key — callers translate at the boundary; never render this code to customers.
 */
export const DUMMY_PAYMENT_NOT_ALLOWED_MESSAGE = "test_payment_unavailable";

export function isDummyGateway(gateway: PaymentGatewayLike): boolean {
	return (DUMMY_GATEWAY_IDS as readonly string[]).includes(gateway.id);
}

export function findDummyGateway(
	gateways: ReadonlyArray<PaymentGatewayLike> | null | undefined,
): PaymentGatewayLike | undefined {
	return gateways?.find(isDummyGateway);
}

/**
 * Dummy Payment is for local/staging test checkouts only.
 * Enabled in development, or when ALLOW_DUMMY_PAYMENT / NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT is true.
 */
export function isDummyPaymentAllowed(): boolean {
	if (process.env.ALLOW_DUMMY_PAYMENT === "true") {
		return true;
	}
	if (process.env.NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT === "true") {
		return true;
	}
	return process.env.NODE_ENV === "development";
}

/**
 * Server-side guard for transactionInitialize — blocks dummy gateways in production
 * even when callers bypass the checkout UI (e.g. direct server action invocation).
 */
export function getDummyPaymentGuardError(gatewayId: string | null | undefined): string | null {
	if (!gatewayId || !isDummyGateway({ id: gatewayId, name: "" })) {
		return null;
	}
	if (isDummyPaymentAllowed()) {
		return null;
	}
	return DUMMY_PAYMENT_NOT_ALLOWED_MESSAGE;
}
