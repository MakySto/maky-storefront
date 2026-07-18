"use client";

import { useMemo } from "react";

import { buildCheckoutGatewayMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * User-facing payment gateway alerts and pay-flow errors.
 *
 * MAKY (D1): hardcoded EN maps instead of upstream's next-intl `checkout.gateways`
 * namespace — same export name + path, so B.7 swaps the body for next-intl without
 * touching consumers. Copy is verbatim upstream `messages/en.json`.
 */
const EN_GATEWAY_MESSAGES: Record<string, string> = {
	noneTitle: "No payment gateway configured",
	noneBody:
		"To accept payments, install a payment app (like Saleor Dummy Payment for testing, or Stripe/Adyen for production) from the Saleor Dashboard.",
	unsupportedTitle: "Unsupported payment gateway",
	unsupportedList: "This checkout does not support the available payment gateway(s): {gateways}.",
	unsupportedEmpty: "No supported payment gateway is available for this checkout.",
	dummyMissingTitle: "Dummy Payment not available on this checkout",
	dummyMissingBody:
		"Dummy Payment App is installed, but it is not available for this checkout. In Saleor Dashboard, check the app is active, webhooks are delivering successfully, and the checkout currency is supported (USD for the hosted app).",
	noGatewayConfigured:
		"No payment gateway configured. Please contact support or configure a payment app in Saleor.",
	stripeUseCardForm:
		"Stripe payment is handled by the card form. Complete payment using the Stripe payment section above.",
	paymentFailed: "Payment failed",
	paymentTryAgain: "Payment failed. Please try again.",
	paymentWebhookFailed:
		"Payment app webhook failed. In Saleor Dashboard → Apps → Dummy Payment App, check webhook deliveries are succeeding.",
	paymentInitFailed: "Payment could not be initialized. Check that the payment app is running in Saleor.",
};

function translate(key: string, values?: Record<string, string>): string {
	let message = EN_GATEWAY_MESSAGES[key] ?? key;
	if (values) {
		for (const [name, value] of Object.entries(values)) {
			message = message.replace(`{${name}}`, value);
		}
	}
	return message;
}

export function useCheckoutGatewayMessages() {
	return useMemo(() => buildCheckoutGatewayMessages(translate), []);
}

export type CheckoutGatewayMessagesHook = ReturnType<typeof useCheckoutGatewayMessages>;
