"use server";

import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";

import {
	CheckoutAddLineDocument,
	CheckoutAddSizedLineDocument,
	CheckoutLinesUpdateDocument,
	ProductVariantPurchasabilityDocument,
} from "@/gql/graphql";
import { executeAuthenticatedGraphQL, executePublicGraphQL } from "@/lib/graphql";
import * as Checkout from "@/lib/checkout";
import { publicProductCode } from "@/lib/product-code";
import { tyreSelectionKey, tyreSelectionToMetadata } from "@/lib/tyre-size/line-metadata";
import { resolveTyreSelection, tyreSelectionInputFromForm } from "@/lib/tyre-size/selection";
import { isTyreSizeControlled } from "@/lib/tyre-size/size-index";
import type { TyreRefusal, TyreSelection, TyreSelectionInput } from "@/lib/tyre-size/types";
import { clampQuantity } from "@/ui/components/ui/quantity-limits";
import {
	classifyCheckoutErrors,
	hasTimeForAnotherRead,
	READ_BACK_BUDGET_MS,
	readBackVerdict,
	READ_BACK_DELAYS_MS,
	type AddToCartRejection,
	type AddToCartResult,
} from "./add-to-cart-result";
import { lineOfChoice, quantityOfVariant } from "./cart-lines";

/** Why a tyre choice was not accepted, as the reason a form shows. Each is a different sentence to the customer. */
const SIZE_REASON: Record<TyreRefusal, Extract<AddToCartRejection, `size-${string}`>> = {
	required: "size-required",
	"unknown-size": "size-invalid",
	"condition-required": "size-condition",
	"condition-mismatch": "size-condition",
};

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
 *
 * A snow chain or sock is the one product that is added WITH something: the tyre size the customer chose
 * (`lib/tyre-size`). Which products those are is decided here, from the variant's own public code as Saleor
 * answers it, and not from anything the form says: every path that reaches this function — the product page, a
 * listing card, the vehicle configurator — meets the same check, and none of them can add such a product without
 * a size that belongs to its code, or the customer's own statement that they know the code. The choice is written
 * on the cart line (it reaches the order line from there), the same size added again raises that line's quantity,
 * and a different size is a second line.
 */
export async function addVariantToCart(input: {
	channel: string;
	variantId: string;
	quantity: number;
	maxQuantity?: number | null;
	/** What the form said about the tyre choice, before any check. Only snow chains and socks look at it. */
	tyre?: TyreSelectionInput | null;
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

	// Quantity is user-controlled on both call sites. Clamp rather than trust — and the
	// clamp itself is guaranteed to return a positive integer, because the previous one
	// could return NaN and did: see `quantity-limits.ts`.
	const quantity = clampQuantity(input.quantity, input.maxQuantity);
	// Re-read the channel-level purchase switch immediately before touching a checkout.
	// Hidden form fields and client payloads are attacker-controlled, and a stale PLP/PDP
	// may outlive a catalogue change. Fail closed while the request is still a read: no
	// checkout is created, no cookie is written and no mutation is attempted.
	let publicCode: string | null = null;
	try {
		const verification = await executePublicGraphQL(ProductVariantPurchasabilityDocument, {
			variables: { id: decodedVariantId, channel },
			cache: "no-store",
		});
		if (!verification.ok) {
			console.error("[cart] purchasability lookup failed:", verification.error.message);
			return {
				status: "rejected",
				reason: "unavailable",
				message: "product availability could not be verified",
			};
		}
		if (verification.data.productVariant?.product.isAvailableForPurchase !== true) {
			return {
				status: "rejected",
				reason: "unavailable",
				message: "product is not available for purchase in this market",
			};
		}
		publicCode = publicProductCode(verification.data.productVariant);
	} catch (error) {
		console.error("[cart] purchasability lookup threw:", error);
		return {
			status: "rejected",
			reason: "unavailable",
			message: "product availability could not be verified",
		};
	}

	// A snow chain or sock needs a size that belongs to its code. Still a read: refused before any checkout exists.
	let tyre: TyreSelection | null = null;
	if (publicCode !== null && isTyreSizeControlled(publicCode)) {
		const checked = resolveTyreSelection(publicCode, input.tyre);
		if (!checked.ok) {
			return {
				status: "rejected",
				reason: SIZE_REASON[checked.refusal],
				message: `tyre choice refused: ${checked.refusal}`,
			};
		}
		tyre = checked.selection;
	}
	// The key of the line this add belongs to: null for every other product (all lines of the variant count).
	const choiceKey = tyre ? tyreSelectionKey(tyre) : null;

	let checkoutId: string;
	let quantityBefore = 0;
	let sameChoice: { id: string; quantity: number } | null = null;
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
		quantityBefore = quantityOfVariant(ensured.checkout, decodedVariantId, choiceKey);
		if (choiceKey !== null) {
			const line = lineOfChoice(ensured.checkout, decodedVariantId, choiceKey);
			sameChoice = line ? { id: line.id, quantity: line.quantity } : null;
		}
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
		const result = await sendLine({
			checkoutId,
			variantId: decodedVariantId,
			quantity,
			tyre,
			sameChoice,
		});

		if (!result.ok) {
			console.error("[cart] add-to-cart transport failure:", result.message);
			revalidateCart(channel);
			return reconcile(checkoutId, decodedVariantId, choiceKey, quantityBefore, quantity, result.message);
		}

		const payload = result.payload;
		if (!payload) {
			revalidateCart(channel);
			return { status: "unconfirmed", message: "the mutation returned no payload" };
		}

		const rejection = classifyCheckoutErrors(payload.errors ?? []);
		if (rejection) {
			console.error("[cart] add-to-cart rejected:", rejection.message);
			// The customer is offered the way out of the payment in progress, for this very checkout.
			return rejection.reason === "payment-locked"
				? { ...rejection, paymentLock: { checkoutId, channelSlug: channel } }
				: rejection;
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
			choiceKey,
			quantityBefore,
			quantity,
			error instanceof Error ? error.message : "unknown error",
		);
	}
}

type LineWrite =
	| { ok: false; message: string }
	| {
			ok: true;
			payload:
				| {
						checkout?: unknown;
						errors?: readonly { code?: string | null; field?: string | null; message?: string | null }[];
				  }
				| null
				| undefined;
	  };

/**
 * The one write: which mutation depends on what is being added, and all three answer in the same shape.
 *
 * - Any other product: `checkoutLinesAdd`, exactly as before this feature.
 * - A snow chain or sock whose size is not yet in the cart: `checkoutLinesAdd` with `forceNewLine`, so that
 *   a second size becomes a second line instead of replacing the first line's metadata, and with the choice as
 *   the line's metadata.
 * - The same size again: the existing line's quantity is raised with `checkoutLinesUpdate`, so the cart does not
 *   fill with two lines of one size. That one sets an absolute quantity, which makes it safe to settle by reading.
 */
async function sendLine(args: {
	checkoutId: string;
	variantId: string;
	quantity: number;
	tyre: TyreSelection | null;
	sameChoice: { id: string; quantity: number } | null;
}): Promise<LineWrite> {
	const { checkoutId, variantId, quantity, tyre, sameChoice } = args;

	if (tyre && sameChoice) {
		const result = await executeAuthenticatedGraphQL(CheckoutLinesUpdateDocument, {
			variables: { checkoutId, lines: [{ lineId: sameChoice.id, quantity: sameChoice.quantity + quantity }] },
			cache: "no-cache",
		});
		return result.ok
			? { ok: true, payload: result.data.checkoutLinesUpdate }
			: { ok: false, message: result.error.message };
	}

	if (tyre) {
		const result = await executeAuthenticatedGraphQL(CheckoutAddSizedLineDocument, {
			variables: {
				id: checkoutId,
				productVariantId: variantId,
				quantity,
				metadata: tyreSelectionToMetadata(tyre),
			},
			cache: "no-cache",
		});
		return result.ok
			? { ok: true, payload: result.data.checkoutLinesAdd }
			: { ok: false, message: result.error.message };
	}

	const result = await executeAuthenticatedGraphQL(CheckoutAddLineDocument, {
		variables: { id: checkoutId, productVariantId: variantId, quantity },
		cache: "no-cache",
	});
	return result.ok
		? { ok: true, payload: result.data.checkoutLinesAdd }
		: { ok: false, message: result.error.message };
}

/**
 * Invalidate the cart page and the chrome carrying its badge.
 *
 * This was `revalidatePath("/cart")`, which has never matched anything: the
 * cart lives at `/sk/kosik`, which the proxy rewrites to `/sk-eur/cart`, so a
 * market-less `/cart` is a different and non-existent route. It matters more
 * now than it did — an `unconfirmed` add tells the shopper to go and look at
 * their cart, and until this fix that page could answer from cache.
 */
function revalidateCart(channel: string) {
	revalidateStorefrontBrowsePath(channel, "/cart");
	revalidateStorefrontChrome(channel);
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
	choiceKey: string | null,
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
		return await settleByReading(
			checkoutId,
			variantId,
			choiceKey,
			quantityBefore,
			quantityRequested,
			message,
			{
				startedAt,
				signal: deadline.signal,
			},
		);
	} finally {
		clearTimeout(expiry);
		// Nothing may go out under this deadline once the phase is over.
		deadline.abort();
	}
}

async function settleByReading(
	checkoutId: string,
	variantId: string,
	choiceKey: string | null,
	quantityBefore: number,
	quantityRequested: number,
	message: string,
	phase: { startedAt: number; signal: AbortSignal },
): Promise<AddToCartResult> {
	const { startedAt, signal } = phase;

	for (let attempt = 0; ; attempt++) {
		const after = await readQuantity(checkoutId, variantId, choiceKey, signal);
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
	choiceKey: string | null,
	signal: AbortSignal,
): Promise<number | null> {
	try {
		const result = await Checkout.lookup(checkoutId, { signal, retry: false });
		return result.status === "found" ? quantityOfVariant(result.checkout, variantId, choiceKey) : null;
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
		tyre: tyreSelectionInputFromForm(formData),
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
