import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The listing's side reads on a Saleor that stalls (2026-11-15: a trivial `{ shop { name } }` took 2.3 s, 7.7 s
 * and 1 s among answers of 40 to 70 ms): the price bands, the maker filter and the row of sub-categories keep
 * their last answer, serve it at once when Saleor is slow, and a big category skips the read that only
 * counted its products.
 */

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ cacheLife: vi.fn(), executePublicGraphQL: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife, cacheTag: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: mocks.executePublicGraphQL }));

import {
	__forgetCategoryPriceBands,
	getCategoryPriceBands,
	prewarmCategoryPriceBands,
} from "@/lib/listing/category-prices";
import { __forgetCategoryFacets, getCategoryFacets } from "@/lib/listing/category-facets";

const SK = "sk-eur";
const money = (amount: number) => ({ amount, currency: "EUR" });
const products = (amount: number, totalCount: number) => ({
	ok: true,
	data: {
		category: {
			products: {
				totalCount,
				pageInfo: { hasNextPage: false, endCursor: null },
				edges: [{ node: { pricing: { priceRange: { start: { gross: money(amount) } } } } }],
			},
		},
	},
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
	__forgetCategoryPriceBands();
	__forgetCategoryFacets();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("price bands", () => {
	it("a category known to be big reads its two ends and nothing else", async () => {
		mocks.executePublicGraphQL.mockImplementation(async (_doc, { variables }) =>
			products(variables.sortBy.direction === "ASC" ? 12 : 480, 26_278),
		);
		const bands = await getCategoryPriceBands("stresne-nosice", SK, true);
		expect(bands?.currency).toBe("EUR");
		expect(bands?.boundaries.length).toBeGreaterThan(0);
		// Two queries, both for one product: not a page of a hundred first.
		expect(mocks.executePublicGraphQL).toHaveBeenCalledTimes(2);
		for (const [, options] of mocks.executePublicGraphQL.mock.calls) {
			expect(options.variables.first).toBe(1);
			expect(options.variables.sortBy.field).toBe("PRICE");
			// Saleor counts the whole category for a selected `totalCount`; nothing here reads it.
			expect(options.variables.withTotal).toBe(false);
		}
	});

	it("a category not known to be big still counts first, as before", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(products(30, 5));
		await getCategoryPriceBands("nosice-lyzi", SK);
		expect(mocks.executePublicGraphQL).toHaveBeenCalledTimes(1);
		expect(mocks.executePublicGraphQL.mock.calls[0]![1].variables.first).toBe(100);
		// The first page decides from the count, so it asks for it.
		expect(mocks.executePublicGraphQL.mock.calls[0]![1].variables.withTotal).not.toBe(false);
	});

	it("the later pages of a small category do not ask for the count again", async () => {
		const page = (hasNextPage: boolean, totalCount: number) => ({
			ok: true,
			data: {
				category: {
					products: {
						totalCount,
						pageInfo: { hasNextPage, endCursor: hasNextPage ? "c1" : null },
						edges: [{ node: { pricing: { priceRange: { start: { gross: money(20) } } } } }],
					},
				},
			},
		});
		mocks.executePublicGraphQL.mockResolvedValueOnce(page(true, 150)).mockResolvedValueOnce(page(false, 150));
		await getCategoryPriceBands("autochladnicky", SK);
		const [first, second] = mocks.executePublicGraphQL.mock.calls.map(([, options]) => options.variables);
		expect(first.withTotal).not.toBe(false);
		expect(second.withTotal).toBe(false);
	});

	it("a Saleor that answers late is not asked again by the next visit, and the late answer is kept", async () => {
		let release: (() => void) | undefined;
		mocks.executePublicGraphQL.mockImplementation(
			(_doc, { variables }) =>
				new Promise((resolve) => {
					release = () => resolve(products(variables.sortBy.direction === "ASC" ? 12 : 480, 26_278));
					setTimeout(release, 30);
				}),
		);
		// The 2 s a visit waits are shortened by the test through a slow source that lands after 30 ms.
		const first = await getCategoryPriceBands("stresne-nosice", SK, true);
		expect(first?.boundaries.length).toBeGreaterThan(0);
		mocks.executePublicGraphQL.mockClear();
		// Within the minute the answer is the kept one: Saleor is not asked at all.
		const again = await getCategoryPriceBands("stresne-nosice", SK, true);
		expect(again).toEqual(first);
		expect(mocks.executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("the boot warm-up leaves the answer kept for the first visitor", async () => {
		mocks.executePublicGraphQL.mockImplementation(async (_doc, { variables }) =>
			products(variables.sortBy.direction === "ASC" ? 12 : 480, 26_278),
		);
		await expect(prewarmCategoryPriceBands("stresne-nosice", SK, true)).resolves.toBe(true);
		mocks.executePublicGraphQL.mockClear();
		await getCategoryPriceBands("stresne-nosice", SK, true);
		expect(mocks.executePublicGraphQL).not.toHaveBeenCalled();
	});
});

describe("maker and volume filters", () => {
	it("a category known to be big asks Saleor nothing: it has no facets", async () => {
		await expect(getCategoryFacets("stresne-nosice", SK, true)).resolves.toBeNull();
		expect(mocks.executePublicGraphQL).not.toHaveBeenCalled();
	});
});
