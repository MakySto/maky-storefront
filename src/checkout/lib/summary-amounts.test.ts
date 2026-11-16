import { describe, expect, it } from "vitest";
import { summaryAmounts, type SummaryAmounts } from "./summary-amounts";

/**
 * The figures are the ones the live Saleor returned on 2026-11-16: one test checkout (two items, 95.01 and 90.00,
 * delivery 5.99) with each kind of code applied in turn, and the owner's German cart (two sets of snow chains,
 * 234.99 and 75.99, delivery 5.99) with a fixed and a percentage code. The summary must add up in every one.
 */
describe("summaryAmounts", () => {
	const addsUp = (result: SummaryAmounts, total: number) =>
		expect(Math.round((result.subtotal + result.shipping - result.discount - result.giftCard) * 100)).toBe(
			Math.round(total * 100),
		);
	const TWO_ITEMS = { list: [95.01, 90] };
	const lines = (totals: number[], list: Array<number | null> = TWO_ITEMS.list) =>
		totals.map((total, index) => ({ total, listTotal: list[index] }));

	it("changes nothing when no code is applied", () => {
		const result = summaryAmounts({
			subtotal: 185.01,
			shipping: 5.99,
			total: 191,
			discount: 0,
			hasGiftCard: false,
			lines: lines([95.01, 90]),
			shippingListPrice: 5.99,
		});
		expect(result).toEqual({
			subtotal: 185.01,
			shipping: 5.99,
			discount: 0,
			giftCard: 0,
			lineTotals: [95.01, 90],
			appliedDiscount: 0,
		});
		addsUp(result, 191);
	});

	describe("a code on the goods", () => {
		it("keeps the owner's lines at their own prices and gives a fixed code a row (ZLAVA20EUR)", () => {
			const result = summaryAmounts({
				subtotal: 290.98,
				shipping: 5.99,
				total: 296.97,
				discount: 20,
				hasGiftCard: false,
				lines: lines([219.88, 71.1], [234.99, 75.99]),
				shippingListPrice: 5.99,
			});
			expect(result).toEqual({
				subtotal: 310.98,
				shipping: 5.99,
				discount: 20,
				giftCard: 0,
				lineTotals: [234.99, 75.99],
				appliedDiscount: 0,
			});
			addsUp(result, 296.97);
		});

		it("does the same for a percentage code (10 % of 310.98)", () => {
			const result = summaryAmounts({
				subtotal: 279.88,
				shipping: 5.99,
				total: 285.87,
				discount: 31.1,
				hasGiftCard: false,
				lines: lines([211.49, 68.39], [234.99, 75.99]),
				shippingListPrice: 5.99,
			});
			expect(result).toMatchObject({ subtotal: 310.98, discount: 31.1, lineTotals: [234.99, 75.99] });
			addsUp(result, 285.87);
		});

		it("works in the cart, where no delivery is chosen yet", () => {
			const result = summaryAmounts({
				subtotal: 290.98,
				shipping: 0,
				total: 290.98,
				discount: 20,
				hasGiftCard: false,
				lines: lines([219.88, 71.1], [234.99, 75.99]),
			});
			expect(result).toMatchObject({ subtotal: 310.98, shipping: 0, discount: 20, appliedDiscount: 0 });
			addsUp(result, 290.98);
		});

		it("lets a cent of Saleor's per-line rounding pass, and still adds up to the total", () => {
			// Three lines of 33.33 with 10 % off: 30.00 each as Saleor rounds them, a discount of 10.00, a list sum of 99.99.
			const result = summaryAmounts({
				subtotal: 90,
				shipping: 0,
				total: 90,
				discount: 10,
				hasGiftCard: false,
				lines: lines([30, 30, 30], [33.33, 33.33, 33.33]),
			});
			expect(result.discount).toBe(10);
			addsUp(result, 90);
		});

		it("stays with Saleor's figures and states the discount when the catalogue prices do not explain it", () => {
			// A company order without VAT: the lines are net, the catalogue prices gross.
			const sent = {
				subtotal: 150,
				shipping: 5,
				total: 155,
				discount: 10,
				hasGiftCard: false,
				lines: lines([80, 70], [118.08, 103.32]),
				shippingListPrice: 5,
			};
			expect(summaryAmounts(sent)).toEqual({
				subtotal: 150,
				shipping: 5,
				discount: 0,
				giftCard: 0,
				lineTotals: [80, 70],
				appliedDiscount: 10,
			});
		});

		it("stays with Saleor's figures when a line has no catalogue price", () => {
			const result = summaryAmounts({
				subtotal: 175.76,
				shipping: 5.99,
				total: 181.75,
				discount: 9.25,
				hasGiftCard: false,
				lines: lines([90.26, 85.5], [95.01, null]),
			});
			expect(result).toMatchObject({ subtotal: 175.76, discount: 0, appliedDiscount: 9.25 });
			expect(result.lineTotals).toEqual([90.26, 85.5]);
		});

		it("states the discount under the total when no lines are given at all", () => {
			const result = summaryAmounts({
				subtotal: 175.76,
				shipping: 5.99,
				total: 181.75,
				discount: 9.25,
				hasGiftCard: false,
			});
			expect(result).toEqual({
				subtotal: 175.76,
				shipping: 5.99,
				discount: 0,
				giftCard: 0,
				lineTotals: null,
				appliedDiscount: 9.25,
			});
			addsUp(result, 181.75);
		});
	});

	describe("a delivery code", () => {
		it("shows the delivery at its listed price and the code as the row that takes it off", () => {
			const result = summaryAmounts({
				subtotal: 185.01,
				shipping: 0,
				total: 185.01,
				discount: 5.99,
				hasGiftCard: false,
				lines: lines([95.01, 90]),
				shippingListPrice: 5.99,
			});
			expect(result).toEqual({
				subtotal: 185.01,
				shipping: 5.99,
				discount: 5.99,
				giftCard: 0,
				lineTotals: [95.01, 90],
				appliedDiscount: 0,
			});
			addsUp(result, 185.01);
		});

		it("is stated under the total when the delivery's listed price is not known", () => {
			const result = summaryAmounts({
				subtotal: 185.01,
				shipping: 0,
				total: 185.01,
				discount: 5.99,
				hasGiftCard: false,
				lines: lines([95.01, 90]),
			});
			expect(result).toMatchObject({ shipping: 0, discount: 0, appliedDiscount: 5.99 });
		});
	});

	describe("a gift card", () => {
		it("gets a row of its own: only the total is lower", () => {
			const result = summaryAmounts({
				subtotal: 185.01,
				shipping: 5.99,
				total: 181,
				discount: 0,
				hasGiftCard: true,
				lines: lines([95.01, 90]),
				shippingListPrice: 5.99,
			});
			expect(result).toMatchObject({ subtotal: 185.01, discount: 0, giftCard: 10, appliedDiscount: 0 });
			addsUp(result, 181);
		});

		it("stands beside a code on the goods, each with its row", () => {
			const result = summaryAmounts({
				subtotal: 180.01,
				shipping: 5.99,
				total: 176,
				discount: 5,
				hasGiftCard: true,
				lines: lines([92.44, 87.57]),
				shippingListPrice: 5.99,
			});
			expect(result).toMatchObject({ subtotal: 185.01, discount: 5, giftCard: 10, appliedDiscount: 0 });
			expect(result.lineTotals).toEqual([95.01, 90]);
			addsUp(result, 176);
		});

		it("keeps its row when the code beside it cannot be taken out of the rows", () => {
			const result = summaryAmounts({
				subtotal: 180.01,
				shipping: 5.99,
				total: 176,
				discount: 5,
				hasGiftCard: true,
			});
			expect(result).toMatchObject({ subtotal: 180.01, discount: 0, giftCard: 10, appliedDiscount: 5 });
			addsUp(result, 176);
		});

		it("is how an order's unexplained deduction is read (the order query does not carry its cards)", () => {
			expect(summaryAmounts({ subtotal: 185.01, shipping: 5.99, total: 181, discount: 0 })).toMatchObject({
				giftCard: 10,
				discount: 0,
				appliedDiscount: 0,
			});
		});
	});

	it("shows the discount as a row when the rows were NOT reduced, and does not state it twice", () => {
		// Not what Saleor does today for a checkout. If a version or a placed order reports it this way, the summary
		// must still add up.
		const result = summaryAmounts({ subtotal: 185.01, shipping: 5.99, total: 181.75, discount: 9.25 });
		expect(result).toMatchObject({ subtotal: 185.01, discount: 9.25, giftCard: 0, appliedDiscount: 0 });
		addsUp(result, 181.75);
	});

	it("does not invent a gift card for a deduction it cannot explain on a checkout without one", () => {
		// The goods explain the code, but the total is lower still and no card is on the checkout: as Saleor sent it.
		const result = summaryAmounts({
			subtotal: 290.98,
			shipping: 5.99,
			total: 290,
			discount: 20,
			hasGiftCard: false,
			lines: lines([219.88, 71.1], [234.99, 75.99]),
		});
		expect(result.giftCard).toBe(0);
		expect(result.lineTotals).toEqual([219.88, 71.1]);
	});

	it("ignores rounding noise and a total above the rows", () => {
		const noise = summaryAmounts({
			subtotal: 0.1 + 0.2,
			shipping: 0,
			total: 0.3,
			discount: 0,
			hasGiftCard: false,
		});
		expect([noise.discount, noise.giftCard]).toEqual([0, 0]);
		const above = summaryAmounts({ subtotal: 100, shipping: 5, total: 110, discount: 0, hasGiftCard: true });
		expect([above.discount, above.giftCard]).toEqual([0, 0]);
	});

	it("never reports a negative or a non-number discount", () => {
		expect(summaryAmounts({ subtotal: 10, shipping: 0, total: 10, discount: -3 }).appliedDiscount).toBe(0);
		expect(
			summaryAmounts({ subtotal: 10, shipping: 0, total: 10, discount: Number.NaN }).appliedDiscount,
		).toBe(0);
	});
});
