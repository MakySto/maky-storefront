/**
 * The configurator's add-to-cart outcome, and how it is derived from the shared cart
 * action's answer.
 *
 * PURE: no I/O and no "use server". The mapping lives outside `cart-actions.ts` on
 * purpose — a "use server" module may export only async functions, and a synchronous
 * helper there is an error that `next build` prints and then exits 0 over.
 *
 * The shared action answers with three outcomes, not two, and the third is the one this
 * mapping must never flatten. `unconfirmed` means the mutation was SENT and its response
 * was lost, so the line may well be in the cart already. It is neither a success nor a
 * failure: reporting it as "added" would be a claim, and reporting it as "rejected" would
 * invite a second click on a mutation that is not idempotent — verified live, the same
 * `checkoutLinesAdd` three times takes a line from one to three.
 */

import { type AddToCartResult } from "@/ui/components/plp/add-to-cart-result";

export type AddSetFailure =
	/** Demo data. A simulated set may never reach a real cart. */
	| "simulation"
	/** No fitment provider, or it could not be reached. */
	| "provider-unavailable"
	/** The active vehicle changed, or there is none. Re-verify before buying. */
	| "vehicle-changed"
	/** This set is not verified for the current vehicle. */
	| "not-verified"
	/** The product/variant is not published, not purchasable, or not in this channel. */
	| "not-available"
	/** The catalogue answered, and it is out of stock. */
	| "out-of-stock"
	/** Saleor answered the mutation and refused the line. Safe to try again. */
	| "cart-rejected"
	/** The outcome is genuinely unknown. The shopper is told to check the cart. */
	| "lookup-failed"
	| "invalid-input";

export type AddSetResult = { ok: true } | { ok: false; reason: AddSetFailure };

/**
 * Translate the shared action's answer into this feature's vocabulary.
 *
 * `rejected` splits on ONE reason. `unavailable` is Saleor saying the set cannot be sold
 * right now — sold out, unpublished, not purchasable, not in this channel — and the
 * customer is told the set is no longer on offer. Every other refusal (a malformed
 * request, a checkout that could not be made or read, a code we do not model) is the
 * cart declining, not the set disappearing, and says so.
 */
export function toAddSetResult(outcome: AddToCartResult): AddSetResult {
	switch (outcome.status) {
		case "added":
			return { ok: true };
		case "unconfirmed":
			return { ok: false, reason: "lookup-failed" };
		case "rejected":
			return {
				ok: false,
				reason: outcome.reason === "unavailable" ? "not-available" : "cart-rejected",
			};
	}
}
