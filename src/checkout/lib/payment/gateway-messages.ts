import { type PaymentGatewayFragment } from "@/checkout/graphql";

type GatewayLike = Pick<PaymentGatewayFragment, "id" | "name">;

export type CheckoutGatewayMessages = {
	unsupportedList: (gateways: string) => string;
	unsupportedEmpty: string;
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
	| "unsupportedList"
	| "unsupportedEmpty"
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
		unsupportedList: (gateways) => t("unsupportedList", { gateways }),
		unsupportedEmpty: t("unsupportedEmpty"),
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
 * sk-SK safety net mirroring the `checkout.payment.*` catalog — used only if a payment
 * lib somehow runs before `useCheckoutPaymentMessages` mounted (not reachable through
 * the checkout UI). Keep values in sync with `src/i18n/messages/sk-SK.json`.
 */
const FALLBACK_PAYMENT_LIB_MESSAGES: CheckoutPaymentLibMessages = {
	billingSaveFailed: "Nepodarilo sa uložiť fakturačnú adresu.",
	invalidValue: "Neplatná hodnota",
	gatewayInitFailed: "Inicializácia platobnej brány zlyhala.",
	stripeWebhookFailed:
		"Webhook aplikácie Stripe zlyhal. V Saleor Dashboard → Apps → Stripe skontrolujte, či sa webhooky doručujú úspešne.",
	stripeProcessFailed:
		"Platbu sa nepodarilo spracovať. Skontrolujte, či je aplikácia Stripe v Saleore aktívna.",
	paymentFailed: "Platba zlyhala",
	notFullyPaid:
		"Platba zatiaľ nepokrýva celú sumu objednávky. Obnovte stránku — ak boli prostriedky autorizované, použite tlačidlo „Objednať s povinnosťou platby“. Neplaťte znova, kým sa stav nepotvrdí.",
	alreadyCompleted: "Táto objednávka už bola odoslaná. Potvrdenie nájdete vo svojom e-maile.",
	freeOrderTotalChanged:
		"Celková cena objednávky sa zmenila a teraz vyžaduje platbu. Skontrolujte ju a skúste to znova.",
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

/** Shown when only unsupported production gateways are available on the checkout. */
export function getUnsupportedGatewayMessage(
	gateways: ReadonlyArray<GatewayLike> | null | undefined,
	messages: CheckoutGatewayMessages,
): string {
	const listed = formatGatewayList(gateways);
	return listed ? messages.unsupportedList(listed) : messages.unsupportedEmpty;
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
			return messages.paymentWebhookFailed;
		}

		return eventMessage || messages.paymentFailed;
	}

	if (!payload?.transaction?.id) {
		return messages.paymentInitFailed;
	}

	return null;
}
