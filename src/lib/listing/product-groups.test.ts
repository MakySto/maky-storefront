import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn() }));

const { splitProductTypes } = await import("./product-groups");

/** The product types of api.maky.store on 2026-09-24, as `ListingProductTypes` answers them. */
const LIVE = [
	{ id: "UHJvZHVjdFR5cGU6NA==", slug: "automotive-accessory-spare-part" },
	{ id: "UHJvZHVjdFR5cGU6NQ==", slug: "bike-carrier" },
	{ id: "UHJvZHVjdFR5cGU6MTA=", slug: "car-fridge" },
	{ id: "UHJvZHVjdFR5cGU6MQ==", slug: "default-type" },
	{ id: "UHJvZHVjdFR5cGU6Ng==", slug: "roof-box" },
	{ id: "UHJvZHVjdFR5cGU6Mw==", slug: "roof-rack-bundle" },
];
const connection = (nodes: typeof LIVE, hasNextPage = false) => ({
	pageInfo: { hasNextPage },
	edges: nodes.map((node) => ({ node })),
});

describe("product type groups", () => {
	it("puts the accessory type on its own and every other type in the main group", () => {
		expect(splitProductTypes(connection(LIVE))).toEqual({
			main: [
				"UHJvZHVjdFR5cGU6NQ==",
				"UHJvZHVjdFR5cGU6MTA=",
				"UHJvZHVjdFR5cGU6MQ==",
				"UHJvZHVjdFR5cGU6Ng==",
				"UHJvZHVjdFR5cGU6Mw==",
			],
			accessories: ["UHJvZHVjdFR5cGU6NA=="],
		});
	});

	it("offers no groups when the accessory type is gone — the listing keeps Saleor's order", () => {
		expect(
			splitProductTypes(connection(LIVE.filter((type) => type.slug !== "automotive-accessory-spare-part"))),
		).toBeNull();
	});

	it("offers no groups from a partial list, which would leave products out of both", () => {
		expect(splitProductTypes(connection(LIVE, true))).toBeNull();
		expect(splitProductTypes(null)).toBeNull();
	});
});
