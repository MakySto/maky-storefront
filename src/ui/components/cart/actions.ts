"use server";

import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";
import { CheckoutDeleteLinesDocument, CheckoutLinesUpdateDocument } from "@/gql/graphql";
import * as Checkout from "@/lib/checkout";

export type CartMutationResult = { ok: true } | { ok: false };

/**
 * `channel` is the Saleor slug, and it is required because the paths these
 * mutations invalidate are market-prefixed. See `revalidateCart`.
 */
export async function deleteCartLine(
	channel: string,
	checkoutId: string,
	lineId: string,
): Promise<CartMutationResult> {
	const result = await executeAuthenticatedGraphQL(CheckoutDeleteLinesDocument, {
		variables: {
			checkoutId,
			lineIds: [lineId],
		},
		cache: "no-cache",
	});

	if (!result.ok) return { ok: false };

	const payload = result.data.checkoutLinesDelete;
	if (!payload?.checkout || payload.errors.length > 0) return { ok: false };

	// If cart is now empty, clear the checkout cookie to start fresh next time
	// only when it still points at this checkout. A delayed action from another
	// tab must not erase a newer cart that has replaced it in the meantime.
	if (payload.checkout.lines.length === 0) {
		await Checkout.clearCheckoutCookieByValue(checkoutId);
	}

	revalidateCart(channel);
	return { ok: true };
}

export async function updateCartLineQuantity(
	channel: string,
	checkoutId: string,
	lineId: string,
	quantity: number,
): Promise<CartMutationResult> {
	if (quantity < 1) {
		return deleteCartLine(channel, checkoutId, lineId);
	}

	const result = await executeAuthenticatedGraphQL(CheckoutLinesUpdateDocument, {
		variables: {
			checkoutId,
			lines: [{ lineId, quantity }],
		},
		cache: "no-cache",
	});

	if (!result.ok) return { ok: false };

	const payload = result.data.checkoutLinesUpdate;
	if (!payload?.checkout || payload.errors.length > 0) return { ok: false };

	revalidateCart(channel);
	return { ok: true };
}

/**
 * Invalidate the cart page and the chrome that shows its badge.
 *
 * This used to be `revalidatePath("/cart")` plus `revalidatePath("/")`, and
 * neither has ever matched anything. The cart lives at `/sk/kosik`, which the
 * proxy rewrites to `/sk-eur/cart` — a market-less `/cart` is a different,
 * non-existent route, so every line removal and quantity change left the cart
 * page serving its cached copy.
 */
function revalidateCart(channel: string) {
	revalidateStorefrontBrowsePath(channel, "/cart");
	revalidateStorefrontChrome(channel);
}
