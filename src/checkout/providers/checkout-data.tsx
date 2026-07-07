"use client";

import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import { refreshCheckoutAction } from "@/checkout/lib/actions";
import type { CheckoutLoadState, ServerCheckout, ShippingCountries } from "@/checkout/lib/checkout-types";

export type { CheckoutLoadState };

export type CheckoutDataContextValue = {
	loadState: CheckoutLoadState;
	checkout: ServerCheckout | null;
	shippingCountries: ShippingCountries;
	hasCheckoutId: boolean;
	setCheckout: (checkout: ServerCheckout | null) => void;
	/** Re-read the checkout from Saleor (server action); returns null when missing/failed. */
	refreshCheckout: () => Promise<ServerCheckout | null>;
};

const CheckoutDataContext = createContext<CheckoutDataContextValue | null>(null);

type CheckoutDataProviderProps = {
	checkoutId: string | null;
	loadState: CheckoutLoadState;
	initialCheckout: ServerCheckout | null;
	shippingCountries: ShippingCountries;
	children: ReactNode;
};

/**
 * Holds the checkout snapshot loaded by the RSC checkout-session-loader and exposes a
 * server-action-backed refresh. Replaces the browser-side urql `useCheckoutQuery` — there is
 * no urql client in the checkout runtime.
 */
export function CheckoutDataProvider({
	checkoutId,
	loadState,
	initialCheckout,
	shippingCountries,
	children,
}: CheckoutDataProviderProps) {
	const [checkout, setCheckout] = useState<ServerCheckout | null>(initialCheckout);

	const refreshCheckout = useCallback(async (): Promise<ServerCheckout | null> => {
		if (!checkoutId) {
			return null;
		}

		const result = await refreshCheckoutAction(checkoutId);
		if (!result.ok || !result.checkout || result.checkout.id !== checkoutId) {
			return null;
		}

		setCheckout(result.checkout);
		return result.checkout;
	}, [checkoutId]);

	const value = useMemo<CheckoutDataContextValue>(
		() => ({
			loadState,
			checkout,
			shippingCountries,
			hasCheckoutId: !!checkoutId,
			setCheckout,
			refreshCheckout,
		}),
		[loadState, checkout, shippingCountries, checkoutId, refreshCheckout],
	);

	return <CheckoutDataContext.Provider value={value}>{children}</CheckoutDataContext.Provider>;
}

export function useCheckoutData(): CheckoutDataContextValue {
	const context = use(CheckoutDataContext);
	if (!context) {
		throw new Error("useCheckoutData must be used within <CheckoutDataProvider>");
	}
	return context;
}
