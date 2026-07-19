import {
	checkoutBillingAddressUpdateAction,
	initializeCheckoutTransactionAction,
	initializePaymentGatewaysAction,
	processCheckoutTransactionAction,
	refreshCheckoutAction,
	runCheckoutCompleteAction,
} from "@/checkout/lib/actions";
import type { CheckoutActionResult } from "@/checkout/lib/checkout-action-types";
import type { CheckoutTransport } from "@/checkout/lib/checkout-transport";
import { getCheckoutPaymentLibMessages } from "@/checkout/lib/payment/gateway-messages";

/**
 * Next.js implementation of `CheckoutTransport`: each method is a server action, so
 * the server-side gateway guards and the amount-tamper re-verify keep running
 * server-side unchanged (MAKY variant C — actions live in `@/checkout/lib/actions`,
 * there is no `(checkout)` route group).
 *
 * i18n (krok 2A): the `CheckoutTransport` interface carries no locale, so the payment
 * actions fall back to the market cookie server-side; the client-side billing fallback
 * below resolves via the payment-lib message registry. Saleor GraphQL error messages
 * (`result.error.message`, per-field `errors[].message`) pass through untranslated —
 * known gap, tracked for the translation-bundle step.
 *
 * D3 (approved): the upstream `saveAddress` flag is DROPPED — MAKY's
 * `checkoutBillingAddressUpdate` mutation has no `$saveAddress` variable, so billing
 * addresses are not persisted to the customer address book (matches pre-B.4.4
 * behavior; guests unaffected). Re-orderable into B.4.5/B.7 via a mutation change.
 */
export const nextCheckoutTransport: CheckoutTransport = {
	fetchCheckout: refreshCheckoutAction,
	updateBillingAddress: async ({ checkoutId, billingAddress }): Promise<CheckoutActionResult> => {
		const result = await checkoutBillingAddressUpdateAction({ checkoutId, billingAddress });

		if (result.error) {
			return { ok: false, error: result.error.message };
		}

		const payload = result.data?.checkoutBillingAddressUpdate;
		if (payload?.errors?.length) {
			return {
				ok: false,
				fieldErrors: payload.errors.map((error) => ({
					field: error.field,
					message: error.message,
					code: error.code,
				})),
			};
		}

		const checkout = payload?.checkout;
		if (!checkout) {
			return { ok: false, error: getCheckoutPaymentLibMessages().billingSaveFailed };
		}

		return { ok: true, checkout };
	},
	initializePaymentGateways: initializePaymentGatewaysAction,
	initializeTransaction: initializeCheckoutTransactionAction,
	processTransaction: processCheckoutTransactionAction,
	completeCheckout: runCheckoutCompleteAction,
};
