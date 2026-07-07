import { type Checkout } from "@/checkout/graphql";
import { useCheckoutData } from "@/checkout/providers/checkout-data";

/**
 * Live checkout from the RSC-hydrated context (replaces the urql `useCheckoutQuery`).
 *
 * There is no urql client in the checkout runtime: the checkout is fetched server-side by the
 * RSC loader and seeded into `CheckoutDataProvider`. `fetching` is always false (data is present
 * on first paint); `refetch` re-reads from Saleor via a server action.
 */
export const useCheckout = ({ pause = false }: { pause?: boolean } = {}) => {
	void pause; // retained for call-site compatibility; there is no query to pause
	const { checkout, hasCheckoutId, refreshCheckout } = useCheckoutData();

	return {
		// Cast to the broad schema `Checkout` type (as the legacy urql hook did): the RSC query
		// returns the `...CheckoutFragment` selection, which the views consume as `CheckoutFragment`
		// and which exposes `user` for the customer-attach flow. The composer null-guards before
		// rendering steps, so the non-null type matches the render contract.
		checkout: checkout as Checkout,
		fetching: false,
		refetch: refreshCheckout,
		hasCheckoutId,
	};
};
