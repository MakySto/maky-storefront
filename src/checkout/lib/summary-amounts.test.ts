import { describe, expect, it } from "vitest";
import { summaryAmounts } from "./summary-amounts";

/**
 * The figures are the ones the live Saleor returned for one test checkout on 2026-11-16 (two items, 95.01 and
 * 90.00, delivery 5.99), with each kind of code applied in turn. The summary must add up in every one of them.
 */
describe("summaryAmounts", () => {
	const addsUp = (subtotal: number, shipping: number, total: number, deduction: number) =>
		expect(Math.round((subtotal + shipping - deduction) * 100)).toBe(Math.round(total * 100));

	it("adds nothing when no code is applied", () => {
		expect(
			summaryAmounts({ subtotal: 185.01, shipping: 5.99, total: 191, discount: 0, hasGiftCard: false }),
		).toEqual({ deduction: null, appliedDiscount: 0 });
	});

	it("does not take a percentage voucher off a second time: Saleor already reduced the subtotal", () => {
		const result = summaryAmounts({
			subtotal: 175.76,
			shipping: 5.99,
			total: 181.75,
			discount: 9.25,
			hasGiftCard: false,
		});
		expect(result).toEqual({ deduction: null, appliedDiscount: 9.25 });
		addsUp(175.76, 5.99, 181.75, 0);
	});

	it("treats a fixed-amount voucher the same way", () => {
		expect(
			summaryAmounts({ subtotal: 180.01, shipping: 5.99, total: 186, discount: 5, hasGiftCard: false }),
		).toEqual({ deduction: null, appliedDiscount: 5 });
	});

	it("states a free-delivery voucher under the total: the delivery row is already 0", () => {
		expect(
			summaryAmounts({ subtotal: 185.01, shipping: 0, total: 185.01, discount: 5.99, hasGiftCard: false }),
		).toEqual({ deduction: null, appliedDiscount: 5.99 });
	});

	it("gives a gift card a row of its own: only the total is lower", () => {
		const result = summaryAmounts({
			subtotal: 185.01,
			shipping: 5.99,
			total: 181,
			discount: 0,
			hasGiftCard: true,
		});
		expect(result).toEqual({ deduction: { kind: "giftCard", amount: 10 }, appliedDiscount: 0 });
		addsUp(185.01, 5.99, 181, 10);
	});

	it("keeps a voucher and a gift card apart", () => {
		const result = summaryAmounts({
			subtotal: 180.01,
			shipping: 5.99,
			total: 176,
			discount: 5,
			hasGiftCard: true,
		});
		expect(result).toEqual({ deduction: { kind: "giftCard", amount: 10 }, appliedDiscount: 5 });
		addsUp(180.01, 5.99, 176, 10);
	});

	it("shows the discount as a row when the rows were NOT reduced, and does not state it twice", () => {
		// Not what Saleor does today for a checkout. If a version or a placed order reports it this way, the summary
		// must still add up.
		const result = summaryAmounts({ subtotal: 185.01, shipping: 5.99, total: 181.75, discount: 9.25 });
		expect(result).toEqual({ deduction: { kind: "discount", amount: 9.25 }, appliedDiscount: 0 });
		addsUp(185.01, 5.99, 181.75, 9.25);
	});

	it("reads an order's unexplained deduction as a gift card (the order query does not carry its cards)", () => {
		expect(summaryAmounts({ subtotal: 185.01, shipping: 5.99, total: 181, discount: 0 })).toEqual({
			deduction: { kind: "giftCard", amount: 10 },
			appliedDiscount: 0,
		});
	});

	it("ignores rounding noise and a total above the rows", () => {
		expect(
			summaryAmounts({ subtotal: 0.1 + 0.2, shipping: 0, total: 0.3, discount: 0, hasGiftCard: false })
				.deduction,
		).toBeNull();
		expect(
			summaryAmounts({ subtotal: 100, shipping: 5, total: 110, discount: 0, hasGiftCard: true }).deduction,
		).toBeNull();
	});

	it("never reports a negative or a non-number discount", () => {
		expect(summaryAmounts({ subtotal: 10, shipping: 0, total: 10, discount: -3 }).appliedDiscount).toBe(0);
		expect(
			summaryAmounts({ subtotal: 10, shipping: 0, total: 10, discount: Number.NaN }).appliedDiscount,
		).toBe(0);
	});
});
