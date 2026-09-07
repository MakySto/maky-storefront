"use server";

/**
 * Adding a configured set to the cart.
 *
 * This does NOT reimplement the cart. It re-establishes everything the client is not
 * allowed to assert, then hands off to the shared `addVariantToCart` — which owns
 * `Checkout.findOrCreate`, the `checkoutLinesAdd` mutation, the checkout cookie and the
 * settling of an unclear result (CLAUDE.md §10) — and translates its typed answer into
 * this feature's vocabulary.
 *
 * Three things the first version got wrong, all of which ended in `{ ok: true }`:
 *
 *   1. It never re-read the active vehicle, so a set verified for the car the shopper
 *      had ten minutes ago could be added for the car they have now.
 *   2. It never re-checked fitment at all — the client's word was the only evidence.
 *   3. It did not know about demo mode, so a simulated set could reach a real cart.
 *
 * A fourth lived in the shared action rather than here: it returned void and swallowed
 * a Saleor domain rejection into `console.error`. This file used to compensate by
 * counting the line in the checkout before and after the call. That work-around is
 * gone. The shared action now inspects `checkoutLinesAdd.errors`, settles a lost
 * response by READING under a deadline, and never repeats an unconfirmed write — so
 * what remains here is exactly this feature's business: the vehicle, the fitment and
 * the exact variant.
 */

import { addVariantToCart } from "@/ui/components/plp/actions";
import { getLocaleFromChannel } from "@/config/locale";
import { readActiveSelection } from "@/lib/garage/state";
import { CONFIGURATOR_PRODUCT_KIND, isFitmentOfferable } from "./contract";
import { loadFitmentDataset } from "./provider";
import { isDemoDataset, verifyPurchasable } from "./offers";
import { resolveFitment } from "./resolve";
import { toAddSetResult, type AddSetResult } from "./cart-result";

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
	// scoped to this exact product. The same gate the configurator used to decide whether
	// to show a button decides here whether the write happens — one function, so a
	// disagreement between them is not expressible.
	const fitment = resolveFitment(dataset, selection, { saleorProductId });
	if (!isFitmentOfferable({ verdict: fitment.verdict, eligibility: fitment.product?.eligibility })) {
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

	// The offer list already refuses the wrong kind, but this is a POST endpoint and a
	// disabled button is not a control: a verified roof box is still not a roof-rack set.
	if (ref.productKind !== CONFIGURATOR_PRODUCT_KIND) return { ok: false, reason: "not-verified" };

	const locale = getLocaleFromChannel(channel);
	const check = await verifyPurchasable(
		saleorProductId,
		saleorVariantId,
		channel,
		locale,
		ref.externalReference,
	);
	if (!check.ok) {
		// A catalogue that could not be asked is NOT the same as a mutation whose answer was
		// lost. Nothing has been sent yet, so this one is safe to retry and says so;
		// `lookup-failed` is reserved for the post-mutation "check your cart" case below.
		return {
			ok: false,
			reason: check.reason === "lookup-failed" ? "catalogue-unavailable" : "not-available",
		};
	}
	if (check.availability === "out-of-stock") return { ok: false, reason: "out-of-stock" };

	// Hand-off. Quantity is fixed at one: a set is one variant and the configurator has
	// no quantity control. Whatever comes back is reported as it is — including the
	// answer "we do not know", which the shared action may give and this one must not
	// paper over.
	return toAddSetResult(await addVariantToCart({ channel, variantId: saleorVariantId, quantity: 1 }));
}
