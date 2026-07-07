import { useEffect, useRef } from "react";

import { useCheckout } from "@/checkout/hooks/use-checkout";
import { useUser } from "@/checkout/hooks/use-user";
import { checkoutCustomerAttachAction } from "@/checkout/lib/actions";

/**
 * Attaches the logged-in customer to the checkout once, via a server action (replaces the urql
 * `useCheckoutCustomerAttachMutation`). Runs when the user is authenticated and the checkout has
 * no user yet, then refetches to sync the attached user (also recovers from "already attached").
 */
export const useCustomerAttach = () => {
	const { checkout, refetch } = useCheckout();
	const { authenticated } = useUser();
	const hasRunRef = useRef(false);

	const checkoutId = checkout?.id;
	const checkoutUserId = checkout?.user?.id;
	const shouldSkip = !!checkoutUserId || !authenticated || !checkoutId;

	useEffect(() => {
		if (shouldSkip || hasRunRef.current || !checkoutId) {
			return;
		}
		hasRunRef.current = true;
		void checkoutCustomerAttachAction({ checkoutId }).then(() => {
			void refetch();
		});
	}, [checkoutId, authenticated, shouldSkip, refetch]);
};
