import { describe, expect, it } from "vitest";

import { resolveMaximumQuantity } from "./cart-line-actions";

describe("resolveMaximumQuantity", () => {
	it("does not allow an increase when tracked stock is zero", () => {
		expect(
			resolveMaximumQuantity({
				quantity: 2,
				trackInventory: true,
				quantityAvailable: 0,
				quantityLimitPerCustomer: null,
			}),
		).toBe(2);
	});

	it("uses the strictest tracked-stock and customer limit", () => {
		expect(
			resolveMaximumQuantity({
				quantity: 1,
				trackInventory: true,
				quantityAvailable: 6,
				quantityLimitPerCustomer: 4,
			}),
		).toBe(4);
	});

	it("ignores Saleor's synthetic availability when inventory is not tracked", () => {
		expect(
			resolveMaximumQuantity({
				quantity: 1,
				trackInventory: false,
				quantityAvailable: 1,
				quantityLimitPerCustomer: 8,
			}),
		).toBe(8);
	});

	it("never strands a checkout line above a newly lowered limit", () => {
		expect(
			resolveMaximumQuantity({
				quantity: 5,
				trackInventory: true,
				quantityAvailable: 2,
				quantityLimitPerCustomer: 3,
			}),
		).toBe(5);
	});
});
