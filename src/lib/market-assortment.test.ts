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

	it("leaves a channel whose read failed alone for the pause, and says so once", async () => {
		fetchStockedCategorySlugs.mockRejectedValue(new Error("deadline exceeded"));
		const { getMarketAssortment } = await subject();
		const warn = vi.mocked(console.warn);
		warn.mockClear();

		for (let i = 0; i < 6; i += 1) expect((await getMarketAssortment("cz-czk")).state).toBe("unknown");
		// One read reached Saleor and one line was written; the other five renders did neither.
		expect(fetchStockedCategorySlugs).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledTimes(1);

		// Another channel is not held back by it.
		await getMarketAssortment("de-eur");
		expect(fetchStockedCategorySlugs).toHaveBeenCalledTimes(2);

		// After the pause the channel is asked again, and an answer ends the fault.
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			vi.setSystemTime(Date.now() + 60_000);
			fetchStockedCategorySlugs.mockResolvedValue(["stresne-nosice"]);
			expect((await getMarketAssortment("cz-czk")).state).toBe("known");
			expect(fetchStockedCategorySlugs).toHaveBeenCalledTimes(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("answers a failed read without reading `Date` outside the cached read, which would fail a prerender", async () => {
		// Next throws on `Date.now()` read outside a cache scope while a route is prerendered, and the
		// branch that answers a failed read runs exactly then. A `Date.now()` there turned a slow Saleor
		// into a 500 for the whole page (/at/, 2026-11-05) instead of "the last answer" or "link all".
		// The cached read (`readOfferedCategories`) may read it: a cache scope allows it.
		const real = Date.now.bind(Date);
		const outsideCache: string[] = [];
		vi.spyOn(Date, "now").mockImplementation(() => {
			const stack = new Error().stack ?? "";
			if (stack.includes("getMarketAssortment") && !stack.includes("readOfferedCategories")) {
				outsideCache.push(stack.split("\n")[2]?.trim() ?? "?");
				throw new Error("unstable value `Date.now()` while prerendering");
			}
			return real();
		});
		try {
			const { getMarketAssortment } = await subject();

			// nothing remembered: every category stays linked, and one line says so
			fetchStockedCategorySlugs.mockRejectedValue(new Error("deadline exceeded"));
			vi.mocked(console.warn).mockClear();
			expect((await getMarketAssortment("at-eur")).state).toBe("unknown");
			expect(console.warn).toHaveBeenCalledTimes(1);

			// something remembered: the last answer stands in
			fetchStockedCategorySlugs.mockReset();
			fetchStockedCategorySlugs
				.mockResolvedValueOnce(["stresne-nosice"])
				.mockRejectedValue(new Error("timeout"));
			await getMarketAssortment("pl-pln");
			expect((await getMarketAssortment("pl-pln")).state).toBe("remembered");

			expect(outsideCache).toEqual([]);
		} finally {
			vi.mocked(Date.now).mockRestore();
		}
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

	it("does not need the snow chains: the range lines of the site text do not name them", async () => {
		const { offersFullRange } = await subject();
		// A market with the whole range and no chains (the USA, Canada) still sells what the lines say...
		expect(offersFullRange({ state: "known", categories: new Set(ALL) })).toBe(true);
		// ...and having the chains does not make up for a missing shelf the lines do name.
		expect(
			offersFullRange({ state: "known", categories: new Set([...ALL.slice(0, 5), "snehove-retaze"]) }),
		).toBe(false);
	});

	it("links the chains only where the market stocks them", async () => {
		const { offersCategory } = await subject();
		expect(
			offersCategory({ state: "known", categories: new Set(["snehove-retaze"]) }, "snehove-retaze"),
		).toBe(true);
		expect(offersCategory({ state: "known", categories: new Set(ALL) }, "snehove-retaze")).toBe(false);
	});
});
