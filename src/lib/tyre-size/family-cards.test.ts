import { describe, expect, it } from "vitest";

import { familyCardsFromNodes } from "./family-cards";

/**
 * The snow-chain shelf by model: one card per family, counted and priced from what the channel sells.
 *
 * The family a product belongs to is the sealed family file's answer for its public code; everything else on the card
 * is the shop's own, so a product the shop does not price is not counted and a family it sells nothing of has no card.
 */

const node = (code: string, amount: number | null, image: string | null = null, variants = 1) => ({
	id: `id-${code}`,
	thumbnail: image ? { url: image } : null,
	pricing: amount === null ? null : { priceRange: { start: { gross: { amount, currency: "EUR" } } } },
	variants: Array.from({ length: variants }, (_, index) => ({ id: `v-${code}-${index}`, name: code })),
});

describe("the shelf by model family", () => {
	it("counts a family's products and takes the lowest price and that product's photograph", () => {
		const cards = familyCardsFromNodes([
			node("N16075", 47.9, "https://img.example/r9-b.jpg"),
			node("N16061", 41.9, "https://img.example/r9-a.jpg"),
			node("N16074", 44.9),
		]);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({
			count: 3,
			price: 41.9,
			currency: "EUR",
			image: "https://img.example/r9-a.jpg",
		});
		expect(cards[0]?.page.key).toBe("snowdrive-r9");
	});

	it("keeps a photograph when the cheapest product has none", () => {
		const [card] = familyCardsFromNodes([
			node("N16075", 47.9, "https://img.example/r9-b.jpg"),
			node("N16061", 41.9),
		]);
		expect(card?.price).toBe(41.9);
		expect(card?.image).toBe("https://img.example/r9-b.jpg");
	});

	it("lists chains before socks, and the cheapest first inside each", () => {
		const cards = familyCardsFromNodes([node("N17143", 20), node("D0190", 85.9), node("N16075", 47.9)]);
		expect(cards.map((card) => [card.page.product, card.page.key])).toEqual([
			["chain", "snowdrive-r9"],
			["chain", "dac-oto-top-16"],
			["sock", "snowdrive-ponozky"],
		]);
	});

	it("leaves out what it cannot speak for: no price, no code of the list, several variants", () => {
		expect(
			familyCardsFromNodes([node("N16075", null), node("TK20409", 199), node("N16061", 41.9, null, 2)]),
		).toEqual([]);
		expect(familyCardsFromNodes([])).toEqual([]);
	});
});
