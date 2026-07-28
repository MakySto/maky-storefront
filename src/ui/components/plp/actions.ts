"use server";

import { revalidatePath } from "next/cache";

import { CheckoutAddLineDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import * as Checkout from "@/lib/checkout";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-stepper";

/**
 * Add a listing card's product to the cart.
 *
 * Same path as the PDP's add-to-cart — `Checkout.findOrCreate`, the same
 * `checkoutLinesAdd` mutation, the same cookie. It exists separately only
 * because a listing has no single selected variant to close over; everything it
 * needs arrives in the form.
 *
 * Cards only render this for single-variant products. A product with a real
 * choice links to its detail page instead, so this can never silently pick a
 * variant on the customer's behalf.
 */
export async function addListingItemToCart(formData: FormData) {
	const channel = String(formData.get("channel") ?? "");
	const variantId = String(formData.get("variantId") ?? "");
	if (!channel || !variantId) return;

	// Both fields are user-controlled. Clamp rather than trust.
	const parsed = Number.parseInt(String(formData.get("quantity") ?? ""), 10);
	const rawMax = Number.parseInt(String(formData.get("maxQuantity") ?? ""), 10);
	const ceiling = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : QUANTITY_FALLBACK_MAX;
	const quantity = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), ceiling) : 1;

	try {
		const checkout = await Checkout.findOrCreate({
			checkoutId: await Checkout.getIdFromCookies(channel),
			channel,
		});

		if (!checkout) {
			console.error("[plp] Add to cart: failed to create checkout");
			return;
		}

		await Checkout.saveIdToCookie(channel, checkout.id);

		const result = await executeAuthenticatedGraphQL(CheckoutAddLineDocument, {
			variables: { id: checkout.id, productVariantId: decodeURIComponent(variantId), quantity },
			cache: "no-cache",
		});

		if (!result.ok) {
			console.error("[plp] Add to cart failed:", result.error.message);
			return;
		}

		revalidatePath("/cart");
	} catch (error) {
		console.error("[plp] Add to cart failed:", error);
	}
}
