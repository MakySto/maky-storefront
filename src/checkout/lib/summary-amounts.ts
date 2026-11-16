/**
 * The figures of an order summary (cart, checkout, placed order) when a discount code or a gift card is on it:
 * what each line shows, and the rows above the total, which always add up to it.
 *
 * Measured on the live Saleor (2026-11-16): with a voucher the checkout's line totals and `subtotalPrice` arrive
 * ALREADY reduced, a free-delivery voucher arrives as a `shippingPrice` of 0, and `discount` says how much that
 * was. A gift card is the opposite: `discount` stays 0 and only the total is lower.
 *
 * Shown as Saleor sends it, a customer who enters a code sees the prices of the goods change and no longer sees
 * what they cost (owner, 2026-11-16). So the discount is taken back out and gets a row of its own:
 *
 *     goods at their own prices   310,98
 *     delivery                      5,99
 *     discount (CODE)             −20,00
 *     total                       296,97
 *
 * It is only taken out where the figures prove where it went, so that no amount is taken off twice:
 *  - a delivery code, when the chosen delivery's listed price is higher than the charged one by the discount;
 *  - a code on the goods, when the lines at their catalogue prices add up to the reduced subtotal plus the discount.
 * Where neither holds (a line without a catalogue price, a tax context that changes the prices) the rows stay as
 * Saleor sent them and the discount is said under the total, as a statement and not as an addend.
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
	/**
	 * Each line: what Saleor charges for it, and what it costs without a code (its catalogue price, a catalogue
	 * promotion included, times the quantity) when that is known.
	 */
	lines?: ReadonlyArray<{ total: number; listTotal?: number | null }>;
	/** The listed price of the chosen delivery, when one is chosen and its price is known. */
	shippingListPrice?: number | null;
};

export type SummaryAmounts = {
	/** The goods row. With a code on the goods this is the sum before the code. */
	subtotal: number;
	/** The delivery row. With a delivery code this is the delivery's listed price. */
	shipping: number;
	/** The discount code as a row of its own; 0 when there is none or it could not be taken out of the rows. */
	discount: number;
	/** The gift card as a row of its own; 0 when there is none. */
	giftCard: number;
	/** What each line shows, in the order given; null when no lines were given. */
	lineTotals: number[] | null;
	/** A discount that stayed inside the rows above; said under the total. 0 when there is none to state. */
	appliedDiscount: number;
};

/** Half a cent: below it two amounts are the same amount (Saleor rounds each figure on its own). */
const SAME_AMOUNT = 0.005;

const toCents = (amount: number): number => Math.round(amount * 100) / 100;
const isAmount = (value: number | null | undefined): value is number =>
	typeof value === "number" && Number.isFinite(value);

export function summaryAmounts(input: SummaryAmountsInput): SummaryAmounts {
	const discount = isAmount(input.discount) && input.discount > 0 ? input.discount : 0;
	const lines = input.lines ?? null;
	const asSent: SummaryAmounts = {
		subtotal: input.subtotal,
		shipping: input.shipping,
		discount: 0,
		giftCard: 0,
		lineTotals: lines ? lines.map((line) => line.total) : null,
		appliedDiscount: 0,
	};

	// Where the code went: delivery, goods, or nowhere that can be shown.
	let shown = asSent;
	if (discount > 0) {
		const listed = input.shippingListPrice;
		if (isAmount(listed) && Math.abs(listed - input.shipping - discount) <= SAME_AMOUNT) {
			shown = { ...asSent, shipping: listed, discount };
		} else if (lines?.length && lines.every((line) => isAmount(line.listTotal))) {
			const listSum = lines.reduce((sum, line) => sum + (line.listTotal as number), 0);
			// Saleor rounds each line's share of the discount on its own: a cent per line may go astray.
			if (Math.abs(listSum - (input.subtotal + discount)) <= SAME_AMOUNT + 0.01 * lines.length) {
				shown = {
					...asSent,
					subtotal: toCents(input.subtotal + discount),
					discount,
					lineTotals: lines.map((line) => toCents(line.listTotal as number)),
				};
			}
		}
	}

	const gap = toCents(shown.subtotal + shown.shipping - shown.discount - input.total);
	if (!Number.isFinite(gap)) return { ...asSent, appliedDiscount: discount };
	if (shown.discount > 0) {
		if (Math.abs(gap) <= SAME_AMOUNT) return shown;
		// The rest of what the total is lower by is the gift card's. Anything else is not understood: as sent.
		if (gap > 0 && input.hasGiftCard !== false) return { ...shown, giftCard: gap };
	}

	const sentGap = toCents(input.subtotal + input.shipping - input.total);
	if (sentGap <= SAME_AMOUNT) return { ...asSent, appliedDiscount: discount };
	const gapIsTheDiscount = discount > 0 && Math.abs(sentGap - discount) <= SAME_AMOUNT;
	if (input.hasGiftCard ?? !gapIsTheDiscount) {
		// The card pays part of the total; a discount code beside it is still inside the rows above.
		return { ...asSent, giftCard: sentGap, appliedDiscount: discount };
	}
	// The rows were not reduced, so the discount is the row; saying it again under the total would double it.
	return { ...asSent, discount: sentGap };
}
