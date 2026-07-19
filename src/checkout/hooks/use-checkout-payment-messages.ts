"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { registerCheckoutPaymentLibMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * User-facing payment copy for checkout pay flows.
 *
 * Copy lives in the next-intl catalog under `checkout.payment.*` (krok 2A) —
 * same export name + path as the earlier hardcoded-SK map, so consumers are
 * untouched by the i18n swap. As a side effect the hook installs the subset the
 * plain payment libs need (transport fallback, Stripe formatters, billing update,
 * checkoutComplete error mapping) into the module-level registry in
 * `@/checkout/lib/payment/gateway-messages`.
 */
export function useCheckoutPaymentMessages() {
	const t = useTranslations("checkout.payment");

	return useMemo(() => {
		const messages = {
			unavailable: t("unavailable"),
			initFailed: t("initFailed"),
			loadingGateway: (gateway: string) => t("loadingGateway", { gateway }),
			loadingTotal: t("loadingTotal"),
			confirmingPayment: t("confirmingPayment"),
			doNotClose: t("doNotClose"),
			completeOrderFailed: t("completeOrderFailed"),
			placeOrderFailed: t("placeOrderFailed"),
			totalsRefreshFailed: t("totalsRefreshFailed"),
			totalUnavailable: t("totalUnavailable"),
			currencyUnavailable: t("currencyUnavailable"),
			validationFailed: t("validationFailed"),
			totalChanged: t("totalChanged"),
			unexpectedError: t("unexpectedError"),
			securingWithStripe: t("securingWithStripe"),
			methodRequired: t("methodRequired"),
			detailsUnavailable: t("detailsUnavailable"),
			expressReset: t("expressReset"),
			formReset: t("formReset"),
			bankDeclined: t("bankDeclined"),
			sessionExpired: t("sessionExpired"),
			channelUnresolved: t("channelUnresolved"),
			stripeConfigFailed: t("stripeConfigFailed"),
			stripeKeyMissing: t("stripeKeyMissing"),
			stripeLoadTitle: t("stripeLoadTitle"),
			interruptedBeforeCharge: t("interruptedBeforeCharge"),
			interruptedAfterAuthorize: t("interruptedAfterAuthorize"),
			verificationUnavailable: t("verificationUnavailable"),
			authorizedTitle: t("authorizedTitle"),
			authorizedBody: t("authorizedBody"),
			dummyGateway: t("dummyGateway"),
			failed: t("failed"),
			freeOrderBody: (total: string) => t("freeOrderBody", { total }),
			dummyTestMode: t("dummyTestMode"),
			gatewayInitFailed: t("gatewayInitFailed"),
			stripeWebhookFailed: t("stripeWebhookFailed"),
			stripeProcessFailed: t("stripeProcessFailed"),
			billingSaveFailed: t("billingSaveFailed"),
			invalidValue: t("invalidValue"),
			notFullyPaid: t("notFullyPaid"),
			alreadyCompleted: t("alreadyCompleted"),
			freeOrderTotalChanged: t("freeOrderTotalChanged"),
		};

		// Render-phase registration is deliberate (idempotent assignment): the plain libs
		// only run from user-triggered event handlers / post-mount effects, which cannot
		// fire before the payment UI (and therefore this hook) has rendered.
		registerCheckoutPaymentLibMessages({
			billingSaveFailed: messages.billingSaveFailed,
			invalidValue: messages.invalidValue,
			gatewayInitFailed: messages.gatewayInitFailed,
			stripeWebhookFailed: messages.stripeWebhookFailed,
			stripeProcessFailed: messages.stripeProcessFailed,
			paymentFailed: messages.failed,
			notFullyPaid: messages.notFullyPaid,
			alreadyCompleted: messages.alreadyCompleted,
			freeOrderTotalChanged: messages.freeOrderTotalChanged,
		});

		return messages;
	}, [t]);
}

export type CheckoutPaymentMessages = ReturnType<typeof useCheckoutPaymentMessages>;
