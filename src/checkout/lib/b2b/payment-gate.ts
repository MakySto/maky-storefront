import type { B2bUiOutcome } from "./contract";

/**
 * May the payment UI start a payment for a company purchase? Pure, so the whole matrix is tested without a DOM.
 *
 * The server preflight decides again before every payment; this gate only keeps the customer from pressing "pay"
 * on something the page already knows is not final — and makes them confirm a taxed total they did not ask for.
 */

export type B2bPaymentGate =
	| { allowed: true; state: "ready" }
	| {
			allowed: false;
			/**
			 * - `pending` — the state is being confirmed (or has not been yet on this page);
			 * - `needs_confirmation` — the exemption was asked for and is not granted: the customer confirms the taxed
			 *   total first ("Pokračovať s DPH");
			 * - `blocked` — unconfirmed, changed while we worked, or a payment already in progress.
			 */
			state: "pending" | "needs_confirmation" | "blocked";
	  };

const READY: B2bPaymentGate = { allowed: true, state: "ready" };

export function b2bPaymentGate(params: {
	businessMode: boolean;
	euMarket: boolean;
	outcome: B2bUiOutcome | null;
	pending: boolean;
	taxedConfirmed: boolean;
}): B2bPaymentGate {
	if (!params.businessMode || !params.euMarket) return READY;
	if (params.pending || !params.outcome) return { allowed: false, state: "pending" };
	switch (params.outcome.kind) {
		case "off":
		case "exempt":
			return READY;
		case "taxed":
			return params.outcome.needsTaxedConfirmation && !params.taxedConfirmed
				? { allowed: false, state: "needs_confirmation" }
				: READY;
		default:
			return { allowed: false, state: "blocked" };
	}
}

type QuoteLike = { totalPrice?: { gross?: { amount: number; currency: string } | null } | null };

/**
 * The taxed total a "Pokračovať s DPH" refers to. A confirmation is for THIS total and reason: a new quote (other
 * delivery, other quantity, another reason) needs a new one.
 */
export function taxedQuoteKey(checkout: QuoteLike, outcome: B2bUiOutcome): string | null {
	if (outcome.kind !== "taxed") return null;
	const gross = checkout.totalPrice?.gross;
	if (!gross || typeof gross.amount !== "number") return null;
	return `${outcome.reason}|${gross.currency}|${gross.amount.toFixed(4)}`;
}

/**
 * Does this evaluation still offer the very taxed quote the customer accepted? "Pokračovať s DPH" in the Information
 * step saves the form first and asks again; only an answer that is the same taxed quote (same reason, same total)
 * lets the customer go on with it. Anything else — exempt now, another reason, another total — is shown instead.
 */
export function confirmsTaxedQuote(
	view: { outcome: B2bUiOutcome; checkout: QuoteLike | null },
	acceptedQuote: string | null,
): boolean {
	if (!acceptedQuote || !view.checkout) return false;
	const { outcome } = view;
	return (
		outcome.kind === "taxed" &&
		outcome.needsTaxedConfirmation &&
		taxedQuoteKey(view.checkout, outcome) === acceptedQuote
	);
}
