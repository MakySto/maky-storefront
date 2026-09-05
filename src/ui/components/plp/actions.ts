"use server";

import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";

import { CheckoutAddLineDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import * as Checkout from "@/lib/checkout";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-stepper";
import {
	classifyCheckoutErrors,
	hasTimeForAnotherRead,
	READ_BACK_BUDGET_MS,
	readBackVerdict,
	READ_BACK_DELAYS_MS,
	type AddToCartResult,
} from "./add-to-cart-result";

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

	// Decode ONCE, and here, where a failure is still unambiguously a refusal.
	// `variantId` arrives from a hidden input, so it is attacker-shaped: on a
	// malformed escape `decodeURIComponent` throws `URIError`. That used to happen
	// twice, both times in the wrong place — inside the checkout block, where it
	// was reported as "could not create a checkout", and inside the post-send
	// block at the mutation's argument list, where it was routed into `reconcile`
	// and so described as a request that might be in flight. Nothing had been sent
	// in either case.
	let decodedVariantId: string;
	try {
		decodedVariantId = decodeURIComponent(variantId);
	} catch {
		return { status: "rejected", reason: "invalid", message: "variantId is not a valid identifier" };
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
		const ensured = await Checkout.findOrCreate({
			checkoutId: await Checkout.getIdFromCookies(channel),
			channel,
		});
		if (ensured.status === "unavailable") {
			// Nothing was attempted, so this really is a clean refusal — and,
			// crucially, no replacement checkout was minted and the cookie still
			// points at whatever basket the customer already had.
			return { status: "rejected", reason: "checkout", message: ensured.reason };
		}

		// Only a NEW checkout earns a cookie write. Re-writing the same id would be
		// harmless, but "only write when we created something" is the rule that
		// keeps an existing identity from being overwritten by accident.
		if (ensured.created) {
			await Checkout.saveIdToCookie(channel, ensured.checkout.id);
		}
		checkoutId = ensured.checkout.id;
		// Recorded so an unclear result can be settled by READING rather than by
		// sending the write again.
		quantityBefore = quantityOfVariant(ensured.checkout, decodedVariantId);
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
			variables: { id: checkoutId, productVariantId: decodedVariantId, quantity },
			cache: "no-cache",
		});

		if (!result.ok) {
			console.error("[cart] add-to-cart transport failure:", result.error.message);
			revalidateCart(channel);
			return reconcile(checkoutId, decodedVariantId, quantityBefore, quantity, result.error.message);
		}

		const payload = result.data.checkoutLinesAdd;
		if (!payload) {
			revalidateCart(channel);
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
			revalidateCart(channel);
			return { status: "unconfirmed", message: "the mutation reported neither a checkout nor an error" };
		}

		revalidateCart(channel);
		return { status: "added" };
	} catch (error) {
		console.error("[cart] add-to-cart failed after sending:", error);
		revalidateCart(channel);
		return reconcile(
			checkoutId,
			decodedVariantId,
			quantityBefore,
			quantity,
			error instanceof Error ? error.message : "unknown error",
		);
	}
}

/**
 * Invalidate the cart page and the chrome carrying its badge.
 *
 * This was `revalidatePath("/cart")`, which has never matched anything: the
 * cart lives at `/sk/cart`, which the proxy rewrites to `/sk-eur/cart`, so a
 * market-less `/cart` is a different and non-existent route. It matters more
 * now than it did — an `unconfirmed` add tells the shopper to go and look at
 * their cart, and until this fix that page could answer from cache.
 */
function revalidateCart(channel: string) {
	revalidateStorefrontBrowsePath(channel, "/cart");
	revalidateStorefrontChrome(channel);
}

type LinesHolder = { lines?: readonly { quantity: number; variant?: { id?: string } | null }[] | null };

/** `variantId` must already be decoded — see the note in `addVariantToCart`. */
function quantityOfVariant(checkout: LinesHolder | null | undefined, variantId: string): number {
	return (checkout?.lines ?? [])
		.filter((line) => line.variant?.id === variantId)
		.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Settle an unclear write by asking, never by repeating it.
 *
 * `checkoutLinesAdd` is not idempotent — verified against live Saleor, the same
 * call three times takes a line from quantity 1 to 3 — so a lost response must
 * never be resolved by sending it again. The checkout is the authority on
 * whether the line landed, and reading is free of consequence.
 *
 * This asks a bounded number of times rather than once. A single immediate read
 * is a statement about one instant: the mutation whose response we lost may
 * still be in flight, and a timeout is exactly the case where it most likely
 * did arrive. So an unchanged read is not evidence of a failed write, and this
 * function can no longer answer `rejected` at all.
 *
 * `rejected` in this action is reserved for the two cases that really do carry
 * it: a documented refusal from Saleor, and a failure *before* the mutation was
 * sent. Everything from here on is `added` or `unconfirmed`.
 */
async function reconcile(
	checkoutId: string,
	variantId: string,
	quantityBefore: number,
	quantityRequested: number,
	message: string,
): Promise<AddToCartResult> {
	const startedAt = Date.now();
	// One deadline for the WHOLE phase, enforced by aborting the request rather
	// than by checking a clock after it returns. The previous version awaited the
	// read first and only then looked at the time, so a read that never came back
	// meant the deadline was never reached at all.
	const deadline = new AbortController();
	const expiry = setTimeout(() => deadline.abort(), READ_BACK_BUDGET_MS);

	try {
		return await settleByReading(checkoutId, variantId, quantityBefore, quantityRequested, message, {
			startedAt,
			signal: deadline.signal,
		});
	} finally {
		clearTimeout(expiry);
		// Nothing may go out under this deadline once the phase is over.
		deadline.abort();
	}
}

async function settleByReading(
	checkoutId: string,
	variantId: string,
	quantityBefore: number,
	quantityRequested: number,
	message: string,
	phase: { startedAt: number; signal: AbortSignal },
): Promise<AddToCartResult> {
	const { startedAt, signal } = phase;

	for (let attempt = 0; ; attempt++) {
		const after = await readQuantity(checkoutId, variantId, signal);
		const verdict = readBackVerdict({ before: quantityBefore, requested: quantityRequested, after });

		if (verdict === "landed") {
			console.warn("[cart] transport failed but the line landed; reporting success:", message);
			return { status: "added" };
		}

		// Something moved, but not what we asked for: a stock clamp, or another
		// tab. Asking again cannot disentangle those, and guessing is how a
		// customer gets the item twice.
		if (verdict === "partial") return { status: "unconfirmed", message };

		// `unchanged` or `unreadable`. Neither is a failed write. Ask again while
		// both budgets last, then stop asking — and say so honestly.
		//
		// `noUncheckedIndexedAccess` is off, so this reads as `number` while at
		// runtime it becomes `undefined` once the schedule is spent. That is exactly
		// the case `hasTimeForAnotherRead` refuses, which is what ends the loop.
		const delayMs = READ_BACK_DELAYS_MS[attempt];
		if (!hasTimeForAnotherRead({ elapsedMs: Date.now() - startedAt, delayMs })) {
			return { status: "unconfirmed", message };
		}
		// Abortable, so the deadline ends the phase rather than being noticed one
		// sleep later. Without this the answer is still correct — the next read
		// would abort immediately — but the shopper waits out the remaining delay.
		await sleep(delayMs, signal);
		if (signal.aborted) return { status: "unconfirmed", message };
	}
}

/**
 * One read of the line's quantity. `null` means we did not learn anything —
 * the read failed, was refused, or ran out of time.
 *
 * `retry: false` is load-bearing. This is a query, so it would otherwise keep
 * the transport's three attempts with exponential backoff, and one read could
 * then consume the entire read-back budget by itself.
 */
async function readQuantity(
	checkoutId: string,
	variantId: string,
	signal: AbortSignal,
): Promise<number | null> {
	try {
		const result = await Checkout.lookup(checkoutId, { signal, retry: false });
		return result.status === "found" ? quantityOfVariant(result.checkout, variantId) : null;
	} catch {
		return null;
	}
}

/** Resolves after `ms`, or as soon as `signal` aborts. Never rejects. */
const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal?.aborted) return resolve();
		const timer = setTimeout(done, ms);
		function done() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		}
		signal?.addEventListener("abort", done, { once: true });
	});

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
