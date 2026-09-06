import { describe, expect, it } from "vitest";
import { buildProductJsonLd } from "./json-ld";

describe("product JSON-LD truthfulness", () => {
	it("does not invent MAKY.STORE as a product brand", () => {
		const data = buildProductJsonLd({ name: "Nosič" });
		expect(data).not.toHaveProperty("brand");
		expect(data).not.toHaveProperty("offers");
		expect(data).not.toHaveProperty("image");
	});

	it("emits known brand and SKU", () => {
		const data = buildProductJsonLd({ name: "Nosič", brand: "Nordrive", sku: "N15011" });
		expect(data).toMatchObject({
			brand: { "@type": "Brand", name: "Nordrive" },
			sku: "N15011",
		});
	});

	it("never claims a manufacturer part number", () => {
		// `sku` is the seller's identifier and may be anything the shop uses. `mpn`
		// is a claim about the MANUFACTURER's part number, and nothing in this
		// catalogue supplies one: the value previously emitted was MAKY's internal
		// composite — four Nordrive component codes joined to a CFM suffix — which
		// is not a part number for the assembly being sold.
		expect(buildProductJsonLd({ name: "Nosič", sku: "N21048|N20003|CFMP-B-NOR-57acce" })).not.toHaveProperty(
			"mpn",
		);
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

describe("offers describe what is actually sold", () => {
	const single = {
		name: "Strešný box Nordrive 430",
		url: "/sk/stresny-box-nordrive-430-shiny-black-n60012",
		priceRange: { lowPrice: 299, highPrice: 299, currency: "EUR" },
		variantCount: 1,
		variants: [
			{
				sku: "N60012",
				price: { amount: 299, currency: "EUR" },
				inStock: true,
				availabilityMode: "sale_to_order",
			},
		],
	};

	it("gives a single-variant product an exact Offer, not a price band", () => {
		// Every live product is single-variant, and the PDP passes only
		// `priceRange` — so every PDP was emitting an AggregateOffer whose low and
		// high were the same number, with offerCount 1.
		const jsonLd = buildProductJsonLd(single) as unknown as Record<string, never>;

		expect(jsonLd["@type"]).toBe("Product");
		expect(jsonLd.offers).toMatchObject({ "@type": "Offer", price: 299, priceCurrency: "EUR" });
	});

	it("takes the SKU from the variant that carries the price", () => {
		expect((buildProductJsonLd(single) as unknown as Record<string, never>).sku).toBe("N60012");
	});

	it("keeps BackOrder for a sale-to-order variant", () => {
		const offers = (buildProductJsonLd(single) as unknown as Record<string, never>).offers as Record<
			string,
			string
		>;
		expect(offers.availability).toBe("https://schema.org/BackOrder");
	});

	it("describes a multi-variant product as a ProductGroup", () => {
		const jsonLd = buildProductJsonLd({
			...single,
			priceRange: { lowPrice: 299, highPrice: 349, currency: "EUR" },
			variantCount: 2,
			variants: [
				{ sku: "N60012", price: { amount: 299, currency: "EUR" }, inStock: true },
				{ sku: "N60013", price: { amount: 349, currency: "EUR" }, inStock: false },
			],
		}) as unknown as Record<string, never>;

		expect(jsonLd["@type"]).toBe("ProductGroup");
		const members = jsonLd.hasVariant as unknown as Record<string, never>[];
		expect(members).toHaveLength(2);
		expect(members[0]).toMatchObject({ sku: "N60012" });
		expect((members[1].offers as unknown as Record<string, unknown>).availability).toBe(
			"https://schema.org/OutOfStock",
		);
	});

	it("gives each member its own price rather than a shared band", () => {
		const jsonLd = buildProductJsonLd({
			...single,
			variants: [
				{ sku: "A", price: { amount: 10, currency: "EUR" } },
				{ sku: "B", price: { amount: 20, currency: "EUR" } },
			],
		}) as unknown as Record<string, never>;
		const prices = (jsonLd.hasVariant as unknown as Record<string, never>[]).map(
			(m) => (m.offers as unknown as Record<string, number>).price,
		);
		expect(prices).toEqual([10, 20]);
	});

	it("still falls back to a band when the caller knows no variants", () => {
		// The listing card and anything else without variant detail keeps working.
		const jsonLd = buildProductJsonLd({
			name: "x",
			priceRange: { lowPrice: 10, highPrice: 40, currency: "EUR" },
			variantCount: 3,
		}) as unknown as Record<string, never>;

		expect((jsonLd.offers as unknown as Record<string, string>)["@type"]).toBe("AggregateOffer");
	});
});

/**
 * The builder's own defence. Callers are meant to pass a value already resolved
 * by `publicSku`, but the PDP shipped `sourceSku || sku` for months and put the
 * internal identifier into the `sku` Google reads on 94% of pages. A module whose
 * entire job is deciding what gets published must not depend on every caller
 * remembering — so it refuses the marker itself, in all three sku-bearing fields.
 */
describe("buildProductJsonLd — internal identifiers never publish", () => {
	const leaked = "N21059|N20003|N15424|N15424|CFMP-B-NOR-72670303068409-000000";
	const priced = { amount: 299, currency: "EUR" };
	const skuOf = (data: ReturnType<typeof buildProductJsonLd>) => (data as { sku?: string }).sku;

	it("omits sku entirely rather than publishing the marker", () => {
		const data = buildProductJsonLd({ name: "Strešný nosič", sku: leaked, price: priced });
		expect(data).not.toHaveProperty("sku");
		expect(JSON.stringify(data)).not.toContain("CFMP-");
	});

	it("prefers a clean fallback over a leaking variant sku", () => {
		const data = buildProductJsonLd({
			name: "Strešný nosič",
			sku: "N21059",
			price: priced,
			variants: [{ sku: leaked, name: "v", price: priced, inStock: true }],
		});
		expect(skuOf(data)).toBe("N21059");
	});

	it("strips it from productGroupID and every member of a ProductGroup", () => {
		const data = buildProductJsonLd({
			name: "Strešný nosič",
			sku: leaked,
			variants: [
				{ sku: "A|CFMP-B-NOR-aaa-000000", name: "A", price: priced, inStock: true },
				{ sku: "B|CFMP-B-NOR-bbb-000000", name: "B", price: priced, inStock: true },
			],
		});
		expect(data).toHaveProperty("@type", "ProductGroup");
		expect(data).not.toHaveProperty("productGroupID");
		expect(JSON.stringify(data)).not.toContain("CFMP-");
	});
});
