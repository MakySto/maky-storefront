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

const BILLING_UPDATE_FAILED_MESSAGE = "Nepodarilo sa uložiť fakturačnú adresu.";

/**
 * Next.js implementation of `CheckoutTransport`: each method is a server action, so
 * the server-side gateway guards and the amount-tamper re-verify keep running
 * server-side unchanged (MAKY variant C — actions live in `@/checkout/lib/actions`,
 * there is no `(checkout)` route group).
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
			return { ok: false, error: BILLING_UPDATE_FAILED_MESSAGE };
		}

		return { ok: true, checkout };
	},
	initializePaymentGateways: initializePaymentGatewaysAction,
	initializeTransaction: initializeCheckoutTransactionAction,
	processTransaction: processCheckoutTransactionAction,
	completeCheckout: runCheckoutCompleteAction,
};
