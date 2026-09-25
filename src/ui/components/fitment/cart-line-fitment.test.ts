import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset, type VehicleSelection } from "@/lib/fitment/contract";

/**
 * What a cart line says about the saved car. The cart is the last place a wrong claim can be
 * made before the money moves, so the rules are the product page's, and silence wins every
 * doubt: no car, no dataset, no row for the product, a fault — nothing is said.
 *
 * Every identity here is synthetic.
 */

const { loadFitmentDataset, readGarage, cookieJar } = vi.hoisted(() => ({
	loadFitmentDataset: vi.fn(),
	readGarage: vi.fn(),
	cookieJar: { hasGarage: true },
}));

vi.mock("@/lib/fitment/provider", () => ({ loadFitmentDataset }));
vi.mock("@/lib/garage/state", () => ({ readGarage }));
vi.mock("next/headers", () => ({
	cookies: async () => ({ has: (name: string) => name === "maky-garage" && cookieJar.hasGarage }),
}));
vi.mock("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));

import { CART_FITMENT_WAIT_MS, cartLineFitments } from "./cart-line-fitment";

const gid = (pk: number) => Buffer.from(`Product:${pk}`, "utf8").toString("base64");
const FITS = gid(1);
const OTHER_CAR = gid(2);
const NOT_IN_DATASET = gid(3);

const SELECTION: VehicleSelection = {
	makeId: "make-1",
	modelId: "model-1",
	generationId: "gen-1",
	year: 2022,
};

function application(id: string, productId: string, generationId: string) {
	return {
		applicationId: id,
		generationId,
		window: {
			from: { year: 2018 },
			to: null,
			startPrecision: "year",
			endPrecision: "open",
			reconciledToGeneration: false,
		},
		qualifiers: {},
		conditions: [],
		products: [
			{
				externalReference: `test:product:${productId}`,
				saleorProductId: productId,
				saleorVariantId: `${productId}-v`,
				productKind: "roof-rack-set" as const,
				evidence: { kind: "manufacturer-application" as const, supplier: "test" },
				qaStatus: "accepted" as const,
				verification: "cfm-verified" as const,
				eligibility: { sellable: true, reasons: [] },
			},
		],
	};
}

function dataset(): FitmentDataset {
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
			{
				id: "gen-2",
				modelId: "model-1",
				name: "Gen2",
				productionYearFrom: 2010,
				productionYearTo: 2017,
				qualifiers: {},
			},
		],
		applications: [application("a1", FITS, "gen-1"), application("a2", OTHER_CAR, "gen-2")],
	} as FitmentDataset;
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
	vi.useRealTimers();
	cookieJar.hasGarage = true;
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cart line compatibility", () => {
	it("states a fit in the product page's words, with the car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [FITS]);
		expect(fitments[FITS]).toMatchObject({ tone: "fits", vehicle: "Make Model Gen · 2022" });
		expect(fitments[FITS]?.label).toMatch(/^verdict(Verified|Manufacturer)$/);
	});

	it("never calls a product made for another car a fit", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [OTHER_CAR]);
		expect(fitments[OTHER_CAR]).toBeDefined();
		expect(fitments[OTHER_CAR]?.tone).not.toBe("fits");
	});

	it("says nothing about a product the dataset has no row for", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(await cartLineFitments("sk-eur", [NOT_IN_DATASET])).toEqual({});
	});

	it("says nothing without a saved car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(null));

		expect(await cartLineFitments("sk-eur", [FITS, OTHER_CAR])).toEqual({});
	});

	it("says nothing without a dataset, and never asks for one for an empty cart", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: null });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(await cartLineFitments("sk-eur", [FITS])).toEqual({});
		loadFitmentDataset.mockClear();
		expect(await cartLineFitments("sk-eur", [])).toEqual({});
		expect(loadFitmentDataset).not.toHaveBeenCalled();
	});

	it("does not even load the dataset for a shopper with no garage cookie", async () => {
		cookieJar.hasGarage = false;
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });

		expect(await cartLineFitments("sk-eur", [FITS])).toEqual({});
		expect(loadFitmentDataset).not.toHaveBeenCalled();
	});

	it("never holds the cart past its deadline for a slow provider", async () => {
		vi.useFakeTimers();
		loadFitmentDataset.mockReturnValue(new Promise(() => {}));
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const result = cartLineFitments("sk-eur", [FITS]);
		await vi.advanceTimersByTimeAsync(CART_FITMENT_WAIT_MS);
		await expect(result).resolves.toEqual({});
	});

	it("turns a fault into silence, never into a broken cart", async () => {
		loadFitmentDataset.mockRejectedValue(new Error("provider down"));

		await expect(cartLineFitments("sk-eur", [FITS])).resolves.toEqual({});
	});
});
