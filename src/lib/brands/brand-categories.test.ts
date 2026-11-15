import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheLife } from "next/cache";
import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import { executePublicGraphQL } from "@/lib/graphql";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn() }));

const { brandCategoriesFromNodes, brandCategoryList, brandTitle, getBrandCategories } = await import(
	"./brand-categories"
);

const node = (slug: string, name: string, totalCount: number | null, translated?: string) => ({
	id: `id-${slug}`,
	slug,
	name,
	translation: translated === undefined ? null : { name: translated },
	products: totalCount === null ? null : { totalCount },
});

const NODES = [
	node("stresne-boxy", "Strešné boxy", 41),
	node("stresne-nosice", "Strešné nosiče", 9666),
	node("snehove-retaze", "Snehové reťaze", 0),
	node("nosice-bicyklov", "Nosiče bicyklov", 25),
	node("autochladnicky", "Autochladničky", null),
];

describe("what a maker sells, by category", () => {
	it("keeps the categories that hold something of the maker, the fullest first", () => {
		expect(brandCategoriesFromNodes(NODES, "sk-SK")).toEqual([
			{ id: "id-stresne-nosice", slug: "stresne-nosice", name: "Strešné nosiče", productCount: 9666 },
			{ id: "id-stresne-boxy", slug: "stresne-boxy", name: "Strešné boxy", productCount: 41 },
			{ id: "id-nosice-bicyklov", slug: "nosice-bicyklov", name: "Nosiče bicyklov", productCount: 25 },
		]);
	});

	it("names a category in the market's language, and keeps its base slug for the address", () => {
		expect(brandCategoriesFromNodes([node("stresne-boxy", "Strešné boxy", 3, "Dachboxen")], "de-DE")).toEqual(
			[{ id: "id-stresne-boxy", slug: "stresne-boxy", name: "Dachboxen", productCount: 3 }],
		);
	});

	it("leaves out, abroad, a category Saleor has no name for in that language: its page is not found there", () => {
		expect(
			brandCategoriesFromNodes(
				[
					node("stresne-boxy", "Strešné boxy", 3),
					node("autochladnicky", "Autochladničky", 5, ""),
					node("nosice-lyzi", "Nosiče lyží", 2, "Skiträger"),
				],
				"de-DE",
			).map((category) => category.name),
		).toEqual(["Skiträger"]);
	});

	it("needs no translation at home", () => {
		expect(
			brandCategoriesFromNodes([node("stresne-boxy", "Strešné boxy", 3)], "sk-SK").map((c) => c.name),
		).toEqual(["Strešné boxy"]);
	});
});

describe("the brand page's title", () => {
	const categories = brandCategoriesFromNodes(NODES, "sk-SK");

	it("names the maker and the categories it is fullest in, as many as fit", () => {
		expect(brandTitle("Thule", categories)).toBe("Thule: Strešné nosiče, Strešné boxy, Nosiče bicyklov");
		expect(brandTitle("Thule", categories).length).toBeLessThanOrEqual(55);
	});

	it("stops before the title outgrows a search result", () => {
		const long = brandCategoriesFromNodes(
			[
				node("a", "Strešné nosiče a koše na dodávky", 9),
				node("b", "Príslušenstvo k nosičom bicyklov", 5),
				node("c", "Snehové reťaze", 2),
			],
			"sk-SK",
		);
		expect(brandTitle("Green Valley", long)).toBe("Green Valley: Strešné nosiče a koše na dodávky");
	});

	it("always names one category, however long, and the maker alone when there is none", () => {
		const one = brandCategoriesFromNodes(
			[node("a", "Prepravné klietky a boxy pre psov do auta a na cesty", 2)],
			"sk-SK",
		);
		expect(brandTitle("Pro-User", one)).toBe(
			"Pro-User: Prepravné klietky a boxy pre psov do auta a na cesty",
		);
		expect(brandTitle("Pro-User", [])).toBe("Pro-User");
	});
});

describe("the brand page's description", () => {
	it("lists the categories with their counts, in the market's number format", () => {
		const categories = brandCategoriesFromNodes(NODES, "sk-SK");
		expect(brandCategoryList(categories, "en-US")).toBe(
			"Strešné nosiče (9,666), Strešné boxy (41), Nosiče bicyklov (25)",
		);
		expect(brandCategoryList(categories, "sk-SK").replace(/\s/g, " ")).toBe(
			"Strešné nosiče (9 666), Strešné boxy (41), Nosiče bicyklov (25)",
		);
		expect(brandCategoryList(categories, "en-US", 2)).toBe("Strešné nosiče (9,666), Strešné boxy (41)");
	});
});

describe("getBrandCategories", () => {
	beforeEach(() => {
		vi.mocked(executePublicGraphQL).mockReset();
		vi.mocked(cacheLife).mockReset();
	});

	it("asks Saleor once, for this channel, this language and this maker", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValue({
			ok: true,
			data: { categories: { edges: NODES.map((entry) => ({ node: entry })) } },
		} as never);

		const categories = await getBrandCategories("sk-eur", "thule");

		expect(categories.map((category) => category.slug)).toEqual([
			"stresne-nosice",
			"stresne-boxy",
			"nosice-bicyklov",
		]);
		expect(executePublicGraphQL).toHaveBeenCalledTimes(1);
		const [document, options] = vi.mocked(executePublicGraphQL).mock.calls[0]!;
		expect(String(document)).toContain("query BrandCategories");
		expect(options).toMatchObject({
			variables: { channel: "sk-eur", lang: "SK", brand: ["thule"] },
			retry: false,
		});
	});

	it("answers with no categories when Saleor does not, and remembers that for seconds only", async () => {
		vi.mocked(executePublicGraphQL).mockResolvedValue({
			ok: false,
			error: { type: "network", message: "deadline exceeded", isRetryable: true },
		} as never);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		expect(await getBrandCategories("sk-eur", "thule")).toEqual([]);
		expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("categories unavailable for thule"));
		warn.mockRestore();
	});

	it("answers with no categories when the read throws", async () => {
		vi.mocked(executePublicGraphQL).mockRejectedValue(new Error("socket hang up"));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(await getBrandCategories("sk-eur", "thule")).toEqual([]);
		warn.mockRestore();
	});
});
