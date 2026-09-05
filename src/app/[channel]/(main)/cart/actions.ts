"use server";

import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";
import { CheckoutDeleteLinesDocument } from "@/gql/graphql";
import * as Checkout from "@/lib/checkout";

type deleteLineFromCheckoutArgs = {
	lineId: string;
	checkoutId: string;
	/** Saleor slug. Required: the paths to invalidate are market-prefixed. */
	channel: string;
};

export const deleteLineFromCheckout = async ({ lineId, checkoutId, channel }: deleteLineFromCheckoutArgs) => {
	const result = await executeAuthenticatedGraphQL(CheckoutDeleteLinesDocument, {
		variables: {
			checkoutId,
			lineIds: [lineId],
		},
		cache: "no-cache",
	});

	// If cart is now empty, clear the checkout cookie to start fresh next time
	if (result.ok) {
		const checkout = result.data.checkoutLinesDelete?.checkout;
		if (checkout && checkout.lines.length === 0) {
			await Checkout.clearCheckoutCookie(checkout.channel.slug);
		}
	}

	// Was `revalidatePath("/cart")`, which has never matched anything: the cart
	// lives at `/sk/cart`, rewritten by the proxy to `/sk-eur/cart`, so a
	// market-less `/cart` is a different and non-existent route. Removing a line
	// left this very page serving its cached copy.
	revalidateStorefrontBrowsePath(channel, "/cart");
	revalidateStorefrontChrome(channel);
};
