import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { type CatalogContentSnapshot } from "./contract";
import { buildCatalogTree } from "./tree";

/**
 * A link to the page of a generation CFM merged away.
 *
 * CFM keeps a retired page in the content export with the vehicle id it had, and the fitment tree
 * drops the node. The page used to answer not-found; now it follows the id to the generation that
 * remained. Nothing here is joined on a name or a rebuilt address.
 */

const dataset = {
	makes: [{ id: "mk", name: "SKODA" }],
	models: [{ id: "md", makeId: "mk", name: "Octavia", urlPath: "/stresne-nosice/skoda/octavia" }],
	generations: [
		{
			id: "g-new",
			modelId: "md",
			name: "5E",
			productionYearFrom: 2013,
			productionYearTo: null,
			qualifiers: {},
			urlPath: "/stresne-nosice/skoda/octavia/5e",
		},
		{
			id: "g-a",
			modelId: "md",
			name: "1Z",
			productionYearFrom: 2004,
			productionYearTo: 2013,
			qualifiers: {},
			urlPath: "/stresne-nosice/skoda/octavia/1z",
		},
	],
	applications: [],
	retiredVehicleIds: {
		generations: { "g-old": "g-new" },
		generations_split: { "g-label": ["g-a", "g-new"] },
	},
} as unknown as FitmentDataset;

const page = (vehicleId: string, urlPath: string, kind = "vehicle_generation") => ({
	publicId: `pg:${vehicleId}`,
	vehicleId,
	kind,
	urlPath,
	state: "published",
	indexable: true,
	hasEditorialText: true,
});

const snapshot = {
	artifact: "CATALOG_CONTENT_SNAPSHOT",
	schemaVersion: "1.0.0",
	generatedAt: "2026-10-14T00:00:00Z",
	language: "sk",
	pages: [
		page("mk", "/stresne-nosice/skoda", "vehicle_make"),
		page("md", "/stresne-nosice/skoda/octavia", "vehicle_model"),
		page("g-new", "/stresne-nosice/skoda/octavia/5e"),
		page("g-a", "/stresne-nosice/skoda/octavia/1z"),
		{ ...page("g-old", "/stresne-nosice/skoda/octavia/5e-facelift"), state: "retired" },
		{ ...page("g-label", "/stresne-nosice/skoda/octavia/2004-2020"), state: "retired" },
		{ ...page("g-gone", "/stresne-nosice/skoda/octavia/never") },
	],
} as unknown as CatalogContentSnapshot;

describe("the tree's pages without a vehicle", () => {
	it("are listed by address, with the id they describe, and never rendered", () => {
		const tree = buildCatalogTree(snapshot, dataset);
		expect(tree.orphanPages.get("/stresne-nosice/skoda/octavia/5e-facelift")).toBe("g-old");
		expect(tree.orphanPages.get("/stresne-nosice/skoda/octavia/2004-2020")).toBe("g-label");
		expect(tree.byUrlPath.has("/stresne-nosice/skoda/octavia/5e-facelift")).toBe(false);
		// A page whose vehicle is in the tree is not an orphan.
		expect(tree.orphanPages.has("/stresne-nosice/skoda/octavia/5e")).toBe(false);
		expect(tree.stats.pagesWithoutNode).toBe(3);
	});
});

const hrefOf = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ tree: undefined as unknown, dataset: undefined as unknown }));

vi.mock("./resolve", async () => {
	const actual = await vi.importActual<typeof import("./resolve")>("./resolve");
	return {
		...actual,
		loadCatalogView: async () => ({ ready: true, tree: state.tree, status: {} }),
		catalogLanguageForChannel: () => "sk",
	};
});
vi.mock("@/lib/fitment/provider", () => ({
	loadFitmentDataset: async () => ({ dataset: state.dataset, status: {} }),
}));
vi.mock("./vehicle-href", () => ({ vehiclePageHref: hrefOf }));

import { retiredVehiclePageHref } from "./retired-page";

beforeEach(() => {
	state.tree = buildCatalogTree(snapshot, dataset);
	state.dataset = dataset;
	hrefOf.mockReset();
	hrefOf.mockImplementation(async (_channel: string, id: string) => `/sk/page-of/${id}`);
});

describe("a link to a merged generation's page", () => {
	it("lands on the page of the generation that remained", async () => {
		expect(
			await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "5e-facelift"]),
		).toBe("/sk/page-of/g-new");
	});

	it("from a dissolved summary label lands on the model, whose page lists the generations", async () => {
		expect(await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "2004-2020"])).toBe(
			"/sk/page-of/md",
		);
	});

	it("is nothing for an address that is not a retired page", async () => {
		expect(
			await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "nowhere"]),
		).toBeNull();
		expect(
			await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "never"]),
		).toBeNull();
		expect(hrefOf).not.toHaveBeenCalled();
	});

	it("is nothing when the market would not serve the page that remained", async () => {
		hrefOf.mockResolvedValue(null);
		expect(
			await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "5e-facelift"]),
		).toBeNull();
	});

	it("is nothing without a dataset to explain the id", async () => {
		state.dataset = null;
		expect(
			await retiredVehiclePageHref("sk-eur", "stresne-nosice", ["skoda", "octavia", "5e-facelift"]),
		).toBeNull();
	});
});
