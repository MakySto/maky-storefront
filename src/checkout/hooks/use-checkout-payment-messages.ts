"use client";

import { useMemo } from "react";

/**
 * User-facing payment copy for checkout pay flows.
 *
 * MAKY (D1): hardcoded EN map instead of upstream's next-intl `checkout.payment`
 * namespace — same export name + path, so B.7 swaps the body for next-intl without
 * touching consumers. Copy is verbatim upstream `messages/en.json`.
 */
export function useCheckoutPaymentMessages() {
	return useMemo(
		() => ({
			unavailable: "Payment system is not available. Please try again.",
			initFailed: "Failed to initialize payment system.",
			loadingGateway: (gateway: string) => `Loading ${gateway} payment form…`,
			confirmingPayment: "Confirming your payment…",
			doNotClose: "Please don't close or refresh this page.",
			completeOrderFailed: "Could not complete your order. Please try again.",
			placeOrderFailed: "Could not place your order. Please try again or contact support.",
			totalsRefreshFailed: "Could not refresh checkout totals. Please try again.",
			totalUnavailable: "Checkout total is unavailable. Please refresh the page and try again.",
			currencyUnavailable: "Checkout currency is unavailable. Please refresh the page and try again.",
			validationFailed: "Payment validation failed",
			totalChanged: "Order total changed. Review the updated amount and try again.",
			unexpectedError: "An unexpected error occurred while completing your payment.",
			dummyGateway: "Dummy Payment",
			failed: "Payment failed",
			freeOrderBody: (total: string) =>
				`Your order total is ${total}. No payment is required — confirm below to place your order.`,
			dummyTestMode: "Test mode. No card details needed — use Pay to complete a test order.",
		}),
		[],
	);
}

export type CheckoutPaymentMessages = ReturnType<typeof useCheckoutPaymentMessages>;
