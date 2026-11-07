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
	it("links to the page where the size is chosen while no size is known, and offers no quick add", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card("N16061") }));

		expect(html).toContain("View product");
		expect(html).toContain('href="/snow-chains"');
		expect(html).not.toContain("<form");
		expect(html).not.toContain('name="variantId"');
		expect(html).not.toContain(">Add to cart<");
	});

	it("adds in one click once the card holds a size that fits it, and says which", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, {
				product: { ...card("N16061"), tyreFit: { size: "215/55 R17", kind: "fits", answer: null } },
			}),
		);

		expect(html).toContain("<form");
		expect(html).toContain('name="variantId"');
		expect(html).toContain('name="tyreMode" value="size"');
		expect(html).toContain('name="tyreSize" value="215/55 R17"');
		expect(html).not.toContain("View product");
	});

	it("keeps the link for a size that does not fit, and for one that still needs a question answered", () => {
		for (const kind of ["no-fit", "ask"] as const) {
			const html = renderToStaticMarkup(
				createElement(ProductCard, { product: { ...card("N16061"), tyreFit: { size: "215/55 R17", kind } } }),
			);
			expect(html, kind).not.toContain("<form");
			expect(html, kind).toContain('href="/snow-chains"');
		}
	});

	it("keeps the quick add for every other purchasable product", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card("A7604") }));

		expect(html).toContain("<form");
		expect(html).toContain('name="variantId"');
	});
});
