/**
 * What a discount code or a gift card adds to the order summary, so that the rows above the total always add up
 * to it and no amount is taken off twice.
 *
 * Measured on the live Saleor (2026-11-16): with a voucher the checkout's `subtotalPrice` and line totals arrive
 * ALREADY reduced, a free-delivery voucher arrives as a `shippingPrice` of 0, and `discount` says how much that
 * was. A row "Discount −X" among the addends would take the same money off a second time. A gift card is the
 * opposite: `discount` stays 0 and only the total is lower.
 *
 * So nothing is assumed about which of the two Saleor did. The rows are compared with the total: what they
 * exceed it by is a deduction that needs a row of its own, and a discount that is already inside the rows is
 * said under the total, where the VAT line is, as a statement and not as an addend.
 */

export type SummaryAmountsInput = {
	subtotal: number;
	shipping: number;
	total: number;
	/** What the discount code took off, as Saleor reports it. */
	discount: number;
	/**
	 * Whether a gift card is on the checkout. `undefined` for a placed order, whose query does not carry its gift
	 * cards: a deduction that is not the discount is then read as one.
	 */
	hasGiftCard?: boolean;
};

export type SummaryDeduction = { kind: "giftCard" | "discount"; amount: number };

export type SummaryAmounts = {
	/** A row for the list of addends: what the total is lower by than the rows above it. */
	deduction: SummaryDeduction | null;
	/** A discount that the rows above already contain; shown under the total. 0 when there is none to state. */
	appliedDiscount: number;
};

/** Half a cent: below it two amounts are the same amount (Saleor rounds each figure on its own). */
const SAME_AMOUNT = 0.005;

const toCents = (amount: number): number => Math.round(amount * 100) / 100;

export function summaryAmounts(input: SummaryAmountsInput): SummaryAmounts {
	const discount = Number.isFinite(input.discount) && input.discount > 0 ? input.discount : 0;
	const gap = toCents(input.subtotal + input.shipping - input.total);

	if (!Number.isFinite(gap) || gap <= SAME_AMOUNT) {
		return { deduction: null, appliedDiscount: discount };
	}

	const gapIsTheDiscount = discount > 0 && Math.abs(gap - discount) <= SAME_AMOUNT;
	const giftCard = input.hasGiftCard ?? !gapIsTheDiscount;

	if (giftCard) {
		// The card pays part of the total; a discount code beside it is still inside the rows above.
		return { deduction: { kind: "giftCard", amount: gap }, appliedDiscount: discount };
	}
	// The rows were not reduced, so the discount is the row; saying it again under the total would double it.
	return { deduction: { kind: "discount", amount: gap }, appliedDiscount: 0 };
}
