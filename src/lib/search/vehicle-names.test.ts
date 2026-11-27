import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadCatalogView: vi.fn(),
	loadFitmentDataset: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/catalog-content/resolve", () => ({
	catalogLanguageForChannel: (channel: string) => (channel === "xx-xxx" ? null : channel.slice(0, 2)),
	loadCatalogView: mocks.loadCatalogView,
}));
vi.mock("@/lib/fitment/provider", () => ({ loadFitmentDataset: mocks.loadFitmentDataset }));
vi.mock("@/lib/catalog-content/vehicle-href", () => ({ vehiclePageHref: vi.fn() }));
vi.mock("@/lib/catalog-content/publication", () => ({ isPubliclyVisible: () => true }));

import { readVehicleCatalog } from "./vehicle-names";

const dataset = {
	makes: [{ id: "mk:skoda", name: "Skoda" }],
	models: [
		{ id: "md:octavia", makeId: "mk:skoda", name: "Octavia" },
		{ id: "md:kodiaq", makeId: "mk:skoda", name: "Kodiaq" },
	],
	generations: [],
};

/** A catalogue view whose tree holds the given cars, read from the file with that digest. */
function view(sha256: string | null, ids: readonly string[]) {
	const names: Record<string, string> = {
		"mk:skoda": "Škoda",
		"md:octavia": "Octavia",
		"md:kodiaq": "Kodiaq",
	};
	return {
		ready: true,
		tree: { byVehicleId: new Map(ids.map((id) => [id, { vehicleId: id, name: names[id] }])) },
		status: { sha256 },
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.loadFitmentDataset.mockResolvedValue({ dataset });
});

describe("the cars a search can name", () => {
	it("are the tree's cars, with the dataset's spelling beside the tree's", async () => {
		mocks.loadCatalogView.mockResolvedValue(view("a1", ["mk:skoda", "md:octavia"]));
		const catalog = await readVehicleCatalog("sk-eur");

		expect(catalog!.names.makes).toEqual([{ id: "mk:skoda", name: "Škoda", altNames: ["Skoda"] }]);
		// Kodiaq has no page in this tree: a search must not recognise a car it cannot link to.
		expect(catalog!.names.models.map((model) => model.id)).toEqual(["md:octavia"]);
	});

	it("are cut into words once per catalogue file, not per search", async () => {
		mocks.loadCatalogView.mockResolvedValue(view("b1", ["mk:skoda", "md:octavia"]));
		const first = await readVehicleCatalog("sk-eur");
		// A new request builds a new tree from the same file.
		mocks.loadCatalogView.mockResolvedValue(view("b1", ["mk:skoda", "md:octavia"]));
		const second = await readVehicleCatalog("sk-eur");

		expect(second!.names).toBe(first!.names);
	});

	it("follow the file, not the language: two markets of one language can hold different cars", async () => {
		// Germany and Austria both read German; published apart, each is served its own file.
		mocks.loadCatalogView.mockResolvedValue(view("c-de", ["mk:skoda", "md:octavia"]));
		const germany = await readVehicleCatalog("de-eur");
		mocks.loadCatalogView.mockResolvedValue(view("c-at", ["mk:skoda", "md:octavia", "md:kodiaq"]));
		const austria = await readVehicleCatalog("de-at");

		expect(germany!.names.models.map((model) => model.id)).toEqual(["md:octavia"]);
		expect(austria!.names.models.map((model) => model.id)).toEqual(["md:octavia", "md:kodiaq"]);
	});

	it("follow a catalogue release while the fitment dataset stays", async () => {
		mocks.loadCatalogView.mockResolvedValue(view("d1", ["mk:skoda", "md:octavia"]));
		await readVehicleCatalog("sk-eur");
		mocks.loadCatalogView.mockResolvedValue(view("d2", ["mk:skoda", "md:octavia", "md:kodiaq"]));
		const after = await readVehicleCatalog("sk-eur");

		expect(after!.names.models.map((model) => model.id)).toEqual(["md:octavia", "md:kodiaq"]);
	});

	it("are built for the search alone when the source reports no digest", async () => {
		mocks.loadCatalogView.mockResolvedValue(view(null, ["mk:skoda", "md:octavia"]));
		const first = await readVehicleCatalog("sk-eur");
		mocks.loadCatalogView.mockResolvedValue(view(null, ["mk:skoda", "md:octavia", "md:kodiaq"]));
		const second = await readVehicleCatalog("sk-eur");

		expect(first!.names.models).toHaveLength(1);
		expect(second!.names.models).toHaveLength(2);
	});

	it("is nothing for a market without a catalogue language or without a tree", async () => {
		expect(await readVehicleCatalog("xx-xxx")).toBeNull();
		mocks.loadCatalogView.mockResolvedValue({ ready: false, reason: "no content snapshot", status: {} });
		expect(await readVehicleCatalog("sk-eur")).toBeNull();
	});
});
