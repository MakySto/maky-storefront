import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

import { type ProductListItemFragment } from "@/gql/graphql";
import { ProductCard, type ProductCardData } from "./product-card";
import { transformToProductCard } from "./utils";

/**
 * The listing card never shows the grey "no image" GIF as the product's photo.
 *
 * Measured 2026-09-22: 108 of 414 non-roof-rack Slovak products carry it, and a grid of them
 * reads as a wall of broken images. The card has had a localized "no image" state all along;
 * these products now get it.
 */

const PLACEHOLDER =
	"https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff_thumbnail_4.gif";
const REAL = "https://cdn.maky.store/products/autochladnicka-40l.jpg";

/** The fields `transformToProductCard` reads; the rest of the fragment is irrelevant here. */
const listItem = (thumbnailUrl: string | null) =>
	({
		id: "UHJvZHVjdDox",
		name: "Autochladnička 40 l",
		slug: "autochladnicka-40-l",
		isAvailableForPurchase: true,
		rating: null,
		created: null,
		attributes: [],
		category: null,
		pricing: { priceRange: { start: { gross: { amount: 147, currency: "EUR" } } } },
		thumbnail: thumbnailUrl ? { url: thumbnailUrl, alt: "Autochladnička" } : null,
		variants: [],
	}) as unknown as ProductListItemFragment;

describe("transformToProductCard", () => {
	it("keeps a real thumbnail", () => {
		expect(transformToProductCard(listItem(REAL), "sk-eur", "sk-SK").image).toBe(REAL);
	});

	it("treats the placeholder exactly like a missing thumbnail", () => {
		expect(transformToProductCard(listItem(PLACEHOLDER), "sk-eur", "sk-SK").image).toBe(
			transformToProductCard(listItem(null), "sk-eur", "sk-SK").image,
		);
	});
});

describe("ProductCard", () => {
	const card = (image: string): ProductCardData => ({
		id: "p1",
		name: "Autochladnička 40 l",
		slug: "autochladnicka-40-l",
		price: 147,
		currency: "EUR",
		image,
		href: "/sk/autochladnicka-40-l",
		channel: "sk-eur",
		isPurchasable: true,
	});

	it("renders the localized no-image state for the placeholder, and no <img>", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card(PLACEHOLDER) }));
		expect(html).toContain("product.noImageAvailable");
		expect(html).not.toContain("<img");
		expect(html).not.toContain("c32bc543a46f5bf4");
	});

	it("still renders a real photo", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: card(REAL) }));
		expect(html).toContain("<img");
		expect(html).not.toContain("product.noImageAvailable");
	});
});
