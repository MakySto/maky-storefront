"use server";

import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";
import { CheckoutDeleteLinesDocument, CheckoutLinesUpdateDocument } from "@/gql/graphql";
import * as Checkout from "@/lib/checkout";
import { isCheckoutLockedCode } from "@/checkout/lib/b2b/contract";
import type { PromoCodeRefusal, PromoCodeRemoval } from "@/checkout/lib/promo-code";
import { addPromoCodeOnServer, removePromoCodeOnServer } from "@/checkout/lib/server/promo-code";
import { getLocaleFromChannel } from "@/config/locale";

/**
 * `payment-locked`: a payment for this checkout is in progress and the backend refuses to change its lines
 * (`B2B_CHECKOUT_LOCKED`, contract MAKY-B2B-V1 revision 2). A payment state, not a failed request: the customer is
 * offered the way out (end the payment, then change the cart) instead of "try again".
 */
export type CartMutationResult = { ok: true } | { ok: false; reason?: "payment-locked" };

function refusal(errors: ReadonlyArray<{ code?: unknown }>): CartMutationResult {
	return errors.some((error) => isCheckoutLockedCode(error.code))
		? { ok: false, reason: "payment-locked" }
		: { ok: false };
}

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
	if (payload?.errors.length) return refusal(payload.errors);
	if (!payload?.checkout) return { ok: false };

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
	if (payload?.errors.length) return refusal(payload.errors);
	if (!payload?.checkout) return { ok: false };

	revalidateCart(channel);
	return { ok: true };
}

/** A code from the cart page: `ok`, or the refusal with its sentence in the market's language. */
export type CartPromoCodeResult = { ok: true } | { ok: false; refusal: PromoCodeRefusal; message: string };

/**
 * A discount code or a gift card typed in the cart. The same Saleor call as in the checkout
 * (`checkout/lib/server/promo-code`); the cart page is a server render, so it is invalidated here.
 */
export async function applyCartPromoCode(
	channel: string,
	checkoutId: string,
	promoCode: string,
): Promise<CartPromoCodeResult> {
	const result = await addPromoCodeOnServer(checkoutId, promoCode, getLocaleFromChannel(channel));
	if (!result.ok) return { ok: false, refusal: result.refusal, message: result.message };
	revalidateCart(channel);
	return { ok: true };
}

export async function removeCartPromoCode(
	channel: string,
	checkoutId: string,
	removal: PromoCodeRemoval,
): Promise<CartPromoCodeResult> {
	const result = await removePromoCodeOnServer(checkoutId, removal, getLocaleFromChannel(channel));
	if (!result.ok) return { ok: false, refusal: result.refusal, message: result.message };
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
