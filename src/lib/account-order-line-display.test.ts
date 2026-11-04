import { describe, expect, it } from "vitest";

import { accountOrderLineDisplay } from "./account-order-line-display";

const base = {
	id: "v1",
	name: "Čierna / M",
	product: { name: "Strešný nosič Nordrive", slug: "stresny-nosic-nordrive-1" },
};

describe("accountOrderLineDisplay", () => {
	it("shows the market's own product name, variant label and link", () => {
		const display = accountOrderLineDisplay(
			{},
			{
				...base,
				translation: { name: "Schwarz / M" },
				product: {
					...base.product,
					translation: { name: "Dachträger Nordrive", slug: "dachtraeger-nordrive-1" },
				},
			},
		);
		expect(display).toEqual({
			productName: "Dachträger Nordrive",
			productSlug: "dachtraeger-nordrive-1",
			variantName: "Schwarz / M",
		});
	});

	it("falls back to the name the order was placed under, then to the base row", () => {
		expect(
			accountOrderLineDisplay(
				{ translatedProductName: "Dachträger", translatedVariantName: "Schwarz" },
				base,
			),
		).toEqual({ productName: "Dachträger", productSlug: base.product.slug, variantName: "Schwarz" });
		expect(accountOrderLineDisplay({ translatedProductName: "  " }, base)).toEqual({
			productName: "Strešný nosič Nordrive",
			productSlug: base.product.slug,
			variantName: "Čierna / M",
		});
	});

	it("hides a variant label that is only the variant id", () => {
		expect(accountOrderLineDisplay({}, { ...base, name: "v1" }).variantName).toBeNull();
		expect(accountOrderLineDisplay({}, { ...base, name: "" }).variantName).toBeNull();
	});
});
