"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { buildCheckoutGatewayMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * User-facing payment gateway alerts and pay-flow errors.
 *
 * Copy lives in the next-intl catalog under `checkout.payment.gateways.*`
 * (krok 2A) — same export name + path as the earlier hardcoded-SK map, so
 * consumers are untouched by the i18n swap.
 */
export function useCheckoutGatewayMessages() {
	const t = useTranslations("checkout.payment.gateways");

	return useMemo(() => buildCheckoutGatewayMessages((key, values) => t(key, values)), [t]);
}

export type CheckoutGatewayMessagesHook = ReturnType<typeof useCheckoutGatewayMessages>;
