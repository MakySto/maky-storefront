"use server";

/**
 * Adding a configured set to the cart.
 *
 * This does NOT reimplement the cart. It re-establishes everything the client is not
 * allowed to assert, hands off to the existing `addListingItemToCart` — which owns
 * `Checkout.findOrCreate`, the `checkoutLinesAdd` mutation and the checkout cookie
 * (CLAUDE.md §10) — and then checks that the line actually arrived.
 *
 * Four things the first version got wrong, all of which ended in `{ ok: true }`:
 *
 *   1. It never re-read the active vehicle, so a set verified for the car the shopper
 *      had ten minutes ago could be added for the car they have now.
 *   2. It never re-checked fitment at all — the client's word was the only evidence.
 *   3. It did not know about demo mode, so a simulated set could reach a real cart.
 *   4. `addListingItemToCart` returns void and swallows every failure into
 *      `console.error`, so awaiting it and returning `{ ok: true }` reported success for
 *      a Saleor domain rejection — insufficient stock, variant not in channel — exactly
 *      as loudly as for a real success.
 *
 * (4) is fixed here without touching shared checkout code: the checkout is READ back
 * afterwards and the line is confirmed present. That is a post-condition, not a guess.
 */

import * as Checkout from "@/lib/checkout";
import { addListingItemToCart } from "@/ui/components/plp/actions";
import { getLocaleFromChannel } from "@/config/locale";
import { loadFitmentDataset } from "./provider";
import { isDemoDataset, verifyPurchasable } from "./offers";
import { resolveFitment } from "./resolve";
import { readActiveSelection } from "@/lib/garage/state";

export type AddSetFailure =
	/** Demo data. A simulated set may never reach a real cart. */
	| "simulation"
	/** No fitment provider, or it could not be reached. */
	| "provider-unavailable"
	/** The active vehicle changed, or there is none. Re-verify before buying. */
	| "vehicle-changed"
	/** This set is not verified for the current vehicle. */
	| "not-verified"
	/** The product/variant is not published or not in this channel. */
	| "not-available"
	/** The catalogue answered, and it is out of stock. */
	| "out-of-stock"
	/** The cart mutation did not produce the line. */
	| "cart-rejected"
	/** Something upstream failed; the outcome is genuinely unknown. */
	| "lookup-failed"
	| "invalid-input";

export type AddSetResult = { ok: true } | { ok: false; reason: AddSetFailure };

/**
 * Add a configured set.
 *
 * `saleorVariantId` arrives from the client but is only ever used to look the product up
 * again. It cannot introduce a product Saleor does not publish, and it cannot by itself
 * establish that anything fits.
 */
export async function addConfiguredSetToCart(input: {
	channel: string;
	saleorProductId: string;
	saleorVariantId: string;
}): Promise<AddSetResult> {
	const { channel, saleorProductId, saleorVariantId } = input;
	if (!channel || !saleorProductId || !saleorVariantId) return { ok: false, reason: "invalid-input" };

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return { ok: false, reason: "provider-unavailable" };

	// The server-side interlock. A demo dataset can never reach a live mutation, even
	// when this action is called directly rather than through the UI — a disabled button
	// is not a control.
	if (isDemoDataset(dataset)) return { ok: false, reason: "simulation" };

	// The vehicle is re-read here, not trusted from the request. If the shopper switched
	// cars in another tab, the set they are looking at was verified for a different one.
	const selection = await readActiveSelection(dataset);
	if (!selection) return { ok: false, reason: "vehicle-changed" };

	// Fitment is re-established against the CURRENT dataset and the CURRENT vehicle,
	// scoped to this exact product. Only a verified fit may be bought.
	const fitment = resolveFitment(dataset, selection, { saleorProductId });
	if (fitment.verdict !== "VERIFIED_FIT") {
		return {
			ok: false,
			reason: fitment.verdict === "PROVIDER_UNAVAILABLE" ? "provider-unavailable" : "not-verified",
		};
	}

	// The exact variant must be the one the verified application names.
	const ref = fitment.matched
		.flatMap((a) => a.products)
		.find((p) => p.saleorProductId === saleorProductId && p.saleorVariantId === saleorVariantId);
	if (!ref) return { ok: false, reason: "not-verified" };

	const locale = getLocaleFromChannel(channel);
	const check = await verifyPurchasable(
		saleorProductId,
		saleorVariantId,
		channel,
		locale,
		ref.externalReference,
	);
	if (!check.ok) {
		return { ok: false, reason: check.reason === "lookup-failed" ? "lookup-failed" : "not-available" };
	}
	if (check.availability === "out-of-stock") return { ok: false, reason: "out-of-stock" };

	// --- post-condition: count the line before, and require it to have grown ---
	const before = await countLine(channel, saleorVariantId);

	const formData = new FormData();
	formData.set("channel", channel);
	formData.set("variantId", saleorVariantId);
	formData.set("quantity", "1");
	await addListingItemToCart(formData);

	const after = await countLine(channel, saleorVariantId);
	if (after === null) {
		// The checkout could not be read back. The add may or may not have happened, and
		// claiming either would be a guess. Deliberately no retry: a blind retry on an
		// uncertain transport is how a customer ends up with two of something.
		return { ok: false, reason: "lookup-failed" };
	}
	if (before !== null && after <= before) return { ok: false, reason: "cart-rejected" };
	if (before === null && after === 0) return { ok: false, reason: "cart-rejected" };

	return { ok: true };
}

/**
 * Quantity of one variant in the current checkout, or null when it cannot be read.
 *
 * Null is deliberately distinct from 0: "no cart yet" and "could not ask" lead to
 * different honest answers above.
 */
async function countLine(channel: string, saleorVariantId: string): Promise<number | null> {
	try {
		const checkoutId = await Checkout.getIdFromCookies(channel);
		if (!checkoutId) return 0;
		const checkout = await Checkout.find(checkoutId);
		if (!checkout) return null;
		return checkout.lines
			.filter((line) => line.variant?.id === saleorVariantId)
			.reduce((total, line) => total + line.quantity, 0);
	} catch {
		return null;
	}
}
