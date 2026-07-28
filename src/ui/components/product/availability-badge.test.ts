import { describe, expect, it } from "vitest";
import { resolveAvailability } from "./availability-badge";

/**
 * The whole point of this resolver is what it does NOT say. The catalogue is
 * sale-to-order with trackInventory=false, so Saleor answers `quantityAvailable`
 * with a synthetic cap (50 for every live variant) — a number that must never
 * become a stock promise.
 */
describe("resolveAvailability", () => {
	it("renders the CFM sale-to-order mode", () => {
		expect(resolveAvailability({ mode: "sale_to_order" })).toEqual({ key: "onDemand", tone: "info" });
	});

	it("says NOTHING when the metadata is absent", () => {
		// CFM has not published availability for this product yet. Silence is the
		// only honest output — a guess here is a promise to the customer.
		expect(resolveAvailability({})).toBeNull();
		expect(resolveAvailability({ mode: null })).toBeNull();
		expect(resolveAvailability({ mode: "" })).toBeNull();
	});

	it("says nothing for an unrecognised mode rather than inventing one", () => {
		expect(resolveAvailability({ mode: "in_stock" })).toBeNull();
		expect(resolveAvailability({ mode: "sale-to-order" })).toBeNull();
	});

	it("never turns a positive quantityAvailable into a stock claim", () => {
		// 50 is Saleor's configuration cap for these variants, not real stock.
		expect(resolveAvailability({ quantityAvailable: 50 })).toBeNull();
		expect(resolveAvailability({ quantityAvailable: 1 })).toBeNull();
		expect(resolveAvailability({ quantityAvailable: 999 })).toBeNull();
	});

	it("does report a hard zero as out of stock", () => {
		expect(resolveAvailability({ quantityAvailable: 0 })).toEqual({ key: "outOfStock", tone: "muted" });
	});

	it("lets a hard zero win over the sale-to-order mode", () => {
		// Nothing orderable is orderable-on-demand.
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: 0 })).toEqual({
			key: "outOfStock",
			tone: "muted",
		});
	});

	it("treats an unknown quantity as unknown, not as zero", () => {
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: null })).toEqual({
			key: "onDemand",
			tone: "info",
		});
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: undefined })).toEqual({
			key: "onDemand",
			tone: "info",
		});
	});
});
