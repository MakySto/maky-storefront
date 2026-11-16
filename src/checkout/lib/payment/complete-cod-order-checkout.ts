import { type AddressFragment, type CheckoutFragment } from "@/checkout/graphql";
import { type BillingAddressData } from "@/checkout/components/payment";
import { codOffer, isWithinCodMax } from "@/checkout/lib/cod";
import { getCheckoutPayAmount } from "@/checkout/lib/payment/checkout-pay-amount";
import { getCheckoutPaymentLibMessages } from "@/checkout/lib/payment/gateway-messages";
import { updateCheckoutBilling } from "@/checkout/lib/payment/update-billing";
import { finalizeCheckoutOrder } from "@/checkout/lib/payment/finalize-checkout-order";
import { type ServerCheckout } from "@/checkout/lib/checkout-types";

export type CompleteCodOrderCheckoutParams = {
	checkout: CheckoutFragment;
	billingData: BillingAddressData;
	sameAsBilling: boolean;
	hasShippingAddress: boolean;
	shippingAddress: AddressFragment | null | undefined;
	userAddresses: ReadonlyArray<AddressFragment> | undefined;
	authenticated: boolean;
	/** Company purchase: keep the billing address saved in the Information step (see `updateCheckoutBilling`). */
	preserveBilling?: boolean;
	refreshCheckout: (options?: { updateState?: boolean }) => Promise<ServerCheckout | null>;
};

export type CompleteCodOrderCheckoutResult =
	| { ok: true }
	| { ok: false; kind: "billing"; errors: Record<string, string>; focusField?: string }
	| { ok: false; kind: "complete"; error: string };

/**
 * Billing sync and `checkoutComplete` for an order paid on delivery (no card payment). The total the customer
 * confirmed is the one on screen: when the live checkout no longer matches it, or is no longer on cash on
 * delivery, nothing is ordered and the step shows the current state.
 */
export async function completeCodOrderCheckout({
	checkout,
	billingData,
	sameAsBilling,
	hasShippingAddress,
	shippingAddress,
	userAddresses,
	authenticated,
	preserveBilling,
	refreshCheckout,
}: CompleteCodOrderCheckoutParams): Promise<CompleteCodOrderCheckoutResult> {
	const shownAmount = getCheckoutPayAmount(checkout);
	const messages = getCheckoutPaymentLibMessages();
	if (shownAmount === null) {
		return { ok: false, kind: "complete", error: messages.codUnavailable };
	}

	const billingResult = await updateCheckoutBilling({
		checkoutId: checkout.id,
		sameAsBilling,
		hasShippingAddress,
		billingData,
		shippingAddress,
		userAddresses,
		authenticated,
		preserveBilling,
	});

	if (!billingResult.ok) {
		return { ok: false, kind: "billing", errors: billingResult.errors, focusField: billingResult.focusField };
	}

	const liveCheckout = await refreshCheckout({ updateState: false });
	const checkoutToComplete = liveCheckout ?? checkout;
	const offer = codOffer(checkoutToComplete);

	if (!offer?.selected || !isWithinCodMax(offer, getCheckoutPayAmount(checkoutToComplete))) {
		await refreshCheckout();
		return { ok: false, kind: "complete", error: messages.codUnavailable };
	}

	const completeResult = await finalizeCheckoutOrder(checkoutToComplete.id, checkoutToComplete.channel.slug, {
		expectedAmount: shownAmount,
	});

	if (!completeResult.ok) {
		// The server answered with a new quote or a changed company tax state: show it before the next click.
		if (completeResult.code === "TOTAL_CHANGED" || completeResult.code === "B2B_CONTEXT_CHANGED") {
			await refreshCheckout();
		}
		return { ok: false, kind: "complete", error: completeResult.error };
	}

	return { ok: true };
}
