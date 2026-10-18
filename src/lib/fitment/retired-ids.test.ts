import { describe, expect, it } from "vitest";

import { type FitmentDataset, type RetiredVehicleIds } from "./contract";
import { generationFate, modelFate, retiredIdCounts, retiredIdProblems, successorOf } from "./retired-ids";
import { datasetHashFromValue } from "./dataset-hash";
import { validateFitmentDataset } from "./validate";
import demo from "./fixtures/dataset-v1.json";
import plan from "./fixtures/retired-public-ids-20261014.json";

/**
 * What the storefront believes of CFM's map of retired vehicle ids.
 *
 * The map is source data about the past. It may lead a shopper from a retired id to a live one, and it
 * is believed only as far as the dataset in hand confirms it: the cases below are the ways an entry
 * can be wrong, and each must cost the shopper one extra choice and never a wrong car.
 */

function dataset(over: {
	generations?: { id: string; modelId: string }[];
	models?: { id: string; makeId: string }[];
	retired?: RetiredVehicleIds;
}): FitmentDataset {
	return {
		makes: [{ id: "mk", name: "MAKE" }],
		models: over.models ?? [{ id: "md", makeId: "mk", name: "Model" }],
		generations: (over.generations ?? []).map((g) => ({
			...g,
			name: g.id,
			productionYearFrom: 2000,
			productionYearTo: null,
			qualifiers: {},
		})),
		applications: [],
		...(over.retired ? { retiredVehicleIds: over.retired } : {}),
	} as unknown as FitmentDataset;
}

const LIVE = [
	{ id: "g-new", modelId: "md" },
	{ id: "g-a", modelId: "md" },
	{ id: "g-b", modelId: "md" },
];

describe("a retired generation id", () => {
	it("leads to the generation that remained", () => {
		const d = dataset({ generations: LIVE, retired: { generations: { "g-old": "g-new" } } });
		expect(generationFate(d, "g-old")).toEqual({ kind: "moved", to: "g-new" });
	});

	it("is live, untouched, when the dataset still holds it — a map cannot retire a live vehicle", () => {
		const d = dataset({ generations: LIVE, retired: { generations: { "g-a": "g-b" } } });
		expect(generationFate(d, "g-a")).toEqual({ kind: "live" });
		expect(retiredIdCounts(d).dropped).toBe(1);
	});

	it("is gone, not guessed, when its target is not in this dataset", () => {
		const d = dataset({ generations: LIVE, retired: { generations: { "g-old": "g-nowhere" } } });
		expect(generationFate(d, "g-old")).toEqual({ kind: "gone" });
	});

	it("follows a second merge to the end, and drops a loop", () => {
		const chain = dataset({
			generations: LIVE,
			retired: { generations: { "g-1": "g-2", "g-2": "g-new" } },
		});
		expect(generationFate(chain, "g-1")).toEqual({ kind: "moved", to: "g-new" });
		const loop = dataset({
			generations: LIVE,
			retired: { generations: { "g-1": "g-2", "g-2": "g-1" } },
		});
		expect(generationFate(loop, "g-1")).toEqual({ kind: "gone" });
	});

	it("is gone when the dataset says nothing about it, with or without a map", () => {
		expect(generationFate(dataset({ generations: LIVE }), "g-old")).toEqual({ kind: "gone" });
		expect(generationFate(dataset({ generations: LIVE, retired: {} }), "g-old")).toEqual({ kind: "gone" });
	});
});

describe("a dissolved summary label", () => {
	it("leads to its candidates, never to one of them", () => {
		const d = dataset({
			generations: LIVE,
			retired: { generations_split: { "g-label": ["g-a", "g-b"] } },
		});
		expect(generationFate(d, "g-label")).toEqual({ kind: "split", candidates: ["g-a", "g-b"] });
	});

	it("needs every candidate live: a label whose cars lead partly nowhere is not a choice", () => {
		const d = dataset({
			generations: LIVE,
			retired: { generations_split: { "g-label": ["g-a", "g-nowhere"] } },
		});
		expect(generationFate(d, "g-label")).toEqual({ kind: "gone" });
	});

	it("needs two candidates that are not the same generation twice", () => {
		const one = dataset({ generations: LIVE, retired: { generations_split: { "g-label": ["g-a"] } } });
		expect(generationFate(one, "g-label")).toEqual({ kind: "gone" });
		const twice = dataset({
			generations: LIVE,
			retired: { generations: { "g-old": "g-a" }, generations_split: { "g-label": ["g-a", "g-old"] } },
		});
		expect(generationFate(twice, "g-label")).toEqual({ kind: "gone" });
	});

	it("needs the candidates to be one model's", () => {
		const d = dataset({
			models: [
				{ id: "md", makeId: "mk" },
				{ id: "md2", makeId: "mk" },
			] as never,
			generations: [
				{ id: "g-a", modelId: "md" },
				{ id: "g-b", modelId: "md2" },
			],
			retired: { generations_split: { "g-label": ["g-a", "g-b"] } },
		});
		expect(generationFate(d, "g-label")).toEqual({ kind: "gone" });
	});

	it("follows a candidate that was itself merged afterwards", () => {
		const d = dataset({
			generations: LIVE,
			retired: { generations: { "g-a-old": "g-a" }, generations_split: { "g-label": ["g-a-old", "g-b"] } },
		});
		expect(generationFate(d, "g-label")).toEqual({ kind: "split", candidates: ["g-a", "g-b"] });
	});
});

describe("a retired model id", () => {
	it("leads to the model that remained", () => {
		const d = dataset({ generations: LIVE, retired: { models: { "md-old": "md" } } });
		expect(modelFate(d, "md-old")).toEqual({ kind: "moved", to: "md" });
		expect(modelFate(d, "md")).toEqual({ kind: "live" });
		expect(modelFate(d, "md-other")).toEqual({ kind: "gone" });
	});
});

describe("the page of a retired id", () => {
	const d = dataset({
		generations: LIVE,
		retired: {
			generations: { "g-old": "g-new" },
			generations_split: { "g-label": ["g-a", "g-b"] },
			models: { "md-old": "md" },
		},
	});

	it("goes to the generation that remained, and a dissolved label to its model", () => {
		expect(successorOf(d, "g-old")).toBe("g-new");
		expect(successorOf(d, "g-label")).toBe("md");
		expect(successorOf(d, "md-old")).toBe("md");
	});

	it("is nothing for a live id or an unknown one", () => {
		expect(successorOf(d, "g-new")).toBeNull();
		expect(successorOf(d, "g-unknown")).toBeNull();
	});
});

describe("a malformed map", () => {
	it("is reported for the validator and ignored", () => {
		expect(retiredIdProblems(undefined)).toEqual([]);
		expect(retiredIdProblems("nope")).toHaveLength(1);
		expect(retiredIdProblems({ generations: [], models: {} })).toHaveLength(1);
		const d = dataset({ generations: LIVE, retired: "nope" as never });
		expect(generationFate(d, "g-old")).toEqual({ kind: "gone" });
		const odd = dataset({
			generations: LIVE,
			retired: { generations: { "g-old": 5 as never }, generations_split: { "g-label": "g-a" as never } },
		});
		expect(generationFate(odd, "g-old")).toEqual({ kind: "gone" });
		expect(generationFate(odd, "g-label")).toEqual({ kind: "gone" });
	});

	it("never costs the dataset: the validator warns and still accepts it", () => {
		const raw = JSON.parse(JSON.stringify(demo)) as Record<string, unknown>;
		raw.retiredVehicleIds = "nope";
		const result = validateFitmentDataset(raw, { allowUnhashedFixture: true });
		expect(result.ok).toBe(true);
		expect(result.ok && result.warnings.some((w) => w.includes("retiredVehicleIds"))).toBe(true);
	});
});

describe("the map and the dataset are one document", () => {
	it("an entry is inside the datasetHash: changing it changes the hash", () => {
		const base = JSON.parse(JSON.stringify(demo)) as Record<string, unknown>;
		const withMap = (to: string) => ({ ...base, retiredVehicleIds: { generations: { "g-old": to } } });
		expect(datasetHashFromValue(withMap("g-1"))).not.toBe(datasetHashFromValue(withMap("g-2")));
		expect(datasetHashFromValue(withMap("g-1"))).not.toBe(datasetHashFromValue(base));
	});
});

/**
 * CFM's plan of 14 October 2026 (`retired_public_ids.json`, schema `cfm-retired-public-vehicle-ids/1`),
 * run through the reader with a dataset in which every target is live. A FIXTURE FROM THE PLAN: it
 * proves the file's shape is read as CFM means it, not that a dataset carrying it has been delivered.
 */
describe("CFM's plan of 14 October 2026 (fixture)", () => {
	const retired = plan as unknown as RetiredVehicleIds;
	const targets = new Set<string>(Object.values(retired.generations ?? {}));
	const splitTargets = Object.values(retired.generations_split ?? {}).flat();
	const modelTarget = Object.values(retired.models ?? {})[0]!;

	const d = dataset({
		models: [{ id: modelTarget, makeId: "mk" }],
		generations: [...targets, ...splitTargets].map((id) => ({ id, modelId: modelTarget })),
		retired,
	});

	it("is read whole: 99 merged generations, 14 dissolved labels and the model Up! → Up", () => {
		expect(retiredIdCounts(d)).toEqual({ moved: 99, split: 14, models: 1, dropped: 0 });
	});

	it("leads each retired id to a live one", () => {
		for (const [old, to] of Object.entries(retired.generations ?? {})) {
			expect(generationFate(d, old)).toEqual({ kind: "moved", to });
		}
		for (const [old, candidates] of Object.entries(retired.generations_split ?? {})) {
			const fate = generationFate(d, old);
			expect(fate.kind).toBe("split");
			expect(fate.kind === "split" ? [...fate.candidates].sort() : []).toEqual([...candidates].sort());
		}
	});

	it("is believed by no id the dataset still holds", () => {
		const alive = dataset({
			models: d.models,
			generations: [
				...d.generations,
				...Object.keys(retired.generations ?? {}).map((id) => ({
					id,
					modelId: modelTarget,
					name: id,
					productionYearFrom: 2000,
					productionYearTo: null,
					qualifiers: {},
				})),
			] as never,
			retired,
		});
		expect(retiredIdCounts(alive).moved).toBe(0);
	});
});
