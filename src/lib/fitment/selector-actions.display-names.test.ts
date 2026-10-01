import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FitmentDataset } from "./contract";

/**
 * The selector names makes, models and generation candidates the way CFM states them for the
 * shopper's language — and the way it always did where CFM states nothing.
 *
 * Synthetic dataset, mocked provider: the point is the naming rule, not CFM's data.
 */
const { loadFitmentDataset } = vi.hoisted(() => ({ loadFitmentDataset: vi.fn() }));
vi.mock("./provider", () => ({ loadFitmentDataset }));

import { loadSelectorStep } from "./selector-actions";

const window = {
	from: { year: 2000 },
	to: null,
	startPrecision: "year" as const,
	endPrecision: "open" as const,
	reconciledToGeneration: false,
};

const dataset = {
	schemaVersion: "3.0.0",
	datasetVersion: "test",
	datasetHash: "hash",
	generatedAt: new Date().toISOString(),
	source: { system: "test" },
	saleorInstance: "api.example.test",
	validity: { validUntil: null, staleAfterDays: 3650 },
	coverage: { scope: { programId: "p", productKinds: ["roof-rack-set"] }, completeForMakeIds: [] },
	makes: [
		{ id: "mk-skoda", name: "SKODA", displayNames: { sk: "Škoda", cs: "Škoda" } },
		{ id: "mk-bmw", name: "BMW" },
		{ id: "mk-audi", name: "AUDI", displayNames: { sk: "Audi" } },
	],
	models: [
		{ id: "md-3", makeId: "mk-bmw", name: "3 Series", displayNames: { sk: "Rad 3", cs: "Řada 3" } },
		{ id: "md-5", makeId: "mk-bmw", name: "5 Series" },
		{ id: "md-x1", makeId: "mk-bmw", name: "X1", displayNames: { sk: "" } },
	],
	generations: [
		{
			id: "gn-a",
			modelId: "md-3",
			name: "E90",
			displayNames: { sk: "E90 Touring" },
			productionYearFrom: 2005,
			productionYearTo: 2012,
			qualifiers: { bodyTypes: ["estate"] },
		},
		{
			id: "gn-b",
			modelId: "md-3",
			name: "E91",
			productionYearFrom: 2008,
			productionYearTo: 2013,
			qualifiers: { bodyTypes: ["saloon"] },
		},
	],
	applications: [],
} as unknown as FitmentDataset;

beforeEach(() => {
	loadFitmentDataset.mockReset();
	loadFitmentDataset.mockResolvedValue({ dataset, status: { isFixture: false } });
	void window;
});

describe("makes", () => {
	it("are named in the shopper's language where CFM states a name, and by `name` where it does not", async () => {
		const step = await loadSelectorStep({ language: "sk" });
		expect(step.makes.map((m) => m.name)).toEqual(["Audi", "BMW", "Škoda"]);
		// The id is the identity; only the label moved.
		expect(step.makes.find((m) => m.name === "Škoda")?.id).toBe("mk-skoda");
	});

	it("keep the dataset's own names when no language is asked for — exactly as before", async () => {
		const step = await loadSelectorStep({});
		expect(step.makes.map((m) => m.name)).toEqual(["AUDI", "BMW", "SKODA"]);
	});

	it("take no other language's name", async () => {
		// AUDI states only `sk`; a Czech shopper gets the dataset's own name, not the Slovak one.
		const step = await loadSelectorStep({ language: "cs" });
		expect(step.makes.map((m) => m.name)).toEqual(["AUDI", "BMW", "Škoda"]);
	});
});

describe("models", () => {
	it("are named per language, sorted by the name the shopper reads, and survive a blank entry", async () => {
		const sk = await loadSelectorStep({ makeId: "mk-bmw", language: "sk" });
		// "Rad 3" sorts by what is printed, not by "3 Series"; the blank `sk` entry for X1 is ignored.
		expect(sk.models?.map((m) => m.name)).toEqual(["5 Series", "Rad 3", "X1"]);

		const cs = await loadSelectorStep({ makeId: "mk-bmw", language: "cs" });
		expect(cs.models?.map((m) => m.name)).toEqual(["5 Series", "Řada 3", "X1"]);

		const none = await loadSelectorStep({ makeId: "mk-bmw" });
		expect(none.models?.map((m) => m.name)).toEqual(["3 Series", "5 Series", "X1"]);
	});
});

describe("generation candidates", () => {
	it("carry the same names, when a year lands in two generations", async () => {
		const step = await loadSelectorStep({ makeId: "mk-bmw", modelId: "md-3", year: 2010, language: "sk" });
		expect(step.generationCandidates?.map((c) => c.name)).toEqual(["E90 Touring", "E91"]);

		const plain = await loadSelectorStep({ makeId: "mk-bmw", modelId: "md-3", year: 2010 });
		expect(plain.generationCandidates?.map((c) => c.name)).toEqual(["E90", "E91"]);
	});

	it("still ask which one — two generations in one year are never settled by picking the first", async () => {
		const step = await loadSelectorStep({ makeId: "mk-bmw", modelId: "md-3", year: 2010, language: "sk" });
		expect(step.generation).toBeNull();
		expect(step.generationCandidates).toHaveLength(2);
	});
});
