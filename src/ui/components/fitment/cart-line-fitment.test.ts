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
	// The key, and the values it was given — so a test can see WHICH car a sentence names.
	getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
		values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { marketHref } from "@/lib/channel-map";
import { CART_FITMENT_WAIT_MS, cartLineFitments } from "./cart-line-fitment";
import { __forgetProgramme } from "./programme-memory";

const gid = (pk: number) => Buffer.from(`Product:${pk}`, "utf8").toString("base64");
const FITS = gid(1);
const OTHER_CAR = gid(2);
const NOT_IN_DATASET = gid(3);
const HELD = gid(6);

/** A cart line of the product's one documented variant — the fixture's `${productId}-v`. */
const line = (productId: string, variantId = `${productId}-v`) => ({ productId, variantId });
const v = (productId: string) => `${productId}-v`;

const SELECTION: VehicleSelection = {
	makeId: "make-1",
	modelId: "model-1",
	generationId: "gen-1",
	year: 2022,
};

function application(
	id: string,
	productId: string,
	generationId: string,
	qaStatus: "accepted" | "hold" = "accepted",
) {
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
				qaStatus,
				verification: "cfm-verified" as const,
				eligibility: { sellable: qaStatus === "accepted", reasons: [] },
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
		applications: [
			application("a1", FITS, "gen-1"),
			application("a2", OTHER_CAR, "gen-2"),
			application("a3", HELD, "gen-2", "hold"),
		],
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
	__forgetProgramme();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cart line compatibility", () => {
	it("states a fit in the product page's words, with the car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [line(FITS)]);
		expect(fitments[v(FITS)]).toMatchObject({ tone: "fits", vehicle: "Make Model Gen · 2022" });
		expect(fitments[v(FITS)]?.label).toMatch(/^verdict(Verified|Manufacturer)$/);
	});

	it("never calls a product made for another car a fit", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [line(OTHER_CAR)]);
		expect(fitments[v(OTHER_CAR)]).toBeDefined();
		expect(fitments[v(OTHER_CAR)]?.tone).not.toBe("fits");
	});

	it("says nothing about a product the dataset has no row for", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(await cartLineFitments("sk-eur", [line(NOT_IN_DATASET)])).toEqual({});
	});

	it("says nothing without a saved car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(null));

		expect(await cartLineFitments("sk-eur", [line(FITS), line(OTHER_CAR)])).toEqual({});
	});

	it("says nothing without a dataset, and never asks for one for an empty cart", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: null });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(await cartLineFitments("sk-eur", [line(FITS)])).toEqual({});
		loadFitmentDataset.mockClear();
		expect(await cartLineFitments("sk-eur", [])).toEqual({});
		expect(loadFitmentDataset).not.toHaveBeenCalled();
	});

	it("does not even load the dataset for a shopper with no garage cookie", async () => {
		cookieJar.hasGarage = false;
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });

		expect(await cartLineFitments("sk-eur", [line(FITS)])).toEqual({});
		expect(loadFitmentDataset).not.toHaveBeenCalled();
	});

	it("never holds the cart past its deadline for a slow provider", async () => {
		vi.useFakeTimers();
		loadFitmentDataset.mockReturnValue(new Promise(() => {}));
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const result = cartLineFitments("sk-eur", [line(FITS)]);
		await vi.advanceTimersByTimeAsync(CART_FITMENT_WAIT_MS);
		await expect(result).resolves.toEqual({});
	});

	it("one deadline for the whole cart, not one per line", async () => {
		vi.useFakeTimers();
		loadFitmentDataset.mockReturnValue(new Promise(() => {}));
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const result = cartLineFitments("sk-eur", [
			line(FITS),
			line(OTHER_CAR),
			line(NOT_IN_DATASET),
			line(gid(4)),
			line(gid(5)),
		]);
		let settled = false;
		void result.then(() => (settled = true));
		await vi.advanceTimersByTimeAsync(CART_FITMENT_WAIT_MS);
		expect(settled).toBe(true);
		expect(loadFitmentDataset).toHaveBeenCalledTimes(1);
	});

	it("says it cannot check now — neutral, no car — for covered lines when the data does not come", async () => {
		// A first cart loads the dataset: the process now knows which products the programme covers.
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));
		await cartLineFitments("sk-eur", [line(FITS)]);

		vi.useFakeTimers();
		loadFitmentDataset.mockReturnValue(new Promise(() => {}));
		const result = cartLineFitments("sk-eur", [line(FITS), line(OTHER_CAR), line(NOT_IN_DATASET)]);
		await vi.advanceTimersByTimeAsync(CART_FITMENT_WAIT_MS);
		const fitments = await result;

		for (const id of [FITS, OTHER_CAR]) {
			expect(fitments[v(id)]).toEqual({ tone: "unconfirmed", label: "verdictUnavailable", vehicle: null });
		}
		expect(fitments[v(NOT_IN_DATASET)]).toBeUndefined();
	});

	it("says the same when the provider answers with no dataset after a good load", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));
		await cartLineFitments("sk-eur", [line(FITS)]);

		loadFitmentDataset.mockResolvedValue({ dataset: null });
		const fitments = await cartLineFitments("sk-eur", [line(FITS)]);
		expect(fitments[v(FITS)]?.tone).toBe("unconfirmed");
		expect(fitments[v(FITS)]?.tone).not.toBe("fits");
	});

	it("names the car a line was made for, and the way to the saved car's offers — never 'nepasuje'", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [line(FITS), line(OTHER_CAR)]);
		// The line that fits keeps its green answer, with the saved car.
		expect(fitments[v(FITS)]).toMatchObject({ tone: "fits", vehicle: "Make Model Gen · 2022" });
		// The other says what it is for, neutral, and does not repeat the whole saved car.
		expect(fitments[v(OTHER_CAR)]).toEqual({
			tone: "offer",
			label: `cartOfferFor ${JSON.stringify({ vehicle: "Make Model Gen2" })}`,
			vehicle: null,
			alternative: {
				label: `cartAlternative ${JSON.stringify({ vehicle: "Model Gen" })}`,
				href: marketHref("sk-eur", "/konfigurator"),
			},
		});
		expect(fitments[v(OTHER_CAR)]?.label).not.toMatch(/NoFit|verdictUnknown/);
	});

	it("never carries a variant's answer over to a sibling variant of the same product", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const sibling = `${FITS}-other`;
		const fitments = await cartLineFitments("sk-eur", [line(FITS, sibling)]);
		expect(fitments[sibling]).toBeDefined();
		expect(fitments[sibling]?.tone).not.toBe("fits");
		// Nor is the sibling described as made for anything: the source said nothing about it.
		expect(fitments[sibling]?.tone).not.toBe("offer");
	});

	it("keeps 'we cannot confirm' for a held row — a hold is not a description of the offer", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [line(HELD)]);
		expect(fitments[v(HELD)]).toMatchObject({ tone: "unconfirmed", label: "verdictUnknown" });
	});

	it("answers each variant once, however many lines carry it", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset() });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const fitments = await cartLineFitments("sk-eur", [line(FITS), line(FITS)]);
		expect(Object.keys(fitments)).toEqual([v(FITS)]);
	});

	it("turns a fault into silence, never into a broken cart", async () => {
		loadFitmentDataset.mockRejectedValue(new Error("provider down"));

		await expect(cartLineFitments("sk-eur", [line(FITS)])).resolves.toEqual({});
	});
});
