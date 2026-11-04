import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheLife } from "next/cache";
import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import { executePublicGraphQL, executeRawGraphQL } from "@/lib/graphql";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn(), executeRawGraphQL: vi.fn() }));
vi.mock("@/lib/cms/brands", () => ({ getCmsBrands: vi.fn() }));

const { mergeBrands, HOMEPAGE_BRAND_SLUGS, stockedBrandSlugs, prewarmBrandMakers, __forgetBrandMakers } =
	await import("./catalog");

const logo = {
	id: "1",
	url: "https://cms-media.maky.store/media/thule.png",
	alt: "Thule",
	width: 400,
	height: 120,
	mimeType: "image/png",
	sizes: {},
	focalX: 50,
	focalY: 50,
};

describe("brand catalogue", () => {
	it("lists Saleor's makers alphabetically, dressed with the Payload entry of the same slug", () => {
		const brands = mergeBrands(
			[
				{ slug: "yakima", name: "Yakima", productCount: 4 },
				{ slug: "thule", name: "Thule", productCount: 40 },
				{ slug: "kjust", name: "KJUST", productCount: 24 },
			],
			[
				{
					slug: "thule",
					name: "THULE (CMS spelling)",
					shortDescription: "Švédska značka.",
					logo,
					heroImage: null,
				},
				{ slug: "dometic", name: "Dometic", shortDescription: null, logo: null, heroImage: null },
			],
		);
		expect(brands.map((brand) => brand.slug)).toEqual(["kjust", "thule", "yakima"]);
		const thule = brands.find((brand) => brand.slug === "thule")!;
		// Saleor's name stays: it is what the product cards print.
		expect(thule).toMatchObject({
			name: "Thule",
			productCount: 40,
			approved: true,
			shortDescription: "Švédska značka.",
		});
		expect(thule.logo?.url).toBe(logo.url);
		expect(brands.find((brand) => brand.slug === "kjust")?.approved).toBe(false);
		// A Payload entry with no Saleor maker gets no page.
		expect(brands.some((brand) => brand.slug === "dometic")).toBe(false);
	});

	it("promotes only the makers CLAUDE.md §6 approves for the homepage", () => {
		expect(HOMEPAGE_BRAND_SLUGS).toEqual([
			"thule",
			"yakima",
			"menabo",
			"nordrive",
			"peruzzo",
			"pro-user",
			"spinder",
			"green-valley",
			"snowdrive",
			"dac",
		]);
		for (const banned of ["cruz", "hak-system", "galia", "oris", "jaeger", "dometic", "ikamper"]) {
			expect(HOMEPAGE_BRAND_SLUGS).not.toContain(banned);
		}
	});
});

describe("the makers a market sells, read from Saleor", () => {
	const SK = "sk-eur";
	const makers = (...slugs: string[]) => ({
		ok: true as const,
		data: {
			attribute: { choices: { edges: slugs.map((slug) => ({ node: { slug, name: slug.toUpperCase() } })) } },
		},
	});
	const counts = (...totals: number[]) => ({
		ok: true as const,
		data: Object.fromEntries(totals.map((totalCount, index) => [`b${index}`, { totalCount }])),
	});
	const down = { ok: false as const, error: { type: "network", message: "BrandCounts: Failed to execute" } };

	beforeEach(() => {
		vi.clearAllMocks();
		__forgetBrandMakers();
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	it("sends the counts through the shared queue with a deadline of their own, and keeps only stocked makers", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule", "yakima") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(7, 0) as never);

		expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule"]);

		expect(executeRawGraphQL).not.toHaveBeenCalled();
		const [document, options] = vi.mocked(executePublicGraphQL).mock.calls[1]!;
		expect(String(document)).toContain("query BrandCounts");
		expect(options).toMatchObject({ variables: { channel: SK }, retry: false });
		expect(options.signal).toBeInstanceOf(AbortSignal);
	});

	it("does not send a query without a single count when Saleor holds no maker", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers() as never);

		expect((await stockedBrandSlugs(SK)).size).toBe(0);
		expect(executePublicGraphQL).toHaveBeenCalledTimes(1);
	});

	it("shows the last answer at once when it is stale, asks again behind it, and has the entry expire within seconds", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(3) as never);
		await stockedBrandSlugs(SK);
		vi.mocked(executePublicGraphQL).mockClear();

		// The process's answer is older than it may stand in for asking again.
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.now() + 20 * 60_000);
		try {
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule", "yakima") as never);
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(3, 5) as never);
			vi.mocked(cacheLife).mockClear();

			// The visitor is answered from what the process holds, not after Saleor has counted again.
			expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule"]);
			expect(vi.mocked(cacheLife).mock.calls.at(-1)?.[0]).toEqual(FAULT_CACHE_LIFE);

			// The new answer arrives behind it, and the next read has it.
			await vi.waitFor(() => expect(executePublicGraphQL).toHaveBeenCalledTimes(2));
			await vi.waitFor(async () => expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule", "yakima"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps showing the last answer when the read behind it fails, and leaves the market alone for a minute", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(3) as never);
		await stockedBrandSlugs(SK);
		vi.mocked(executePublicGraphQL).mockClear();

		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.now() + 20 * 60_000);
		try {
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(down as never);
			expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule"]);
			await vi.waitFor(() => expect(executePublicGraphQL).toHaveBeenCalledTimes(2));

			vi.mocked(executePublicGraphQL).mockClear();
			for (let i = 0; i < 5; i += 1) expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule"]);
			expect(executePublicGraphQL).not.toHaveBeenCalled();

			// After the pause it is asked once more.
			vi.setSystemTime(Date.now() + 61_000);
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
			vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(4) as never);
			await stockedBrandSlugs(SK);
			await vi.waitFor(() => expect(executePublicGraphQL).toHaveBeenCalledTimes(2));
		} finally {
			vi.useRealTimers();
		}
	});

	it("asks the counts a dozen makers at a time, one request after the other, and stops at the first that fails", async () => {
		const slugs = Array.from({ length: 30 }, (_, i) => `maker-${i}`);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers(...slugs) as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(...Array(12).fill(1)) as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(down as never);

		await expect(stockedBrandSlugs(SK)).rejects.toThrow("[Brands] counts unavailable");

		// The list, the first twelve, the second twelve (failed) — and not the last six.
		expect(executePublicGraphQL).toHaveBeenCalledTimes(3);
		const [first, second] = [1, 2].map((call) =>
			String(vi.mocked(executePublicGraphQL).mock.calls[call]![0]),
		);
		expect(first.match(/totalCount/g)).toHaveLength(12);
		expect(first).toContain('values: ["maker-0"]');
		expect(second).toContain('values: ["maker-12"]');
	});

	it("does not ask a market again within the minute after a failure, from a request or the warm-up", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(down as never);
		await expect(stockedBrandSlugs(SK)).rejects.toThrow();
		vi.mocked(executePublicGraphQL).mockClear();

		await expect(stockedBrandSlugs(SK)).rejects.toThrow("[Brands] counts unavailable");
		await prewarmBrandMakers({ gapMs: 0 });
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("never counts more than two markets at the same moment", async () => {
		let running = 0;
		let overlap = 0;
		vi.mocked(executePublicGraphQL).mockImplementation((async (document: unknown) => {
			running += 1;
			overlap = Math.max(overlap, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			running -= 1;
			return String(document).includes("BrandCounts") ? counts(1) : makers("thule");
		}) as never);

		const markets = ["sk-eur", "cz-czk", "de-eur", "at-eur", "pl-pln", "hu-huf"];
		await Promise.all(markets.map((channel) => stockedBrandSlugs(channel)));
		expect(overlap).toBeLessThanOrEqual(2);
		expect(executePublicGraphQL).toHaveBeenCalledTimes(markets.length * 2);
	});

	it("throws, as before, where no earlier answer exists — an outage is not 'this shop has no brands'", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(down as never);

		await expect(stockedBrandSlugs(SK)).rejects.toThrow(
			"[Brands] counts unavailable: BrandCounts: Failed to execute",
		);
	});

	it("is not asked again within the ten minutes it stands in for asking", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(makers("thule") as never);
		vi.mocked(executePublicGraphQL).mockResolvedValueOnce(counts(3) as never);
		await stockedBrandSlugs(SK);
		vi.mocked(executePublicGraphQL).mockClear();

		expect([...(await stockedBrandSlugs(SK))]).toEqual(["thule"]);
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("warm-up asks one market at a time and never rejects", async () => {
		let running = 0;
		let overlap = 0;
		vi.mocked(executePublicGraphQL).mockImplementation((async (document: unknown) => {
			running += 1;
			overlap = Math.max(overlap, running);
			await new Promise((resolve) => setTimeout(resolve, 1));
			running -= 1;
			return String(document).includes("BrandCounts") ? counts(1) : makers("thule");
		}) as never);

		await expect(prewarmBrandMakers({ gapMs: 0 })).resolves.toBeUndefined();
		expect(overlap).toBe(1);

		vi.mocked(executePublicGraphQL).mockResolvedValue(down as never);
		__forgetBrandMakers();
		await expect(prewarmBrandMakers({ gapMs: 0 })).resolves.toBeUndefined();
	});

	it("warm-up stops at the first market Saleor cannot count, instead of asking the rest", async () => {
		vi.mocked(executePublicGraphQL).mockImplementation((async (document: unknown) =>
			String(document).includes("BrandCounts") ? down : makers("thule")) as never);

		await prewarmBrandMakers({ gapMs: 0 });

		// One market's list and its failed count: two requests, not two per live market.
		expect(executePublicGraphQL).toHaveBeenCalledTimes(2);
	});
});
