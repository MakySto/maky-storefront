import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: (namespace: string) => (key: string) => {
		const messages: Record<string, string> = {
			"cart.addUnavailable": "This product is not available to order right now.",
			"common.addToCart": "Add to cart",
			"common.onDemand": "Made to order",
			"common.viewDetail": "View product",
			"product.noImageAvailable": "No image available",
			"product.priceWithVat": "Price incl. VAT",
		};
		return messages[`${namespace}.${key}`] ?? `${namespace}.${key}`;
	},
}));
vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

import { ProductCard, type ProductCardData } from "./product-card";

const catalogOnlyProduct: ProductCardData = {
	id: "product-1",
	name: "Catalog roof rack",
	slug: "catalog-roof-rack",
	variantId: "variant-1",
	quantityAvailable: 50,
	availabilityMode: "sale_to_order",
	price: 189.99,
	currency: "USD",
	image: "",
	href: "/catalog-roof-rack",
	channel: "us-usd",
	isPurchasable: false,
};

describe("ProductCard catalog-only product", () => {
	it("renders price and detail navigation without an add-to-cart form or delivery promise", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: catalogOnlyProduct }));

		expect(html).toContain("Catalog roof rack");
		expect(html).toMatch(/189[.,]99/);
		expect(html).toContain("This product is not available to order right now.");
		expect(html).toContain("View product");
		expect(html).toContain('href="/catalog-roof-rack"');
		expect(html).not.toContain("Made to order");
		expect(html).not.toContain(">Add to cart<");
		expect(html).not.toContain("<form");
		expect(html).not.toContain('name="variantId"');
	});
});
