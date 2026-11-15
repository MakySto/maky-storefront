import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The category itself, the read every category page starts from (2026-11-15: its `COUNT(*)` over 26 000 roof-rack
 * sets was repeated every minute in every market, with the visitor waiting): it keeps its last answer and
 * refreshes it behind the visitor, an empty or absent category is never kept, a fault is an outcome and never
 * an answer, and a change Saleor announces takes the answer out of use.
 */

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: mocks.executePublicGraphQL }));

import { expireCategoryAnswers } from "@/lib/listing/category-invalidation";
import {
	__forgetCategoryOutcome,
	prewarmCategoryOutcome,
	readCategoryOutcome,
} from "@/lib/listing/category-outcome";
import { __forgetAllKept } from "@/lib/cache/kept-read";

const SK = "sk-eur";
const LOCALE = "sk-SK";
const category = (count: number, name = "Strešné nosiče") => ({
	ok: true,
	data: {
		category: { id: "c1", name, slug: "stresne-nosice", translation: null, products: { totalCount: count } },
	},
});
const absent = { ok: true, data: { category: null } };
const down = { ok: false, error: { type: "network", isRetryable: true, message: "deadline exceeded" } };

beforeEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
	__forgetAllKept();
	__forgetCategoryOutcome();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("the category itself", () => {
	it("asks Saleor once for a category that holds products, and keeps the answer", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(category(26_278));
		const first = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		const again = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(first.status).toBe("found");
		expect(again).toEqual(first);
		expect(mocks.executePublicGraphQL).toHaveBeenCalledTimes(1);
		expect(mocks.executePublicGraphQL.mock.calls[0]![1].variables.first).toBe(1);
	});

	it("never keeps an empty category, which ends on its own when the products arrive", async () => {
		mocks.executePublicGraphQL.mockResolvedValueOnce(category(0)).mockResolvedValueOnce(category(3));
		const empty = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		const stocked = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(empty.status === "found" && empty.resource.products?.totalCount).toBe(0);
		expect(stocked.status === "found" && stocked.resource.products?.totalCount).toBe(3);
		expect(mocks.executePublicGraphQL).toHaveBeenCalledTimes(2);
	});

	it("does not keep an absent category either", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(absent);
		expect((await readCategoryOutcome("nothing", "sk-eur", LOCALE)).status).toBe("not-found");
		await readCategoryOutcome("nothing", "sk-eur", LOCALE);
		// Base slug, and the translated slug a second time for a foreign market only: `sk` asks once per read.
		expect(mocks.executePublicGraphQL).toHaveBeenCalledTimes(2);
	});

	it("hands a fault back as the outcome it is, with Saleor's own message", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(down);
		const outcome = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(outcome).toMatchObject({ status: "upstream-error", message: "deadline exceeded" });
	});

	it("keeps the earlier answer when a later read fails, and the visitor never sees the fault", async () => {
		vi.useFakeTimers();
		mocks.executePublicGraphQL.mockResolvedValueOnce(category(26_278));
		await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
		mocks.executePublicGraphQL.mockResolvedValue(down);

		const stale = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		await vi.advanceTimersByTimeAsync(10);

		expect(stale.status).toBe("found");
		expect(await readCategoryOutcome("stresne-nosice", SK, LOCALE)).toMatchObject({ status: "found" });
	});

	it("is loaded by the boot warm-up and then answers at once", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(category(26_278));
		await expect(prewarmCategoryOutcome("stresne-nosice", SK, LOCALE)).resolves.toBe(true);
		mocks.executePublicGraphQL.mockClear();
		await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(mocks.executePublicGraphQL).not.toHaveBeenCalled();
	});
});

describe("a change Saleor announces", () => {
	it("a category event makes the next visit wait for the new answer", async () => {
		mocks.executePublicGraphQL.mockResolvedValueOnce(category(26_278, "Staré meno"));
		await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		mocks.executePublicGraphQL.mockResolvedValue(category(26_278, "Nové meno"));

		expect(expireCategoryAnswers(SK, "stresne-nosice", "drop")).toBeGreaterThan(0);

		const outcome = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(outcome.status === "found" && outcome.resource.name).toBe("Nové meno");
	});

	it("a product event hands the old answer once while the new one is read behind it", async () => {
		mocks.executePublicGraphQL.mockResolvedValueOnce(category(26_278, "Staré"));
		await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		mocks.executePublicGraphQL.mockResolvedValue(category(26_279, "Nové"));

		expireCategoryAnswers(SK, "stresne-nosice", "stale");

		const once = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(once.status === "found" && once.resource.name).toBe("Staré");
		await new Promise((resolve) => setTimeout(resolve, 5));
		const next = await readCategoryOutcome("stresne-nosice", SK, LOCALE);
		expect(next.status === "found" && next.resource.name).toBe("Nové");
	});

	it("leaves the same category in another channel alone", async () => {
		mocks.executePublicGraphQL.mockResolvedValue(category(10));
		await readCategoryOutcome("stresne-nosice", "cz-czk", "cs-CZ");
		expect(expireCategoryAnswers(SK, "stresne-nosice", "drop")).toBe(0);
	});
});
