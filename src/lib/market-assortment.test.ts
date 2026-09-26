import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a market offers decides what its pages promote — and an outage must never read as an
 * empty shop. Measured 2026-09-25: every foreign channel sold only the roof-rack sets while the
 * menus, tiles and hero of eleven markets linked five more categories to "page not found".
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const fetchStockedCategorySlugs = vi.fn();
vi.mock("@/lib/seo/catalogue-walk", () => ({
	fetchStockedCategorySlugs: (...args: unknown[]) => fetchStockedCategorySlugs(...args),
	sitemapTag: (channel: string) => `sitemap:${channel}`,
}));

async function subject() {
	const assortments = await import("./market-assortment");
	assortments.__forgetAssortments();
	return assortments;
}

beforeEach(() => {
	vi.resetModules();
	fetchStockedCategorySlugs.mockReset();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("getMarketAssortment", () => {
	it("asks the sitemap's own question, in the market's language, with a deadline", async () => {
		fetchStockedCategorySlugs.mockResolvedValue(["stresne-nosice"]);
		const { getMarketAssortment } = await subject();
		await getMarketAssortment("de-eur");
		expect(fetchStockedCategorySlugs).toHaveBeenCalledWith("de-eur", "de-DE", { deadlineMs: 1_500 });
	});

	it("known: the categories Saleor names, and no others", async () => {
		fetchStockedCategorySlugs.mockResolvedValue(["stresne-nosice"]);
		const { getMarketAssortment, offersCategory } = await subject();
		const assortment = await getMarketAssortment("de-eur");
		expect(assortment.state).toBe("known");
		expect(offersCategory(assortment, "stresne-nosice")).toBe(true);
		expect(offersCategory(assortment, "stresne-boxy")).toBe(false);
	});

	it("a fault after an answer uses the last answer, not an empty shop", async () => {
		fetchStockedCategorySlugs
			.mockResolvedValueOnce(["stresne-nosice"])
			.mockRejectedValueOnce(new Error("timeout"));
		const { getMarketAssortment, offersCategory } = await subject();
		await getMarketAssortment("de-eur");
		const remembered = await getMarketAssortment("de-eur");
		expect(remembered.state).toBe("remembered");
		expect(offersCategory(remembered, "stresne-nosice")).toBe(true);
		expect(offersCategory(remembered, "stresne-boxy")).toBe(false);
	});

	it("a fault with nothing remembered links everything, as before this module existed", async () => {
		fetchStockedCategorySlugs.mockRejectedValue(new Error("502"));
		const { getMarketAssortment, offersCategory, offersFullRange } = await subject();
		const unknown = await getMarketAssortment("cz-czk");
		expect(unknown.state).toBe("unknown");
		expect(offersCategory(unknown, "stresne-boxy")).toBe(true);
		expect(offersFullRange(unknown)).toBe(true);
	});

	it("remembers per channel: one market's answer never stands in for another's", async () => {
		fetchStockedCategorySlugs
			.mockResolvedValueOnce(["stresne-nosice", "stresne-boxy"])
			.mockRejectedValueOnce(new Error("timeout"));
		const { getMarketAssortment } = await subject();
		await getMarketAssortment("sk-eur");
		expect((await getMarketAssortment("de-eur")).state).toBe("unknown");
	});
});

describe("offersFullRange", () => {
	const ALL = [
		"stresne-nosice",
		"stresne-boxy",
		"nosice-bicyklov",
		"nosice-lyzi",
		"stresne-stany",
		"autochladnicky",
	];

	it("is true only where every homepage category is sold", async () => {
		const { offersFullRange } = await subject();
		expect(offersFullRange({ state: "known", categories: new Set(ALL) })).toBe(true);
		expect(offersFullRange({ state: "known", categories: new Set(ALL.slice(0, 5)) })).toBe(false);
		expect(offersFullRange({ state: "known", categories: new Set(["stresne-nosice"]) })).toBe(false);
	});
});
