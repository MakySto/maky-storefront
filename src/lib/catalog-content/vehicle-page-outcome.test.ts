import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { type CatalogContentSnapshot } from "./contract";
import { buildCatalogTree } from "./tree";

/**
 * What the proxy is told about a vehicle address: the page's own resolution, as an answer.
 *
 * The tree here is built from the real builder over a small dataset, so "a model the fitment tree knows
 * and CFM has not written a page for" is the real shape, not a hand-made one.
 */

const { loadCatalogView, retiredVehiclePageHref } = vi.hoisted(() => ({
	loadCatalogView: vi.fn(),
	retiredVehiclePageHref: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./resolve", async (importOriginal) => ({
	...(await importOriginal<typeof import("./resolve")>()),
	loadCatalogView,
}));
vi.mock("./retired-page", () => ({ retiredVehiclePageHref }));

import { vehiclePageOutcome } from "./vehicle-page-outcome";

const dataset = {
	makes: [{ id: "mk", name: "VW", urlPath: "/stresne-nosice/volkswagen" }],
	models: [
		{ id: "md-t", makeId: "mk", name: "Transporter", urlPath: "/stresne-nosice/volkswagen/transporter" },
		{ id: "md-p", makeId: "mk", name: "Passat", urlPath: "/stresne-nosice/volkswagen/passat" },
	],
	generations: [
		{
			id: "g-t7",
			modelId: "md-t",
			name: "T7",
			productionYearFrom: 2024,
			productionYearTo: null,
			qualifiers: {},
			urlPath: "/stresne-nosice/volkswagen/transporter/t7",
		},
		{
			id: "g-b8",
			modelId: "md-p",
			name: "B8",
			productionYearFrom: 2014,
			productionYearTo: null,
			qualifiers: {},
			urlPath: "/stresne-nosice/volkswagen/passat/b8",
		},
	],
	applications: [],
} as unknown as FitmentDataset;

const page = (vehicleId: string, urlPath: string, kind: string, state = "published") => ({
	publicId: `pg:${vehicleId}`,
	vehicleId,
	kind,
	urlPath,
	state,
	indexable: true,
	hasEditorialText: true,
});

const snapshot = {
	artifact: "CATALOG_CONTENT_SNAPSHOT",
	schemaVersion: "1.0.0",
	generatedAt: "2026-11-01T00:00:00Z",
	language: "sk",
	// The brand and the Passat have pages; the Transporter model and its T7 generation have none.
	pages: [
		page("mk", "/stresne-nosice/volkswagen", "vehicle_make"),
		page("md-p", "/stresne-nosice/volkswagen/passat", "vehicle_model"),
		page("g-b8", "/stresne-nosice/volkswagen/passat/b8", "vehicle_generation"),
	],
} as unknown as CatalogContentSnapshot;

beforeEach(() => {
	vi.resetAllMocks();
	loadCatalogView.mockResolvedValue({ ready: true, tree: buildCatalogTree(snapshot, dataset), status: {} });
	retiredVehiclePageHref.mockResolvedValue(null);
});

describe("the page's own answer", () => {
	it("a published brand, model and generation are found", async () => {
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen"])).toEqual({ status: "found" });
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen", "passat"])).toEqual({
			status: "found",
		});
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen", "passat", "b8"])).toEqual({
			status: "found",
		});
	});

	it("a model the fitment tree has and CFM has not written a page for is absent — the Transporter", async () => {
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen", "transporter"])).toEqual({
			status: "absent",
			reason: "no-page",
		});
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen", "transporter", "t7"])).toEqual(
			{ status: "absent", reason: "no-page" },
		);
	});

	it("an address the tree does not know, one too deep and another category's are absent", async () => {
		for (const [category, path] of [
			["stresne-nosice", ["volkswagen", "nothing"]],
			["stresne-nosice", ["volkswagen", "passat", "b8", "extra"]],
			["stresne-boxy", ["volkswagen"]],
		] as const) {
			expect(await vehiclePageOutcome("sk-eur", category, path)).toMatchObject({ status: "absent" });
		}
	});

	it("a page held back (draft) is absent, not found", async () => {
		const held = {
			...snapshot,
			pages: [page("mk", "/stresne-nosice/volkswagen", "vehicle_make", "draft")],
		} as unknown as CatalogContentSnapshot;
		loadCatalogView.mockResolvedValue({ ready: true, tree: buildCatalogTree(held, dataset), status: {} });
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen"])).toEqual({
			status: "absent",
			reason: "withheld",
		});
	});

	it("a page CFM merged away is a redirect to the page that remained", async () => {
		retiredVehiclePageHref.mockResolvedValue("/sk/stresne-nosice/volkswagen/passat/b8");
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen", "passat", "b7"])).toEqual({
			status: "redirect",
			href: "/sk/stresne-nosice/volkswagen/passat/b8",
		});
	});
});

describe("what is not an absence", () => {
	it("a catalogue that could not be read is undetermined — an outage never becomes a 404", async () => {
		loadCatalogView.mockResolvedValue({ ready: false, reason: "no snapshot", status: {} });
		expect(await vehiclePageOutcome("sk-eur", "stresne-nosice", ["volkswagen"])).toEqual({
			status: "undetermined",
		});
	});

	it("a market with no catalogue language has no vehicle pages", async () => {
		expect(await vehiclePageOutcome("not-a-channel", "stresne-nosice", ["volkswagen"])).toEqual({
			status: "absent",
			reason: "no-language",
		});
		expect(loadCatalogView).not.toHaveBeenCalled();
	});
});
