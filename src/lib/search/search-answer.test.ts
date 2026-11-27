import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleShelf } from "./__fixtures__/shelf-sample";
import { buildShelfIndex, type ShelfIndex } from "./shelf-index";
import type { SearchResult } from "./types";
import type { VehicleNames } from "./vehicle-intent";

const mocks = vi.hoisted(() => ({
	readShelfIndex: vi.fn(),
	readVehicleCatalog: vi.fn(),
	vehicleShortcuts: vi.fn(),
	searchProducts: vi.fn(),
	executePublicGraphQL: vi.fn(),
	resolveTyreText: vi.fn(),
	tyreSizePagePath: vi.fn(),
}));

vi.mock("./shelf-source", () => ({ readShelfIndex: mocks.readShelfIndex }));
vi.mock("./vehicle-names", () => ({
	readVehicleCatalog: mocks.readVehicleCatalog,
	vehicleShortcuts: mocks.vehicleShortcuts,
}));
vi.mock("./saleor-provider", () => ({
	searchProducts: mocks.searchProducts,
	// The cards of a page, reduced to what these tests look at.
	toSearchProducts: (nodes: readonly { id: string; name: string }[]) => ({
		products: nodes.map((node) => ({ id: node.id, name: node.name })),
		dropped: 0,
	}),
}));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: mocks.executePublicGraphQL }));
vi.mock("@/lib/tyre-size/size-lookup", () => ({ resolveTyreText: mocks.resolveTyreText }));
vi.mock("@/lib/tyre-size/size-page-route", () => ({ tyreSizePagePath: mocks.tyreSizePagePath }));

import { answerSearch } from "./search-answer";

const names: VehicleNames = {
	makes: [
		{ id: "mk:skoda", name: "Škoda" },
		{ id: "mk:ford", name: "Ford" },
		{ id: "mk:vw", name: "Volkswagen" },
	],
	models: [
		{ id: "md:octavia", makeId: "mk:skoda", name: "Octavia" },
		{ id: "md:kuga", makeId: "mk:ford", name: "Kuga" },
		{ id: "md:golf", makeId: "mk:vw", name: "Golf" },
	],
	generations: [],
};

const NOTHING: SearchResult = { products: [], pagination: { totalCount: 0 } };
const saleorFinds = (count: number, cursors: { next?: string } = {}): SearchResult => ({
	products: Array.from({ length: Math.min(count, 20) }, (_, i) => ({
		id: `set-${i}`,
		name: `Zostava ${i}`,
		slug: `zostava-${i}`,
		price: 100,
		currency: "EUR",
		isPurchasable: true,
	})),
	pagination: { totalCount: count, hasNextPage: Boolean(cursors.next), nextCursor: cursors.next },
});

let index: ShelfIndex;

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	index = buildShelfIndex(sampleShelf("sk"), "sk");
	mocks.readShelfIndex.mockResolvedValue(index);
	mocks.readVehicleCatalog.mockResolvedValue({ names, tree: {} });
	mocks.vehicleShortcuts.mockImplementation(async (_channel, intent) =>
		[...intent.models.map((m: { modelId: string }) => m.modelId), ...intent.makeIds].map((id: string) => ({
			id,
			kind: "model",
			title: id,
			href: `/sk/stresne-nosice/${id}`,
			generations: [],
			related: [],
		})),
	);
	mocks.searchProducts.mockResolvedValue(NOTHING);
	mocks.resolveTyreText.mockReturnValue(null);
	mocks.tyreSizePagePath.mockReturnValue(null);
	// The cards of a page: whatever ids were asked for, in REVERSE, as Saleor answers in its own order.
	mocks.executePublicGraphQL.mockImplementation(
		async (_document, options: { variables: { ids: string[] } }) => ({
			ok: true,
			data: {
				products: {
					edges: [...options.variables.ids].reverse().map((id) => ({
						node: { id, name: index.docs.find((doc) => doc.id === id)?.name ?? id },
					})),
				},
			},
		}),
	);
});

const saleorQueries = () => mocks.searchProducts.mock.calls.map(([options]) => options.query);

describe("a search answered from the shop's own index", () => {
	it("lists the shelf's products in the index's order and does not ask Saleor's search", async () => {
		const answer = await answerSearch({
			query: "strešný box",
			channel: "sk-eur",
			namedShelves: ["stresne-boxy"],
		});

		expect(mocks.searchProducts).not.toHaveBeenCalled();
		expect(answer.note).toBeNull();
		expect(answer.result.pagination.totalCount).toBe(9);
		// Put back in the index's order, whatever order Saleor returned the cards in.
		expect(
			answer.result.products.slice(0, 6).every((product) => product.name.startsWith("Strešný box")),
		).toBe(true);
		expect(answer.result.products[8]!.name).not.toMatch(/^Strešný box/);
	});

	it("pages by position, and a later page continues the same answer", async () => {
		const first = await answerSearch({ query: "nosič", channel: "sk-eur" });
		expect(first.result.products).toHaveLength(20);
		expect(first.result.pagination).toMatchObject({
			totalCount: 24,
			hasNextPage: true,
			hasPreviousPage: false,
			nextCursor: "shelf.20",
		});

		const second = await answerSearch({ query: "nosič", channel: "sk-eur", cursor: "shelf.20" });
		expect(second.result.products).toHaveLength(4);
		expect(second.result.pagination).toMatchObject({
			hasNextPage: false,
			hasPreviousPage: true,
			prevCursor: "shelf.0",
		});
		const seen = new Set([...first.result.products, ...second.result.products].map((product) => product.id));
		expect(seen.size).toBe(24);

		// Past the end is the last page there is, never an empty one.
		const beyond = await answerSearch({ query: "nosič", channel: "sk-eur", cursor: "shelf.4000" });
		expect(beyond.result.products.map((product) => product.id)).toEqual(
			second.result.products.map((product) => product.id),
		);
		expect(mocks.searchProducts).not.toHaveBeenCalled();
	});

	it("reports a failed read of the cards as unavailable, not as nothing found", async () => {
		mocks.executePublicGraphQL.mockResolvedValue({ ok: false, error: { type: "network", message: "down" } });
		const answer = await answerSearch({ query: "strešný box", channel: "sk-eur" });
		expect(answer.result.unavailable).toBe(true);
	});
});

describe("a search the index does not hold", () => {
	it("asks Saleor with the words as typed before it guesses", async () => {
		// Thule's bars exist only inside the sets, which the index leaves to Saleor.
		mocks.searchProducts.mockResolvedValueOnce(saleorFinds(6601, { next: "WyJhIl0=" }));
		const answer = await answerSearch({ query: "thule wingbar", channel: "sk-eur" });

		expect(saleorQueries()).toEqual(["thule wingbar"]);
		expect(answer.note).toBeNull();
		expect(answer.result.pagination.totalCount).toBe(6601);
		// The next page continues THIS search.
		expect(answer.result.pagination.nextCursor).toBe("f.WyJhIl0=");
	});

	it("corrects a misspelt maker and answers as for the maker spelt right, and says so", async () => {
		const spelt = await answerSearch({ query: "thule", channel: "sk-eur" });
		mocks.searchProducts.mockClear();
		const answer = await answerSearch({ query: "tule", channel: "sk-eur" });

		// Saleor is asked for the words as typed first; the maker's own products are on the shelf.
		expect(saleorQueries()).toEqual(["tule"]);
		expect(answer.note).toBe("brand");
		expect(answer.shownQuery).toBe("thule");
		expect(answer.result.products.length).toBeGreaterThan(0);
		expect(answer.result.products.map((product) => product.id)).toEqual(
			spelt.result.products.map((product) => product.id),
		);
	});

	it("corrects a misspelt maker through Saleor when the shelf has nothing of it", async () => {
		mocks.searchProducts.mockResolvedValueOnce(NOTHING).mockResolvedValueOnce(saleorFinds(6601));
		const answer = await answerSearch({ query: "tule wingbar", channel: "sk-eur" });

		expect(saleorQueries()).toEqual(["tule wingbar", "thule wingbar"]);
		expect(answer.note).toBe("brand");
		expect(answer.shownQuery).toBe("thule wingbar");
	});

	it("offers nothing from another shelf when the shelf the words name is empty in the market", async () => {
		// The German shelf of the sample holds no roof box.
		mocks.readShelfIndex.mockResolvedValue(buildShelfIndex(sampleShelf("de"), "de"));
		const answer = await answerSearch({
			query: "Dachbox Nordrive",
			channel: "de-eur",
			namedShelves: ["stresne-boxy"],
		});

		expect(answer.result.products).toEqual([]);
		expect(answer.note).toBeNull();
	});

	it("offers the closest products of the shelf only when nothing else answered", async () => {
		const answer = await answerSearch({ query: "autochladnicka 30l", channel: "sk-eur" });

		expect(saleorQueries()).toEqual(["autochladnicka 30l"]);
		expect(answer.note).toBe("closest");
		expect(answer.result.products[0]!.name).toMatch(/autochladnička/);
	});

	it("says a Saleor outage is an outage", async () => {
		mocks.searchProducts.mockResolvedValueOnce({ ...NOTHING, unavailable: true });
		const answer = await answerSearch({ query: "thule wingbar", channel: "sk-eur" });
		expect(answer.result.unavailable).toBe(true);
	});

	it("is answered by Saleor alone while the index is not built yet", async () => {
		mocks.readShelfIndex.mockResolvedValue(null);
		mocks.searchProducts.mockResolvedValueOnce(saleorFinds(22642));
		const answer = await answerSearch({ query: "strešný box", channel: "sk-eur", cursor: "shelf.20" });

		// The position belonged to an index this process no longer has: the search starts again.
		expect(mocks.searchProducts.mock.calls[0]![0]).toMatchObject({ query: "strešný box", cursor: undefined });
		expect(answer.result.pagination.totalCount).toBe(22642);
	});
});

describe("a search that names a car", () => {
	it("is answered with the car's page, and Saleor's sets for the same words below it", async () => {
		mocks.searchProducts.mockResolvedValueOnce(saleorFinds(126));
		const answer = await answerSearch({ query: "nosič Kuga", channel: "sk-eur" });

		expect(answer.vehicles.map((vehicle) => vehicle.id)).toEqual(["md:kuga"]);
		expect(saleorQueries()).toEqual(["nosič Kuga"]);
		expect(answer.note).toBeNull();
	});

	it("lists the kits of the shelf that name the car", async () => {
		const answer = await answerSearch({ query: "kit octavia", channel: "sk-eur" });

		expect(answer.vehicles.map((vehicle) => vehicle.id)).toEqual(["md:octavia"]);
		expect(answer.result.products.map((product) => product.name)).toEqual([
			"Montážny kit Nordrive C041 pre Škoda Octavia 1Z - (N21041)",
			"Montážny kit Nordrive C238 pre Škoda Octavia NX - (N21238)",
		]);
		expect(mocks.searchProducts).not.toHaveBeenCalled();
	});

	it("asks Saleor for the car alone when the other words are in a language it cannot read", async () => {
		mocks.readShelfIndex.mockResolvedValue(buildShelfIndex(sampleShelf("de"), "de"));
		mocks.searchProducts
			.mockResolvedValueOnce(NOTHING)
			.mockResolvedValueOnce(saleorFinds(260, { next: "abc" }));
		const answer = await answerSearch({
			query: "Dachträger Golf",
			channel: "de-eur",
			namedShelves: ["stresne-nosice"],
		});

		expect(answer.vehicles.map((vehicle) => vehicle.id)).toEqual(["md:golf"]);
		expect(saleorQueries()).toEqual(["Dachträger Golf", "Golf"]);
		expect(answer.shownQuery).toBe("Golf");
		expect(answer.note).toBe("closest");
		expect(answer.result.pagination.nextCursor).toBe("v.abc");

		// And its second page asks for the car alone again, with Saleor's own cursor.
		mocks.searchProducts.mockResolvedValueOnce(saleorFinds(260));
		await answerSearch({
			query: "Dachträger Golf",
			channel: "de-eur",
			namedShelves: ["stresne-nosice"],
			cursor: "v.abc",
			direction: "forward",
		});
		expect(mocks.searchProducts.mock.calls.at(-1)![0]).toMatchObject({ query: "Golf", cursor: "abc" });
	});

	it("leaves the car out when the words name another shelf", async () => {
		const answer = await answerSearch({
			query: "nosič bicyklov octavia",
			channel: "sk-eur",
			namedShelves: ["nosice-bicyklov"],
		});

		// A bike carrier for an Octavia is a bike carrier: no roof-rack page, and the carriers listed.
		expect(answer.vehicles).toEqual([]);
		expect(answer.result.products[0]!.name).toMatch(/^Nosič bicyk/);
		expect(mocks.searchProducts).not.toHaveBeenCalled();
	});

	it("offers to choose a car when the roof racks are named without one", async () => {
		const answer = await answerSearch({
			query: "strešný nosič",
			channel: "sk-eur",
			namedShelves: ["stresne-nosice"],
		});
		expect(answer.askForVehicle).toBe(true);
		expect(answer.vehicles).toEqual([]);
	});

	it("still answers when the car names cannot be read", async () => {
		mocks.readVehicleCatalog.mockRejectedValue(new Error("no dataset"));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const answer = await answerSearch({ query: "strešný box", channel: "sk-eur" });
		expect(answer.result.pagination.totalCount).toBe(9);
		warn.mockRestore();
	});
});

describe("a search that holds a tyre size", () => {
	it("offers the size's page and searches for the rest of the words", async () => {
		mocks.resolveTyreText.mockReturnValue("205/55 R16");
		mocks.tyreSizePagePath.mockReturnValue("/snehove-retaze/205-55-r16");
		const answer = await answerSearch({
			query: "reťaze 205/55 R16",
			channel: "sk-eur",
			namedShelves: ["snehove-retaze"],
		});

		expect(mocks.resolveTyreText).toHaveBeenCalledWith("205/55 R16");
		expect(answer.tyre).toEqual({ label: "205/55 R16", href: "/sk/snehove-retaze/205-55-r16" });
		expect(answer.result.products).toHaveLength(4);
		expect(answer.result.products.every((product) => /reťaze/i.test(product.name))).toBe(true);
	});

	it("searches for the words as typed when the size is one the shop has no page for", async () => {
		mocks.resolveTyreText.mockReturnValue(null);
		mocks.searchProducts.mockResolvedValueOnce(saleorFinds(3));
		const answer = await answerSearch({ query: "reťaze 205/55 R61", channel: "sk-eur" });
		expect(answer.tyre).toBeNull();
		expect(saleorQueries()).toEqual(["reťaze 205/55 R61"]);
	});
});
