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
			"product.requestQuote": "Request a quote",
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

describe("ProductCard of a category that asks for a quote instead of a price", () => {
	const kargo: ProductCardData = {
		...catalogOnlyProduct,
		name: "Kargo van bars",
		category: { id: "c1", name: "Van roof racks", slug: "stresne-nosice-a-kose-na-dodavky" },
	};

	it("shows no price where the market does not sell it, and says how to ask", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: kargo }));

		expect(html).toContain("Kargo van bars");
		expect(html).toContain("Request a quote");
		expect(html).not.toMatch(/189[.,]99/);
		expect(html).not.toContain("This product is not available to order right now.");
		expect(html).toContain("View product");
		expect(html).not.toContain("<form");
	});

	it("keeps the price where the market sells it", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, { product: { ...kargo, isPurchasable: true } }),
		);

		expect(html).toMatch(/189[.,]99/);
		expect(html).not.toContain("Request a quote");
	});

	it("keeps the price of any other category the market does not sell", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, {
				product: {
					...catalogOnlyProduct,
					category: { id: "c2", name: "Car fridges", slug: "autochladnicky" },
				},
			}),
		);

		expect(html).toMatch(/189[.,]99/);
		expect(html).toContain("This product is not available to order right now.");
	});
});
