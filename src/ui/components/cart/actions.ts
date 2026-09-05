"use server";

import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";
import { CheckoutDeleteLinesDocument, CheckoutLinesUpdateDocument } from "@/gql/graphql";
import * as Checkout from "@/lib/checkout";

/**
 * `channel` is the Saleor slug, and it is required because the paths these
 * mutations invalidate are market-prefixed. See `revalidateCart`.
 */
export async function deleteCartLine(channel: string, checkoutId: string, lineId: string) {
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

	revalidateCart(channel);
}

export async function updateCartLineQuantity(
	channel: string,
	checkoutId: string,
	lineId: string,
	quantity: number,
) {
	if (quantity < 1) {
		return deleteCartLine(channel, checkoutId, lineId);
	}

	await executeAuthenticatedGraphQL(CheckoutLinesUpdateDocument, {
		variables: {
			checkoutId,
			lines: [{ lineId, quantity }],
		},
		cache: "no-cache",
	});

	revalidateCart(channel);
}

/**
 * Invalidate the cart page and the chrome that shows its badge.
 *
 * This used to be `revalidatePath("/cart")` plus `revalidatePath("/")`, and
 * neither has ever matched anything. The cart lives at `/sk/cart`, which the
 * proxy rewrites to `/sk-eur/cart` — a market-less `/cart` is a different,
 * non-existent route, so every line removal and quantity change left the cart
 * page serving its cached copy.
 */
function revalidateCart(channel: string) {
	revalidateStorefrontBrowsePath(channel, "/cart");
	revalidateStorefrontChrome(channel);
}
