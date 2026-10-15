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
 * The Menabo roof-rack category (CFM opened its 3 558 sets on 2026-10-14): the car filter belongs to the shelf
 * (`fitment-shelves.ts`), and the root URL to the live list of Saleor's categories, exactly as for Green Valley
 * (`green-valley-shelf.test.ts`). The category was already public when the shelf row was missing, so what this
 * pins is that the shelf answers whether or not the build's list or Saleor's live list knows the slug.
 */

const MENABO = "menabo-stresne-nosice";
const T0 = new Date("2026-10-15T12:00:00Z").getTime();

beforeEach(() => {
	// One clock for the whole test, as in `live-categories.test.ts`.
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

describe("the Menabo shelf", () => {
	it("has the car filter before the live list knows the category", () => {
		expect(categoryFitmentKind(MENABO)).toBe("roof-rack-set");
		expect(isCategorySlug(MENABO)).toBe(false);
		expect(categoryUrl(MENABO)).toBe(`/categories/${MENABO}`);
	});

	it("gets its root URL in Slovakia from Saleor's list, and keeps the car filter", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(MENABO);

		await refreshLiveCategories();

		expect(liveCategoriesStats().admitted).toEqual([MENABO]);
		expect(isCategorySlug(MENABO)).toBe(true);
		expect(categoryUrlFor("sk", MENABO)).toBe(`/${MENABO}`);
		expect(categoryBaseSlug("sk", MENABO)).toBe(MENABO);
		expect(categoryFitmentKind(MENABO)).toBe("roof-rack-set");
	});

	it("keeps the car filter when a product holds the slug and the root URL is refused", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(MENABO);
		world.products[MENABO] = ["sk-eur"];

		await refreshLiveCategories();

		expect(isCategorySlug(MENABO)).toBe(false);
		expect(liveCategoriesStats().refused[MENABO]).toBe("a product holds this slug in sk-eur");
		expect(categoryFitmentKind(MENABO)).toBe("roof-rack-set");
	});
});
