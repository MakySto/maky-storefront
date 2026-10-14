import { describe, expect, it } from "vitest";

import { type FitmentDataset, type RoofType } from "@/lib/fitment/contract";
import { EMPTY_GARAGE, type GaragePayload, type StoredVehicle } from "./cookie";
import { canonicalGarage, upgradeStoredVehicle } from "./retired";

/**
 * A saved car whose generation CFM merged or dissolved: where it goes, and what is asked.
 *
 * The clock is passed in everywhere an open-ended generation could be compared with it (CLAUDE.md §11).
 */
const NOW = new Date("2026-10-14T12:00:00Z");

type Gen = {
	id: string;
	from: number;
	to: number | null;
	roofs?: RoofType[];
	bodies?: string[];
	doors?: number[];
	modelId?: string;
};

function dataset(gens: Gen[], retired: FitmentDataset["retiredVehicleIds"]): FitmentDataset {
	const modelIds = [...new Set(gens.map((g) => g.modelId ?? "md"))];
	return {
		makes: [{ id: "mk", name: "MAKE" }],
		models: modelIds.map((id) => ({ id, makeId: "mk", name: id })),
		generations: gens.map((g) => ({
			id: g.id,
			modelId: g.modelId ?? "md",
			name: g.id,
			productionYearFrom: g.from,
			productionYearTo: g.to,
			qualifiers: {
				...(g.roofs ? { roofTypes: g.roofs } : {}),
				...(g.bodies ? { bodyTypes: g.bodies } : {}),
				...(g.doors ? { doors: g.doors } : {}),
			},
		})),
		applications: [],
		retiredVehicleIds: retired,
	} as unknown as FitmentDataset;
}

const car = (over: Partial<StoredVehicle> = {}): StoredVehicle => ({
	k: "mk",
	m: "md",
	g: "g-old",
	y: 2015,
	...over,
});

describe("a car on a merged generation", () => {
	const d = dataset([{ id: "g-new", from: 2010, to: 2020, roofs: ["raised-rails", "flush-rails"] }], {
		generations: { "g-old": "g-new" },
	});

	it("moves to the generation that remained, without a question", () => {
		const up = upgradeStoredVehicle(d, car({ r: "raised-rails" }), NOW);
		expect(up).toEqual({
			kind: "moved",
			vehicle: { k: "mk", m: "md", g: "g-new", y: 2015, r: "raised-rails" },
		});
	});

	it("keeps the shopper's roof only while the new generation still offers it", () => {
		const up = upgradeStoredVehicle(d, car({ r: "t-track" }), NOW);
		expect(up.kind === "moved" && up.vehicle.r).toBeUndefined();
	});

	it("never fills a roof in, even when the new generation has one", () => {
		const one = dataset([{ id: "g-new", from: 2010, to: 2020, roofs: ["raised-rails"] }], {
			generations: { "g-old": "g-new" },
		});
		const up = upgradeStoredVehicle(one, car(), NOW);
		expect(up.kind === "moved" && up.vehicle.r).toBeUndefined();
	});

	it("keeps month and year, which are the shopper's own answers", () => {
		const up = upgradeStoredVehicle(d, car({ mo: 6 }), NOW);
		expect(up.kind === "moved" && up.vehicle).toMatchObject({ y: 2015, mo: 6 });
	});

	it("takes make and model from the generation that remained, not from the cookie", () => {
		const other = dataset([{ id: "g-new", from: 2010, to: 2020, modelId: "md-up" }], {
			generations: { "g-old": "g-new" },
		});
		const up = upgradeStoredVehicle(other, car({ m: "md-stale" }), NOW);
		expect(up.kind === "moved" && up.vehicle).toMatchObject({ k: "mk", m: "md-up", g: "g-new" });
	});

	it("asks again for a year the generation that remained was never built in", () => {
		const up = upgradeStoredVehicle(d, car({ y: 2005 }), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["g-new"] });
		// The cookie is not rewritten into a guess: the retired id stays until the shopper chooses.
		expect(up.kind === "choose" && up.vehicle.g).toBe("g-old");
	});

	it("fills a body type the new generation settles by having one, drops one it does not offer", () => {
		const gen = dataset([{ id: "g-new", from: 2010, to: 2020, bodies: ["estate"], doors: [5] }], {
			generations: { "g-old": "g-new" },
		});
		const filled = upgradeStoredVehicle(gen, car({ b: "hatchback", d: 3 }), NOW);
		expect(filled.kind === "moved" && filled.vehicle).toMatchObject({ b: "estate", d: 5 });

		const two = dataset([{ id: "g-new", from: 2010, to: 2020, bodies: ["estate", "saloon"] }], {
			generations: { "g-old": "g-new" },
		});
		const dropped = upgradeStoredVehicle(two, car({ b: "hatchback" }), NOW);
		expect(dropped.kind === "moved" && dropped.vehicle.b).toBeUndefined();
		const kept = upgradeStoredVehicle(two, car({ b: "saloon" }), NOW);
		expect(kept.kind === "moved" && kept.vehicle.b).toBe("saloon");
	});
});

describe("a car on a dissolved summary label", () => {
	const gens: Gen[] = [
		{ id: "g-a", from: 2008, to: 2014 },
		{ id: "g-b", from: 2014, to: 2019 },
		{ id: "g-c", from: 2019, to: null },
	];
	const d = dataset(gens, { generations_split: { "g-old": ["g-a", "g-b", "g-c"] } });

	it("is settled by the year when it falls in exactly one candidate's years", () => {
		const up = upgradeStoredVehicle(d, car({ y: 2010 }), NOW);
		expect(up).toMatchObject({ kind: "moved", vehicle: { g: "g-a", y: 2010 } });
	});

	it("is the shopper's choice between the two candidates the year names", () => {
		const up = upgradeStoredVehicle(d, car({ y: 2014 }), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["g-a", "g-b"] });
	});

	it("offers every candidate when the year names none", () => {
		const up = upgradeStoredVehicle(d, car({ y: 1999 }), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["g-a", "g-b", "g-c"] });
	});

	it("is never settled by a name", () => {
		const named = dataset(
			[
				{ id: "g-a", from: 2008, to: 2019 },
				{ id: "g-b", from: 2008, to: 2019 },
			],
			{ generations_split: { "g-old": ["g-a", "g-b"] } },
		);
		expect(upgradeStoredVehicle(named, car({ y: 2012 }), NOW).kind).toBe("choose");
	});
});

describe("the cars that need nothing", () => {
	const d = dataset([{ id: "g-new", from: 2010, to: 2020 }], { generations: { "g-old": "g-new" } });

	it("a car on a live generation is left exactly as it is", () => {
		expect(upgradeStoredVehicle(d, car({ g: "g-new" }), NOW)).toEqual({ kind: "unchanged" });
	});

	it("a car the dataset neither holds nor explains stays unresolved, as it always did", () => {
		expect(upgradeStoredVehicle(d, car({ g: "g-never" }), NOW)).toEqual({ kind: "gone" });
	});

	it("without a map nothing is rewritten", () => {
		const bare = dataset([{ id: "g-new", from: 2010, to: 2020 }], undefined);
		expect(upgradeStoredVehicle(bare, car(), NOW)).toEqual({ kind: "gone" });
	});

	it("a model CFM merged away beside a generation that stayed is repaired from the generation", () => {
		const m = dataset([{ id: "g-new", from: 2010, to: 2020, modelId: "md-up" }], {
			models: { "md-up-old": "md-up" },
		});
		const up = upgradeStoredVehicle(m, car({ g: "g-new", m: "md-up-old" }), NOW);
		expect(up).toEqual({ kind: "moved", vehicle: { k: "mk", m: "md-up", g: "g-new", y: 2015 } });
	});
});

describe("the garage as a whole", () => {
	const d = dataset(
		[
			{ id: "g-new", from: 2010, to: 2020 },
			{ id: "g-a", from: 2008, to: 2014 },
			{ id: "g-b", from: 2014, to: 2019 },
		],
		{ generations: { "g-old": "g-new" }, generations_split: { "g-label": ["g-a", "g-b"] } },
	);

	const payload = (over: Partial<GaragePayload>): GaragePayload => ({ ...EMPTY_GARAGE, ...over });

	it("collapses two saved cars that became one, and keeps the active car the same car", () => {
		const out = canonicalGarage(
			payload({
				a: 2,
				c: [car({ g: "g-new" }), car({ g: "g-a", y: 2009 }), car({ g: "g-old" })],
			}),
			d,
			NOW,
		);
		expect(out.changed).toBe(true);
		expect(out.payload.c).toEqual([car({ g: "g-new" }), car({ g: "g-a", y: 2009 })]);
		// The third car (the retired id) is now the first: the active index follows it.
		expect(out.payload.a).toBe(0);
	});

	it("keeps a car that needs a choice as stored and reports the choice by its place", () => {
		const out = canonicalGarage(
			payload({ c: [car({ g: "g-new" }), car({ g: "g-label", y: 2014 })] }),
			d,
			NOW,
		);
		expect(out.payload.c[1]).toEqual(car({ g: "g-label", y: 2014 }));
		expect(out.choices.get(1)?.candidates).toEqual(["g-a", "g-b"]);
		expect(out.changed).toBe(false);
	});

	it("moves the car in use, and folds it into a saved one it became", () => {
		const moved = canonicalGarage(payload({ c: [], u: car({ g: "g-old" }) }), d, NOW);
		expect(moved.payload.u).toEqual(car({ g: "g-new" }));
		const folded = canonicalGarage(
			payload({ a: 0, c: [car({ g: "g-new" })], u: car({ g: "g-old" }) }),
			d,
			NOW,
		);
		expect(folded.payload.u).toBeUndefined();
		expect(folded.payload.a).toBe(0);
	});

	it("is the payload itself when nothing changes, and when there is no dataset", () => {
		const same = payload({ c: [car({ g: "g-new" })] });
		expect(canonicalGarage(same, d, NOW).payload).toBe(same);
		expect(canonicalGarage(payload({ c: [car()] }), null, NOW).payload.c[0]).toEqual(car());
	});
});
