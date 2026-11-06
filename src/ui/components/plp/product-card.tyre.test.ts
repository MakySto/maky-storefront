import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: (namespace: string) => (key: string) => {
		const messages: Record<string, string> = {
			"common.addToCart": "Add to cart",
			"common.viewDetail": "View product",
			"product.noImageAvailable": "No image available",
			"product.priceWithVat": "Price incl. VAT",
		};
		return messages[`${namespace}.${key}`] ?? `${namespace}.${key}`;
	},
}));
vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

import { ProductCard, type ProductCardData } from "./product-card";

const card = (productCode: string): ProductCardData => ({
	id: "product-1",
	name: "Snow chains",
	slug: "snow-chains",
	productCode,
	variantId: "variant-1",
	quantityAvailable: 50,
	availabilityMode: "sale_to_order",
	price: 59.9,
	currency: "EUR",
	image: "",
	href: "/snow-chains",
	channel: "sk-eur",
	isPurchasable: true,
});

describe("ProductCard of a product that is added with a tyre size", () => {
	it("links to the page where the size is chosen, and offers no quick add", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card("N16061") }));

		expect(html).toContain("View product");
		expect(html).toContain('href="/snow-chains"');
		expect(html).not.toContain("<form");
		expect(html).not.toContain('name="variantId"');
		expect(html).not.toContain(">Add to cart<");
	});

	it("keeps the quick add for every other purchasable product", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card("A7604") }));

		expect(html).toContain("<form");
		expect(html).toContain('name="variantId"');
	});
});
