import { beforeEach, describe, expect, it, vi } from "vitest";

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));

import { searchProducts } from "./saleor-provider";

/** One search hit as the `ProductListItem` fragment returns it, complete in `language`. */
function hit(id: string, language: string, isAvailableForPurchase: boolean | null) {
	return {
		node: {
			id,
			isAvailableForPurchase,
			name: "Strešný nosič (SK base row)",
			slug: `stresny-nosic-${id}`,
			translation: {
				name: `Roof rack ${id} ${language}`,
				slug: `roof-rack-${id}-${language.toLowerCase().replace("_", "-")}`,
				description: '{"blocks":[]}',
				seoTitle: `Roof rack ${id}`,
				seoDescription: "Roof rack",
			},
			attributes: [],
			pricing: { priceRange: { start: { gross: { amount: 369.99, currency: "CAD" } } } },
			category: {
				id: "c",
				name: "Nordrive",
				slug: "nordrive-stresne-nosice",
				translation: { name: "Nordrive roof racks", slug: null },
			},
			thumbnail: null,
			variants: [],
		},
		cursor: id,
	};
}

beforeEach(() => executePublicGraphQL.mockReset());

describe("Saleor search, abroad", () => {
	it("asks in the market's own code and carries the channel's purchase switch to every hit", async () => {
		executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: {
				products: {
					totalCount: 2,
					edges: [hit("a", "EN_CA", true), hit("b", "EN_CA", false)],
					pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null, startCursor: null },
				},
			},
		});

		const result = await searchProducts({ query: "roof", channel: "ca-cad" });

		expect(executePublicGraphQL.mock.calls[0]![1].variables).toMatchObject({
			channel: "ca-cad",
			lang: "EN_CA",
		});
		expect(result.products.map((p) => [p.slug, p.isPurchasable, p.currency])).toEqual([
			["roof-rack-a-en-ca", true, "CAD"],
			["roof-rack-b-en-ca", false, "CAD"],
		]);
	});

	it("treats a missing purchase switch as not purchasable, never as yes", async () => {
		executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: {
				products: {
					totalCount: 1,
					edges: [hit("c", "EN", null)],
					pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null, startCursor: null },
				},
			},
		});

		const result = await searchProducts({ query: "roof", channel: "us-usd" });

		expect(executePublicGraphQL.mock.calls[0]![1].variables).toMatchObject({ lang: "EN" });
		expect(result.products[0]!.isPurchasable).toBe(false);
	});
});
