import { useOrderData } from "@/checkout/providers/order-data";

/**
 * Order for the confirmation route from the RSC-hydrated context (Track B.4.3) — replaces the
 * browser-side urql `useOrderQuery`. The order is fetched server-side by the `/checkout/complete`
 * route; `loading` is always false on the client.
 */
export const useOrder = () => {
	const { order } = useOrderData();

	return { order, loading: false };
};
