import { describe, expect, it } from "vitest";
import { buildProductJsonLd } from "./json-ld";

describe("product JSON-LD truthfulness", () => {
	it("does not invent MAKY.STORE as a product brand", () => {
		const data = buildProductJsonLd({ name: "Nosič" });
		expect(data).not.toHaveProperty("brand");
		expect(data).not.toHaveProperty("offers");
		expect(data).not.toHaveProperty("image");
	});

	it("emits known brand, source SKU and MPN", () => {
		const data = buildProductJsonLd({ name: "Nosič", brand: "Nordrive", sku: "N15011", mpn: "N15011" });
		expect(data).toMatchObject({
			brand: { "@type": "Brand", name: "Nordrive" },
			sku: "N15011",
			mpn: "N15011",
		});
	});
});

/**
 * Availability, which is the claim Google Merchant checks against reality.
 *
 * The catalogue is dropship: `trackInventory=false`, no stock records, and
 * Saleor answering `quantityAvailable` with a synthetic configuration cap of 50
 * for every variant. Reading that as stock produced `schema.org/InStock` on
 * every product page — a stock claim on a shop that holds no stock.
 */
describe("product JSON-LD availability", () => {
	const offer = (data: ReturnType<typeof buildProductJsonLd>) =>
		(data as { offers?: Record<string, unknown> }).offers;

	const price = { amount: 129.9, currency: "EUR" };

	it("declares BackOrder for a CFM sale-to-order product", () => {
		const data = buildProductJsonLd({ name: "Nosič", price, availabilityMode: "sale_to_order" });
		expect(offer(data)).toMatchObject({ availability: "https://schema.org/BackOrder" });
	});

	it("declares BackOrder on an AggregateOffer too", () => {
		const data = buildProductJsonLd({
			name: "Nosič",
			priceRange: { lowPrice: 129.9, highPrice: 189.9, currency: "EUR" },
			availabilityMode: "sale_to_order",
		});
		expect(offer(data)).toMatchObject({
			"@type": "AggregateOffer",
			availability: "https://schema.org/BackOrder",
		});
	});

	it("never says InStock for sale-to-order, whatever quantityAvailable implied", () => {
		// `inStock: true` here is the storefront's own `variants.some(quantityAvailable)`,
		// which the synthetic cap of 50 makes true for every product in the shop.
		const data = buildProductJsonLd({
			name: "Nosič",
			price,
			inStock: true,
			availabilityMode: "sale_to_order",
		});
		expect(offer(data)).not.toMatchObject({ availability: "https://schema.org/InStock" });
	});

	it("never invents a quantity", () => {
		// The 50 must not reappear as an inventoryLevel. Schema.org's term for
		// "orderable, not held" carries the whole claim on its own.
		const data = buildProductJsonLd({ name: "Nosič", price, availabilityMode: "sale_to_order" });
		expect(offer(data)).not.toHaveProperty("inventoryLevel");
		expect(JSON.stringify(data)).not.toContain("50");
	});

	it("lets a hard unavailable win over the mode, as the badge does", () => {
		// Nothing orderable is orderable-on-demand — same precedence as
		// resolveAvailability in src/ui/components/product/availability-badge.tsx.
		const data = buildProductJsonLd({
			name: "Nosič",
			price,
			inStock: false,
			availabilityMode: "sale_to_order",
		});
		expect(offer(data)).toMatchObject({ availability: "https://schema.org/OutOfStock" });
	});

	it("leaves the pre-CFM behaviour alone when no mode is published", () => {
		expect(offer(buildProductJsonLd({ name: "Nosič", price }))).toMatchObject({
			availability: "https://schema.org/InStock",
		});
		expect(offer(buildProductJsonLd({ name: "Nosič", price, inStock: false }))).toMatchObject({
			availability: "https://schema.org/OutOfStock",
		});
	});

	it("does not treat an unrecognised mode as sale-to-order", () => {
		for (const mode of ["sale-to-order", "SALE_TO_ORDER", "in_stock", "", null]) {
			const data = buildProductJsonLd({ name: "Nosič", price, availabilityMode: mode });
			expect(offer(data), String(mode)).toMatchObject({ availability: "https://schema.org/InStock" });
		}
	});
});
