import { getCheckoutPaymentLibMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * Maps Saleor checkoutComplete errors to shopper-friendly copy
 * (`checkout.payment.notFullyPaid` / `checkout.payment.alreadyCompleted` via the
 * payment-lib message registry).
 *
 * Saleor completes checkout when authorizeStatus is FULL (authorized + charged
 * amounts cover the total). Capture at fulfillment is separate.
 */
export function formatCheckoutCompleteError(error: string): string {
	const messages = getCheckoutPaymentLibMessages();

	if (error.includes("CHECKOUT_NOT_FULLY_PAID")) {
		return messages.notFullyPaid;
	}

	if (error.includes("CHECKOUT_ALREADY_COMPLETED")) {
		return messages.alreadyCompleted;
	}

	return error;
}
