import { describe, expect, it } from "vitest";

import { variantsForSelection } from "./variant-section-dynamic";

/**
 * VariantSelectionSection is a client component, so whatever it is handed is
 * serialized into the RSC flight payload and shipped inside the PDP's HTML.
 * Passing Saleor's variants straight through put MAKY's internal identifier
 * there — a third copy on every page, next to the two in the JSON-LD, and the
 * only one the customer-facing `publicProductCode` never covered.
 *
 * Nothing about the rendered page changes when this widens again, which is why
 * it is pinned here rather than left to review.
 */
describe("variantsForSelection", () => {
	const saleorVariant = {
		id: "UHJvZHVjdFZhcmlhbnQ6MTI1OA==",
		name: "N21059|N20003|N15424|N15424",
		sku: "N21059|N20003|N15424|N15424|CFMP-B-NOR-72670303068409-000000",
		sourceSku: null,
		quantityAvailable: 50,
		selectionAttributes: [],
		nonSelectionAttributes: [],
		pricing: { price: { gross: { amount: 299, currency: "EUR" } } },
		media: [{ url: "https://example.invalid/x.webp" }],
		metafield: "sale_to_order",
	};

	it("drops the internal identifier before it can cross the client boundary", () => {
		const [projected] = variantsForSelection([saleorVariant]);
		expect(JSON.stringify(projected)).not.toContain("CFMP-");
		expect(projected).not.toHaveProperty("sku");
		expect(projected).not.toHaveProperty("sourceSku");
	});

	it("passes exactly the six fields the client component declares — no more", () => {
		// An allow-list, not a deny-list: a new field added to the Saleor query
		// must be opted in here deliberately, rather than shipped by default.
		const [projected] = variantsForSelection([saleorVariant]);
		expect(Object.keys(projected).sort()).toEqual([
			"id",
			"name",
			"nonSelectionAttributes",
			"pricing",
			"quantityAvailable",
			"selectionAttributes",
		]);
	});

	it("keeps what the selector actually needs", () => {
		const [projected] = variantsForSelection([saleorVariant]);
		expect(projected.id).toBe(saleorVariant.id);
		expect(projected.name).toBe("N21059|N20003|N15424|N15424");
		expect(projected.quantityAvailable).toBe(50);
		expect(projected.pricing).toEqual(saleorVariant.pricing);
	});

	it("is empty for an empty catalogue rather than throwing", () => {
		expect(variantsForSelection([])).toEqual([]);
	});
});
