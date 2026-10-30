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
 * The Kargo roof-rack category (Nordrive Kargo, bars and baskets for vans; CFM creates it hidden in Saleor): the car filter belongs to the shelf
 * (`fitment-shelves.ts`), and the root URL to the live list of Saleor's categories, exactly as for Green Valley
 * (`green-valley-shelf.test.ts`) and Menabo. What this pins is that the shelf answers whether or not the build's
 * list or Saleor's live list knows the slug.
 */

const KARGO = "stresne-nosice-a-kose-na-dodavky";
const T0 = new Date("2026-10-28T12:00:00Z").getTime();

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

describe("the Kargo shelf", () => {
	it("has the car filter under the slug it has since 2026-10-30 as well as the one it had", () => {
		expect(categoryFitmentKind("kargo-stresne-nosice-a-stresne-kose-na-dodavky")).toBe("roof-rack-set");
		expect(categoryFitmentKind(KARGO)).toBe("roof-rack-set");
	});

	it("has the car filter before the live list knows the category", () => {
		expect(categoryFitmentKind(KARGO)).toBe("roof-rack-set");
		expect(isCategorySlug(KARGO)).toBe(false);
		expect(categoryUrl(KARGO)).toBe(`/categories/${KARGO}`);
	});

	it("gets its root URL in Slovakia from Saleor's list, and keeps the car filter", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(KARGO);

		await refreshLiveCategories();

		expect(liveCategoriesStats().admitted).toEqual([KARGO]);
		expect(isCategorySlug(KARGO)).toBe(true);
		expect(categoryUrlFor("sk", KARGO)).toBe(`/${KARGO}`);
		expect(categoryBaseSlug("sk", KARGO)).toBe(KARGO);
		expect(categoryFitmentKind(KARGO)).toBe("roof-rack-set");
	});

	it("keeps the car filter when a product holds the slug and the root URL is refused", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(KARGO);
		world.products[KARGO] = ["sk-eur"];

		await refreshLiveCategories();

		expect(isCategorySlug(KARGO)).toBe(false);
		expect(liveCategoriesStats().refused[KARGO]).toBe("a product holds this slug in sk-eur");
		expect(categoryFitmentKind(KARGO)).toBe("roof-rack-set");
	});
});
