import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset, type VehicleSelection } from "./contract";

/**
 * The listing filter, and the three ways it could lie.
 *
 * The failures this file exists to prevent were all measured against live Saleor
 * (api.maky.store, 2026-09-06), and none of them is visible in a green build:
 *
 *   1. `filter: { ids: [] }` returns the ENTIRE catalogue — all 9 606 products — not
 *      nothing. So "no verified products for this car" rendered as "here is the whole
 *      shop, filtered for your car".
 *   2. `first: 100` caps the PAGE, not the filter: 250 ids answer `totalCount: 250` and
 *      page correctly. Truncating candidates to 100 would silently hide sets from
 *      anyone whose car has many.
 *   3. Not knowing is not the same as nothing fitting. A dataset that cannot answer must
 *      leave the listing alone, because an empty listing is a claim.
 *
 * Every identity here is synthetic.
 */

const { loadFitmentDataset, readGarage } = vi.hoisted(() => ({
	loadFitmentDataset: vi.fn(),
	readGarage: vi.fn(),
}));

vi.mock("./provider", () => ({ loadFitmentDataset }));
vi.mock("@/lib/garage/state", () => ({ readGarage }));

import {
	isVehicleFilterRequested,
	NO_PRODUCTS_SENTINEL_ID,
	resolveVehicleListingFilter,
	vehicleFilterHref,
	vehicleFilterIds,
} from "./plp-vehicle-filter";
import { buildFilterVariables } from "@/ui/components/plp/filter-utils";

const SELECTION: VehicleSelection = {
	makeId: "make-1",
	modelId: "model-1",
	generationId: "gen-1",
	year: 2022,
};

function dataset(productIds: string[], overrides: Partial<FitmentDataset> = {}): FitmentDataset {
	return {
		schemaVersion: "2.0.0",
		datasetVersion: "test-1",
		datasetHash: "hash",
		generatedAt: new Date().toISOString(),
		source: { system: "test" },
		saleorInstance: "api.example.test",
		validity: { validUntil: null, staleAfterDays: 3650 },
		coverage: {
			scope: { programId: "test-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: [],
		},
		makes: [{ id: "make-1", name: "Make" }],
		models: [{ id: "model-1", makeId: "make-1", name: "Model" }],
		generations: [
			{
				id: "gen-1",
				modelId: "model-1",
				name: "Gen",
				productionYearFrom: 2018,
				productionYearTo: null,
				qualifiers: {},
			},
		],
		applications: productIds.map((id, index) => ({
			applicationId: `a${index}`,
			generationId: "gen-1",
			yearFrom: 2018,
			yearTo: null,
			qualifiers: {},
			conditions: [],
			verificationStatus: "verified" as const,
			products: [
				{
					externalReference: `test:product:${id}`,
					saleorProductId: id,
					saleorVariantId: `${id}-v`,
					productKind: "roof-rack-set" as const,
				},
			],
		})),
		...overrides,
	};
}

function garageWith(selection: VehicleSelection | null) {
	const vehicle = selection && {
		stored: { k: "make-1", m: "model-1", g: "gen-1", y: 2022 },
		selection,
		makeName: "Make",
		modelName: "Model",
		generationName: "Gen",
		unresolved: false,
	};
	return {
		status: vehicle ? "ok" : "absent",
		vehicles: vehicle ? [vehicle] : [],
		activeIndex: 0,
		active: vehicle ?? null,
		repaired: false,
		signed: true,
	};
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("what narrows the listing, and what must not", () => {
	it("never narrows when the filter was not requested", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(["P1"]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(false);
		expect(filter.state).toBe("offered");
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("offers the control without applying it, so it is reachable without editing a URL", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(["P1"]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(false);
		expect(filter).toMatchObject({ state: "offered", vehicleLabel: "Make Model Gen" });
	});

	it("narrows to every verified id when asked", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(["P1", "P2"]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "active", productIds: ["P1", "P2"] });
	});

	it("does not narrow when there is no usable saved car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(["P1"]) });
		readGarage.mockResolvedValue(garageWith(null));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "no-vehicle", requested: true });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("does not narrow when the dataset cannot answer — not knowing is not 'nothing fits'", async () => {
		// Stale: past `validUntil`. resolveVehicleOutcome reports this as unanswerable.
		const stale = dataset(["P1"], {
			validity: { validUntil: "2020-01-01T00:00:00.000Z", staleAfterDays: 30 },
		});
		loadFitmentDataset.mockResolvedValue({ dataset: stale });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "unanswerable", verdict: "STALE" });
		// The shopper sees the whole listing plus an explanation, never an empty one.
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("survives a provider that throws — a listing sells things", async () => {
		loadFitmentDataset.mockRejectedValue(new Error("provider exploded"));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(await resolveVehicleListingFilter(true)).toEqual({ state: "unavailable" });
		spy.mockRestore();
	});
});

describe("the empty result — the one that returned the whole catalogue", () => {
	it("reports empty rather than an id list", async () => {
		// A dataset with rows for a DIFFERENT generation: answerable, nothing verified.
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "empty" });
	});

	it("asks Saleor for an id that cannot exist, never for an empty list", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const ids = vehicleFilterIds(await resolveVehicleListingFilter(true));
		// Live: `ids: []` answers totalCount 9606. This id answers 0.
		expect(ids).toEqual([NO_PRODUCTS_SENTINEL_ID]);
		expect(buildFilterVariables({ vehicleProductIds: ids })).toEqual({ ids: [NO_PRODUCTS_SENTINEL_ID] });
	});

	it("refuses to turn an empty array into a filter, whoever passes it", () => {
		// Defence in depth: nothing produces `[]`, and if something ever does, the
		// listing must be unfiltered rather than filtered-by-nothing.
		expect(buildFilterVariables({ vehicleProductIds: [] })).toBeUndefined();
	});
});

describe("the candidate set is never truncated", () => {
	it("passes more than a Saleor page of ids straight through", async () => {
		const many = Array.from({ length: 250 }, (_, i) => `P${i}`);
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(many) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const ids = vehicleFilterIds(await resolveVehicleListingFilter(true));
		// `first: 100` caps the page; live, 250 ids answer totalCount 250.
		expect(ids).toHaveLength(250);
		expect(buildFilterVariables({ vehicleProductIds: ids })?.ids).toHaveLength(250);
	});

	it("de-duplicates a product verified through several application rows", async () => {
		const d = dataset(["P1"]);
		d.applications.push({ ...d.applications[0]!, applicationId: "a-dup" });
		loadFitmentDataset.mockResolvedValue({ dataset: d });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(vehicleFilterIds(await resolveVehicleListingFilter(true))).toEqual(["P1"]);
	});
});

describe("the URL contract", () => {
	it("only activates on the exact value", () => {
		expect(isVehicleFilterRequested("1")).toBe(true);
		expect(isVehicleFilterRequested(["1", "0"])).toBe(true);
		expect(isVehicleFilterRequested("true")).toBe(false);
		expect(isVehicleFilterRequested(undefined)).toBe(false);
	});

	it("drops the cursor when the filter changes, and keeps the shopper's own choices", () => {
		const params = { sort: "price_asc", price: "50-100", cursor: "abc", direction: "next" };
		expect(vehicleFilterHref("/products", params, true)).toBe(
			"/products?sort=price_asc&price=50-100&vehicle=1",
		);
		expect(vehicleFilterHref("/products", { ...params, vehicle: "1" }, false)).toBe(
			"/products?sort=price_asc&price=50-100",
		);
	});

	it("returns a bare path when nothing else is set", () => {
		expect(vehicleFilterHref("/categories/boxy", { vehicle: "1" }, false)).toBe("/categories/boxy");
	});
});
