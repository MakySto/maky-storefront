"use client";

import { type FC } from "react";
import { type AddressFragment, type CheckoutFragment } from "@/checkout/graphql";
import { isIntegratedPaymentProvider, type ResolvedPaymentProvider } from "@/checkout/lib/payment";
import { type CheckoutPriceChangeNotice } from "@/checkout/lib/payment/checkout-pay-amount";
import { DummyPaymentPlaceholder } from "./dummy-payment-placeholder";
import { StripePaymentPlaceholder } from "./stripe-payment-placeholder";
import { type BillingAddressData } from "./billing-address-section";

export type IntegratedPaymentUiProps = {
	provider: ResolvedPaymentProvider;
	checkout?: CheckoutFragment;
	billing?: {
		billingData: BillingAddressData;
		sameAsBilling: boolean;
		hasShippingAddress: boolean;
		shippingAddress: AddressFragment | null | undefined;
		userAddresses: ReadonlyArray<AddressFragment> | undefined;
		authenticated: boolean;
	};
	onPaymentError?: (message: string) => void;
	onBillingErrors?: (errors: Record<string, string>, focusField?: string) => void;
	onPriceChangeNotice?: (notice: CheckoutPriceChangeNotice) => void;
	onPaymentActivityChange?: (active: boolean) => void;
};

/**
 * Renders UI for integrated payment providers.
 * Add new provider components here when wiring a Saleor payment app.
 *
 * MAKY (D5): the stripe case renders the inert `StripePaymentPlaceholder` — the real
 * `StripePayment` (Elements) tree is adopted in B.8. The billing/checkout/error props
 * are kept so the B.8 swap is a one-case change.
 */
export const IntegratedPaymentUi: FC<IntegratedPaymentUiProps> = ({ provider }) => {
	if (!isIntegratedPaymentProvider(provider)) {
		return null;
	}

	switch (provider.type) {
		case "dummy":
			return <DummyPaymentPlaceholder gatewayName={provider.gateway.name} />;
		case "stripe":
			return <StripePaymentPlaceholder gatewayName={provider.gateway.name} />;
	}
};
