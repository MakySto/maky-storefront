import { useCheckoutUser } from "@/checkout/providers/checkout-user";

/**
 * Customer from the RSC-hydrated context (replaces the urql `useUserQuery`). The user is fetched
 * server-side by the RSC loader (B.2 BFF auth path); `loading` is always false on the client.
 */
export const useUser = () => {
	const { user, authenticated } = useCheckoutUser();

	return { user, loading: false, authenticated };
};
