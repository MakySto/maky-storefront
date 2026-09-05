"use server";

/**
 * Adding a configured set to the cart.
 *
 * This does NOT reimplement the cart. It re-checks what the client is not allowed to
 * assert, then hands off to the existing `addListingItemToCart`, which owns
 * `Checkout.findOrCreate`, the `checkoutLinesAdd` mutation and the checkout cookie
 * (CLAUDE.md §10 — checkout and cart logic are not ours to change).
 *
 * What it adds is the part the existing action deliberately does not do:
 *
 *   - It re-verifies, server-side, that the exact variant is published and purchasable
 *     in this channel. Between rendering the configurator and pressing the button a
 *     product can be unpublished or sold out.
 *   - It returns a result. `addListingItemToCart` returns void and swallows every
 *     failure into `console.error`, so a UI built on it alone cannot tell success from
 *     silence. A configurator that says "added" when nothing was added is worse than one
 *     that cannot add at all.
 *
 * Price and the fitment claim itself are never taken from the client. The variant id is,
 * but it is only ever used to look the product up again — it cannot introduce a product
 * that Saleor does not already publish in this channel.
 */

import { addListingItemToCart } from "@/ui/components/plp/actions";
import { verifyPurchasable } from "./offers";

export type AddSetResult =
	| { ok: true }
	| { ok: false; reason: "unavailable" | "lookup-failed" | "invalid-input" };

export async function addConfiguredSetToCart(input: {
	channel: string;
	saleorProductId: string;
	saleorVariantId: string;
}): Promise<AddSetResult> {
	const { channel, saleorProductId, saleorVariantId } = input;
	if (!channel || !saleorProductId || !saleorVariantId) return { ok: false, reason: "invalid-input" };

	const check = await verifyPurchasable(saleorProductId, saleorVariantId, channel);
	if (!check.ok) {
		return { ok: false, reason: check.reason === "lookup-failed" ? "lookup-failed" : "unavailable" };
	}

	// Out of stock is a real "cannot buy this", and Saleor's own line mutation would
	// report it as a domain error the existing action does not inspect. Catch it here,
	// where there is somewhere to show it.
	if (check.offer.quantityAvailable !== null && check.offer.quantityAvailable < 1) {
		return { ok: false, reason: "unavailable" };
	}

	const formData = new FormData();
	formData.set("channel", channel);
	formData.set("variantId", saleorVariantId);
	formData.set("quantity", "1");

	await addListingItemToCart(formData);
	return { ok: true };
}
