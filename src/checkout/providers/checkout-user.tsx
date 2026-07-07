"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

import type { CheckoutUser } from "@/checkout/lib/checkout-types";

export type CheckoutUserContextValue = {
	user: CheckoutUser | null;
	authenticated: boolean;
};

const CheckoutUserContext = createContext<CheckoutUserContextValue | null>(null);

type CheckoutUserProviderProps = {
	initialUser: CheckoutUser | null;
	children: ReactNode;
};

/**
 * Holds the customer profile fetched server-side by the RSC loader (B.2 BFF auth path).
 * Replaces the browser-side urql `useUserQuery`.
 */
export function CheckoutUserProvider({ initialUser, children }: CheckoutUserProviderProps) {
	const value = useMemo<CheckoutUserContextValue>(
		() => ({ user: initialUser, authenticated: !!initialUser?.id }),
		[initialUser],
	);

	return <CheckoutUserContext.Provider value={value}>{children}</CheckoutUserContext.Provider>;
}

export function useCheckoutUser(): CheckoutUserContextValue {
	const context = use(CheckoutUserContext);
	if (!context) {
		throw new Error("useCheckoutUser must be used within <CheckoutUserProvider>");
	}
	return context;
}
