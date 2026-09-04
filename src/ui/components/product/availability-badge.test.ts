import { describe, expect, it } from "vitest";
import sk from "@/i18n/messages/sk-SK.json";
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

/**
 * The resolver returns a message KEY; the customer reads a STRING. Asserting the
 * key alone leaves the sentence on the page untested, and the sentence is the
 * part that either is or is not a promise the business can keep.
 *
 * These are dropship items ordered from the supplier on demand, so the Slovak
 * copy states the lead time rather than implying a shelf.
 */
describe("the Slovak sentence a sale-to-order product shows", () => {
	const ON_DEMAND_SK = "Na objednávku, dodanie 5–10 pracovných dní";

	/** Every shape CFM can hand a sale-to-order product. */
	const saleToOrderInputs = [
		{ mode: "sale_to_order" },
		{ mode: "sale_to_order", quantityAvailable: 50 },
		{ mode: "sale_to_order", quantityAvailable: 1 },
		{ mode: "sale_to_order", quantityAvailable: null },
		{ mode: "sale_to_order", quantityAvailable: undefined },
	];

	it("names the order and the delivery window", () => {
		expect(sk.common.onDemand).toBe(ON_DEMAND_SK);

		for (const input of saleToOrderInputs) {
			const resolved = resolveAvailability(input);
			expect(resolved, JSON.stringify(input)).not.toBeNull();
			expect(sk.common[resolved!.key], JSON.stringify(input)).toBe(ON_DEMAND_SK);
		}
	});

	it("never says Skladom and never says Posledné kusy", () => {
		// Both strings exist in the bundle and both would be lies here: `inStock` is
		// only reachable from a stock count nobody keeps, and `lowStock` is an
		// urgency line invented from Saleor's synthetic cap of 50.
		expect(sk.common.inStock).toBe("Skladom");
		expect(sk.product.lowStock).toBe("Posledné kusy");

		for (const input of saleToOrderInputs) {
			const rendered = sk.common[resolveAvailability(input)!.key];
			expect(rendered, JSON.stringify(input)).not.toBe(sk.common.inStock);
			expect(rendered, JSON.stringify(input)).not.toBe(sk.product.lowStock);
		}
	});
});
