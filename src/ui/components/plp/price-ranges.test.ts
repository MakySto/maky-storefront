import { describe, expect, it } from "vitest";

import {
	niceRound,
	parsePriceRange,
	priceBandFormatter,
	priceBoundaries,
	priceRangeLabel,
	priceRangeOptions,
	spanBoundaries,
} from "./price-ranges";

const sk = {
	under: (m: string) => `Do ${m}`,
	between: (a: string, b: string) => `${a} – ${b}`,
	over: (m: string) => `Od ${m}`,
};
const eur = priceBandFormatter("sk-SK", "EUR");
// Intl puts a narrow no-break space between amount and symbol; compare on plain spaces.
const plain = (text: string) => text.replace(/\s/g, " ");

describe("price bands", () => {
	it("round to amounts a person would pick", () => {
		expect([7, 23, 48, 72, 130, 275, 380, 640, 1900].map(niceRound)).toEqual([
			8, 25, 50, 75, 150, 250, 400, 600, 2000,
		]);
		// Nothing below ten carries cents.
		expect([0.4, 1.4, 2.4, 7.4].map(niceRound)).toEqual([1, 2, 3, 8]);
	});

	it("cut a listing where its own prices fall", () => {
		// Roof boxes: many cheap bags and covers, then boxes from 200 to 999 €.
		const prices = [
			...Array.from({ length: 40 }, (_, i) => 6 + i),
			...Array.from({ length: 60 }, (_, i) => 219 + i * 13),
		];
		const boundaries = priceBoundaries(prices);
		expect(boundaries).toHaveLength(3);
		expect(boundaries).toEqual([...boundaries].sort((a, b) => a - b));
		for (const boundary of boundaries) {
			expect(boundary).toBeGreaterThan(6);
			expect(boundary).toBeLessThan(219 + 59 * 13);
			expect(niceRound(boundary)).toBe(boundary);
		}
	});

	it("offer nothing for a handful of products", () => {
		expect(priceBoundaries([199, 249, 279, 319, 349, 399, 400])).toEqual([]);
	});

	it("spread a large listing between its cheapest and dearest product", () => {
		expect(spanBoundaries(72, 245)).toEqual([100, 150, 200]);
		expect(spanBoundaries(28_090, 95_490)).toEqual([40_000, 50_000, 75_000]);
		expect(spanBoundaries(100, 100)).toEqual([]);
	});

	it("name the bands in the market's words and currency — never 'Under $50'", () => {
		const options = priceRangeOptions([60, 250, 400], eur, sk);
		expect(options.map((option) => option.value)).toEqual(["0-60", "60-250", "250-400", "400-"]);
		expect(options.map((option) => plain(option.label))).toEqual([
			"Do 60 €",
			"60 € – 250 €",
			"250 € – 400 €",
			"Od 400 €",
		]);
		expect(plain(priceRangeOptions([2500], priceBandFormatter("cs-CZ", "CZK"), sk)[0]!.label)).toBe(
			"Do 2 500 Kč",
		);
	});

	it("name any ?price= value, including one no band offers", () => {
		expect(plain(priceRangeLabel("50-100", eur, sk))).toBe("50 € – 100 €");
		expect(plain(priceRangeLabel("200-", eur, sk))).toBe("Od 200 €");
		expect(priceRangeLabel("junk", eur, sk)).toBe("junk");
		expect(parsePriceRange("12.5-")).toEqual({ min: 12.5, max: null });
	});
});
