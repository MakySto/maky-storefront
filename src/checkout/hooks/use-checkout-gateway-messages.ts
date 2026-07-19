"use client";

import { useMemo } from "react";

import { buildCheckoutGatewayMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * User-facing payment gateway alerts and pay-flow errors.
 *
 * MAKY (D1/B.7): hardcoded SK maps instead of upstream's next-intl `checkout.gateways`
 * namespace — same export name + path, so a later i18n pass swaps the body for
 * next-intl without touching consumers. Copy translated to Slovak (B.7).
 */
const EN_GATEWAY_MESSAGES: Record<string, string> = {
	noneTitle: "Platobná brána nie je nakonfigurovaná",
	noneBody:
		"Na prijímanie platieb nainštalujte platobnú aplikáciu (napr. Saleor Dummy Payment na testovanie alebo Stripe/Adyen pre produkciu) zo Saleor Dashboardu.",
	unsupportedTitle: "Nepodporovaná platobná brána",
	unsupportedList: "Táto pokladňa nepodporuje dostupné platobné brány: {gateways}.",
	unsupportedEmpty: "Pre túto pokladňu nie je dostupná žiadna podporovaná platobná brána.",
	dummyMissingTitle: "Aplikácia Dummy Payment nie je pre túto pokladňu dostupná",
	dummyMissingBody:
		"Aplikácia Dummy Payment je nainštalovaná, ale pre túto pokladňu nie je dostupná. V Saleor Dashboarde skontrolujte, či je aplikácia aktívna, či sa webhooky doručujú úspešne a či je mena pokladne podporovaná (USD pre hostovanú aplikáciu).",
	noGatewayConfigured:
		"Platobná brána nie je nakonfigurovaná. Kontaktujte podporu alebo nakonfigurujte platobnú aplikáciu v Saleore.",
	stripeUseCardForm:
		"Platba cez Stripe prebieha vo formulári karty. Dokončite platbu v sekcii platby Stripe vyššie.",
	paymentFailed: "Platba zlyhala",
	paymentTryAgain: "Platba zlyhala. Skúste to znova.",
	paymentWebhookFailed:
		"Webhook platobnej aplikácie zlyhal. V Saleor Dashboard → Apps → Dummy Payment App skontrolujte, či sa webhooky doručujú úspešne.",
	paymentInitFailed: "Platbu sa nepodarilo inicializovať. Skontrolujte, či platobná aplikácia v Saleore beží.",
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
