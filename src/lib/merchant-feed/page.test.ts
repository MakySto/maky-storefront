import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One step of the feed walk: which Saleor read it makes, and that the exact-locale boundary of the
 * product page decides what exists abroad.
 */

const executePublicGraphQL = vi.fn();
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: (...args: unknown[]) => executePublicGraphQL(...args),
}));
const isMarketIndexable = vi.fn((_market: string) => true);
vi.mock("@/lib/market-state", () => ({
	isMarketIndexable: (market: string) => isMarketIndexable(market),
}));

const { readFeedPage, FEED_PAGE_DEFAULT, FEED_PAGE_MAX } = await import("./page");

const MANUFACTURER = "cfm:attribute:manufacturer";

const node = (over: Record<string, unknown> = {}) => ({
	id: "P1",
	isAvailableForPurchase: true,
	name: "Strešný box",
	slug: "stresny-box-1",
	description: null,
	seoTitle: null,
	seoDescription: null,
	translation: null,
	thumbnail: null,
	media: [{ id: "m", url: "https://media.maky.store/a.jpg", type: "IMAGE", sortOrder: 0, alt: "" }],
	category: { id: "C1", name: "Strešné boxy", slug: "stresne-boxy", translation: null },
	attributes: [
		{
			attribute: {
				name: "Výrobca",
				slug: "manufacturer",
				externalReference: MANUFACTURER,
				translation: null,
			},
			values: [{ name: "Thule", slug: "thule", translation: null }],
		},
	],
	variants: [
		{
			id: "V1",
			name: "639901",
			quantityAvailable: 50,
			trackInventory: false,
			metafield: "sale_to_order",
			selectionAttributes: [],
			nonSelectionAttributes: [],
			media: [],
			pricing: { price: { gross: { amount: 899, currency: "EUR" } } },
		},
	],
	pricing: { priceRange: { start: { gross: { amount: 899, currency: "EUR" } }, stop: null } },
	...over,
});

const answer = (nodes: unknown[], pageInfo = { hasNextPage: false, endCursor: null as string | null }) => ({
	ok: true,
	data: { products: { edges: nodes.map((n) => ({ node: n })), pageInfo } },
});

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
	executePublicGraphQL.mockReset();
	isMarketIndexable.mockReset().mockReturnValue(true);
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("readFeedPage", () => {
	it("reads the market's channel in its language, past every cache", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node()], { hasNextPage: true, endCursor: "c1" }));
		const result = await readFeedPage("sk", null);

		const [, options] = executePublicGraphQL.mock.calls[0]!;
		expect(options.variables).toEqual({
			channel: "sk-eur",
			first: FEED_PAGE_DEFAULT,
			after: null,
			lang: "SK",
		});
		expect(options.cache).toBe("no-store");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.page.read).toBe(1);
		expect(result.page.items.map((item) => item.link)).toEqual(["https://maky.store/sk/stresny-box-1"]);
		expect(result.page.pageInfo).toEqual({ hasNextPage: true, endCursor: "c1" });
	});

	it("passes the cursor on and holds the step size inside the limit", async () => {
		executePublicGraphQL.mockResolvedValue(answer([]));
		await readFeedPage("sk", "abc", 5000);
		await readFeedPage("sk", "abc", Number.NaN);
		expect(executePublicGraphQL.mock.calls[0]![1].variables).toMatchObject({
			after: "abc",
			first: FEED_PAGE_MAX,
		});
		expect(executePublicGraphQL.mock.calls[1]![1].variables.first).toBe(FEED_PAGE_DEFAULT);
	});

	it("abroad a product without its translation is not in the feed, and is counted", async () => {
		const translated = node({
			id: "P2",
			translation: {
				name: "Dachbox",
				slug: "dachbox-1",
				description: "{}",
				seoTitle: "Dachbox",
				seoDescription: "Dachbox kaufen",
			},
			category: {
				id: "C1",
				name: "Strešné boxy",
				slug: "stresne-boxy",
				translation: { name: "Dachboxen", slug: "dachboxen" },
			},
			attributes: [
				{
					attribute: {
						name: "Výrobca",
						slug: "manufacturer",
						externalReference: MANUFACTURER,
						translation: { name: "Hersteller" },
					},
					values: [{ name: "Thule", slug: "thule", translation: { name: "Thule" } }],
				},
			],
		});
		executePublicGraphQL.mockResolvedValue(answer([node(), translated]));
		const result = await readFeedPage("de", null);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.page.read).toBe(2);
		expect(result.page.skipped).toEqual({ untranslated: 1 });
		expect(result.page.items).toHaveLength(1);
		expect(result.page.items[0]).toMatchObject({
			title: "Dachbox",
			link: "https://maky.store/de/dachbox-1",
			productType: "Dachboxen",
		});
	});

	it("counts what is left out by reason", async () => {
		executePublicGraphQL.mockResolvedValue(
			answer([node(), node({ id: "P3", attributes: [] }), node({ id: "P4", isAvailableForPurchase: false })]),
		);
		const result = await readFeedPage("sk", null);
		expect(result.ok && result.page.skipped).toEqual({ "no-brand": 1, "not-purchasable": 1 });
		expect(result.ok && result.page.items).toHaveLength(1);
	});

	it("has no feed for an unknown market or one closed to search engines, and asks nothing", async () => {
		expect(await readFeedPage("xx", null)).toMatchObject({ ok: false, status: 404 });
		isMarketIndexable.mockReturnValue(false);
		expect(await readFeedPage("de", null)).toMatchObject({ ok: false, status: 404 });
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("a failed read is an error, never an empty step", async () => {
		executePublicGraphQL.mockResolvedValue({ ok: false, error: { type: "network", message: "down" } });
		expect(await readFeedPage("sk", null)).toMatchObject({ ok: false, status: 502 });

		executePublicGraphQL.mockResolvedValue({ ok: true, data: { products: null } });
		expect(await readFeedPage("sk", null)).toMatchObject({ ok: false, status: 502 });
	});
});
