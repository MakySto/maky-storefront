import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { categoryFitmentKind, categoryUrl, isCategorySlug } from "@/config/categories";
import { categoryBaseSlug, categoryUrlFor } from "@/config/category-routes";
import {
	liveCategoriesStats,
	refreshLiveCategories,
	resetLiveCategoriesForTests,
} from "@/lib/live-categories";
import { installFakeSaleor } from "@/lib/live-categories.testkit";

/**
 * The Green Valley roof-rack category (CFM creates it in Saleor, 2026-10): what the storefront does with it
 * before it exists, and the moment it does.
 *
 * Two facts decide the answer to CFM, and both are read off the code here rather than remembered:
 *
 *   - the car filter belongs to the SHELF (`fitment-shelves.ts`), which is looked up by the base slug and so
 *     works the same whether the category is in the build's list or was learned from Saleor a minute ago;
 *   - the category's root URL belongs to the LIVE LIST (`live-categories.ts`), so it needs no edit and no
 *     deploy, only that Saleor holds the category and no product holds its slug.
 */

const GREEN_VALLEY = "green-valley-stresne-nosice";
const T0 = new Date("2026-10-12T12:00:00Z").getTime();

beforeEach(() => {
	// One clock for the whole test, as in `live-categories.test.ts`: the list measures its refresh interval
	// against it, and a test on the real clock would pass on the day it was written and not on every day after.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(T0);
	resetLiveCategoriesForTests();
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetLiveCategoriesForTests();
});

describe("the Green Valley shelf before Saleor has the category", () => {
	it("already has the car filter, and no root URL yet", () => {
		expect(categoryFitmentKind(GREEN_VALLEY)).toBe("roof-rack-set");
		expect(isCategorySlug(GREEN_VALLEY)).toBe(false);
		expect(categoryUrl(GREEN_VALLEY)).toBe(`/categories/${GREEN_VALLEY}`);
	});
});

describe("the Green Valley shelf once CFM has created the category", () => {
	it("gets its root URL in Slovakia by itself, and keeps the car filter", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(GREEN_VALLEY);

		await refreshLiveCategories();

		expect(liveCategoriesStats().admitted).toEqual([GREEN_VALLEY]);
		expect(isCategorySlug(GREEN_VALLEY)).toBe(true);
		expect(categoryUrlFor("sk", GREEN_VALLEY)).toBe(`/${GREEN_VALLEY}`);
		expect(categoryBaseSlug("sk", GREEN_VALLEY)).toBe(GREEN_VALLEY);
		expect(categoryFitmentKind(GREEN_VALLEY)).toBe("roof-rack-set");
	});

	it("is refused a root URL, and says so, when a product already holds its slug — and still has the filter", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(GREEN_VALLEY);
		world.products[GREEN_VALLEY] = ["sk-eur"];

		await refreshLiveCategories();

		expect(isCategorySlug(GREEN_VALLEY)).toBe(false);
		expect(liveCategoriesStats().refused[GREEN_VALLEY]).toBe("a product holds this slug in sk-eur");
		expect(categoryUrl(GREEN_VALLEY)).toBe(`/categories/${GREEN_VALLEY}`);
		expect(categoryFitmentKind(GREEN_VALLEY)).toBe("roof-rack-set");
	});
});
