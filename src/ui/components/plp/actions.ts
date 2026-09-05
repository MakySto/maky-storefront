"use server";

import { revalidatePath } from "next/cache";

import { CheckoutAddLineDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import * as Checkout from "@/lib/checkout";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-stepper";
import { classifyCheckoutErrors, type AddToCartResult } from "./add-to-cart-result";

/**
 * Put one variant in the cart and say what actually happened.
 *
 * This used to answer `void` and treat the transport's `result.ok` as the
 * answer, so a Saleor domain rejection — out of stock, not published, not
 * purchasable in this channel — arrived as a success. The mutation did not even
 * select `errors.code`, so there was nothing to look at.
 *
 * Three outcomes, not two. The third one matters: if the request was sent and
 * the transport then failed, the write may have landed, so it is neither a
 * success nor a failure and it must NEVER be retried automatically — a retry is
 * how one click becomes two lines. Everything before the mutation is a clean
 * failure, because nothing was attempted yet.
 */
export async function addVariantToCart(input: {
	channel: string;
	variantId: string;
	quantity: number;
	maxQuantity?: number | null;
}): Promise<AddToCartResult> {
	const { channel, variantId } = input;
	if (!channel || !variantId) {
		return { status: "rejected", reason: "invalid", message: "channel and variantId are required" };
	}

	// Quantity is user-controlled on both call sites. Clamp rather than trust.
	const ceiling =
		Number.isFinite(input.maxQuantity) && (input.maxQuantity ?? 0) > 0
			? (input.maxQuantity as number)
			: QUANTITY_FALLBACK_MAX;
	const quantity = Number.isFinite(input.quantity)
		? Math.min(Math.max(Math.trunc(input.quantity), 1), ceiling)
		: 1;

	let checkoutId: string;
	let quantityBefore = 0;
	try {
		const checkout = await Checkout.findOrCreate({
			checkoutId: await Checkout.getIdFromCookies(channel),
			channel,
		});
		if (!checkout) {
			return { status: "rejected", reason: "checkout", message: "could not create a checkout" };
		}
		await Checkout.saveIdToCookie(channel, checkout.id);
		checkoutId = checkout.id;
		// Recorded so an unclear result can be settled by READING rather than by
		// sending the write again.
		quantityBefore = quantityOfVariant(checkout, variantId);
	} catch (error) {
		// Still before the mutation, so nothing can have been written.
		return {
			status: "rejected",
			reason: "checkout",
			message: error instanceof Error ? error.message : "could not create a checkout",
		};
	}

	// From here on a failure is "unconfirmed", never "rejected": the request may
	// have reached Saleor.
	try {
		const result = await executeAuthenticatedGraphQL(CheckoutAddLineDocument, {
			variables: { id: checkoutId, productVariantId: decodeURIComponent(variantId), quantity },
			cache: "no-cache",
		});

		if (!result.ok) {
			console.error("[cart] add-to-cart transport failure:", result.error.message);
			revalidatePath("/cart");
			return reconcile(checkoutId, variantId, quantityBefore, quantity, result.error.message);
		}

		const payload = result.data.checkoutLinesAdd;
		if (!payload) {
			revalidatePath("/cart");
			return { status: "unconfirmed", message: "the mutation returned no payload" };
		}

		const rejection = classifyCheckoutErrors(payload.errors ?? []);
		if (rejection) {
			console.error("[cart] add-to-cart rejected:", rejection.message);
			return rejection;
		}

		// Saleor reports success by returning the checkout. No checkout and no
		// errors is a contract violation, not a confirmation.
		if (!payload.checkout) {
			revalidatePath("/cart");
			return { status: "unconfirmed", message: "the mutation reported neither a checkout nor an error" };
		}

		revalidatePath("/cart");
		return { status: "added" };
	} catch (error) {
		console.error("[cart] add-to-cart failed after sending:", error);
		revalidatePath("/cart");
		return reconcile(
			checkoutId,
			variantId,
			quantityBefore,
			quantity,
			error instanceof Error ? error.message : "unknown error",
		);
	}
}

type LinesHolder = { lines?: readonly { quantity: number; variant?: { id?: string } | null }[] | null };

function quantityOfVariant(checkout: LinesHolder | null | undefined, variantId: string): number {
	const decoded = decodeURIComponent(variantId);
	return (checkout?.lines ?? [])
		.filter((line) => line.variant?.id === decoded)
		.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Settle an unclear write by asking, never by repeating it.
 *
 * `checkoutLinesAdd` is not idempotent — verified against live Saleor, the same
 * call three times takes a line from quantity 1 to 3 — so a lost response must
 * never be resolved by sending it again. The checkout itself is the authority on
 * whether the line landed, and reading is free of consequence.
 *
 * Only when the read ALSO fails does this stay `unconfirmed`, which is the
 * honest answer: we asked and we still do not know.
 */
async function reconcile(
	checkoutId: string,
	variantId: string,
	quantityBefore: number,
	quantityRequested: number,
	message: string,
): Promise<AddToCartResult> {
	try {
		const checkout = await Checkout.find(checkoutId);
		if (!checkout) return { status: "unconfirmed", message };

		const after = quantityOfVariant(checkout, variantId);
		if (after >= quantityBefore + quantityRequested) {
			console.warn("[cart] transport failed but the line landed; reporting success:", message);
			return { status: "added" };
		}
		if (after === quantityBefore) {
			// Authoritative: nothing was written, so the customer can safely retry.
			return {
				status: "rejected",
				reason: "rejected",
				message: "the request did not reach the checkout — nothing was added",
			};
		}
		// Landed partially, or somebody else changed the cart in between. Do not
		// guess, and above all do not add more.
		return { status: "unconfirmed", message };
	} catch {
		return { status: "unconfirmed", message };
	}
}

/** `useActionState` signature, so a form can render the outcome. */
export async function addListingItemToCartAction(
	_previous: AddToCartResult | null,
	formData: FormData,
): Promise<AddToCartResult> {
	return addListingItemToCartWithResult(formData);
}

/** The same call, driven by a `<form action>` payload. */
export async function addListingItemToCartWithResult(formData: FormData): Promise<AddToCartResult> {
	const rawMax = Number.parseInt(String(formData.get("maxQuantity") ?? ""), 10);
	return addVariantToCart({
		channel: String(formData.get("channel") ?? ""),
		variantId: String(formData.get("variantId") ?? ""),
		quantity: Number.parseInt(String(formData.get("quantity") ?? ""), 10),
		maxQuantity: Number.isFinite(rawMax) ? rawMax : null,
	});
}

/**
 * Void wrapper. Nothing in Lane A calls it any more — the listing card now goes
 * through `addListingItemToCartAction` so the shopper sees the outcome — but
 * Lane B's `fitment/cart-actions.ts` still does, and deleting it would break
 * that integration before B has migrated.
 *
 * It swallows the outcome, which is the behaviour this whole change exists to
 * remove. Anything that can render feedback must use
 * `addListingItemToCartAction` (form) or `addVariantToCart` (direct).
 */
export async function addListingItemToCart(formData: FormData): Promise<void> {
	await addListingItemToCartWithResult(formData);
}
