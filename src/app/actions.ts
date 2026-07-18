"use server";

import { revalidateStorefrontChrome } from "@/lib/auth/revalidate-storefront-chrome";
import { getServerAuthClient } from "@/lib/auth/server";
import * as Checkout from "@/lib/checkout";

export async function logout() {
	"use server";
	(await getServerAuthClient()).signOut();
}

/** Bust cached storefront chrome (header user menu, cart badge, checkout shell) for a channel. */
export async function revalidateStorefrontChromeAction(channel: string) {
	"use server";
	revalidateStorefrontChrome(channel);
}

/**
 * Clear the checkout cookie after a successful order.
 * Call this after checkoutComplete succeeds.
 */
export async function clearCheckout(channel: string) {
	"use server";
	await Checkout.clearCheckoutCookie(channel);
}
