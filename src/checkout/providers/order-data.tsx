"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

import type { ServerOrder } from "@/checkout/lib/checkout-types";

export type OrderDataContextValue = {
	order: ServerOrder | null;
	orderId: string | null;
};

const OrderDataContext = createContext<OrderDataContextValue | null>(null);

type OrderDataProviderProps = {
	orderId: string | null;
	initialOrder: ServerOrder | null;
	children: ReactNode;
};

/**
 * Server-hydrated order for the `/checkout/complete` route (Track B.4.3). Read-only: holds the
 * order fetched server-side by the RSC route — NO checkout/cart state, no fetching. Replaces the
 * browser-side urql `useOrderQuery`.
 */
export function OrderDataProvider({ orderId, initialOrder, children }: OrderDataProviderProps) {
	const value = useMemo<OrderDataContextValue>(
		() => ({ order: initialOrder, orderId }),
		[initialOrder, orderId],
	);

	return <OrderDataContext.Provider value={value}>{children}</OrderDataContext.Provider>;
}

export function useOrderData(): OrderDataContextValue {
	const context = use(OrderDataContext);
	if (!context) {
		throw new Error("useOrderData must be used within <OrderDataProvider>");
	}
	return context;
}
