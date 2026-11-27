import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { type GaragePayload, type StoredVehicle } from "./cookie";
import { canonicalGarage, upgradeStoredVehicle } from "./retired";

/**
 * The wave CFM announced for the week of 2026-11-30 (11 corrections to overlapping generations):
 *
 *   - three generations leave for ONE successor (Kamiq NW4 -> NW, Patriot MK -> MK74, Rexton Y250 -> Y200);
 *   - the Mazda 3 Hatchback label "2003-2013" is split between BK (2003-2009) and BL (2009-2013);
 *   - five generations that stay are given another END year (Audi A6 Avant C8, Audi Q3 F3 and Citroen
 *     C5 Aircross to 2025, VW Caddy 2K and Caddy Maxi 2K to 2015) and two are renamed (C84, SB).
 *
 * Ids here are made up; the shapes are the ones the real dataset has (checked on 3.0.0-full-20261022.2
 * with the four changes applied: 87 moved, 1 split, 1 model, 0 dropped).
 *
 * The clock is passed in everywhere an open-ended generation could be compared with it (CLAUDE.md §11).
 */
const NOW = new Date("2026-11-30T12:00:00Z");

type Gen = { id: string; model: string; from: number; to: number | null };

function dataset(gens: Gen[], retired: FitmentDataset["retiredVehicleIds"]): FitmentDataset {
	const models = [...new Set(gens.map((g) => g.model))];
	return {
		makes: [{ id: "mk", name: "MAKE" }],
		models: models.map((id) => ({ id, makeId: "mk", name: id })),
		generations: gens.map((g) => ({
			id: g.id,
			modelId: g.model,
			name: g.id,
			productionYearFrom: g.from,
			productionYearTo: g.to,
			qualifiers: {},
		})),
		applications: [],
		retiredVehicleIds: retired,
	} as unknown as FitmentDataset;
}

const car = (model: string, g: string, y: number): StoredVehicle => ({ k: "mk", m: model, g, y });
const names = (up: ReturnType<typeof upgradeStoredVehicle>) =>
	up.kind === "choose" ? [...up.candidates] : up.kind === "moved" ? [up.vehicle.g] : up.kind;

describe("the three generations that leave for one successor", () => {
	const d = dataset(
		[
			{ id: "nw", model: "kamiq", from: 2019, to: null },
			{ id: "mk74", model: "patriot", from: 2006, to: 2017 },
			{ id: "y200", model: "rexton", from: 2002, to: 2017 },
		],
		{ generations: { nw4: "nw", mk: "mk74", y250: "y200" } },
	);

	it("move without a question, in the years they were built", () => {
		expect(names(upgradeStoredVehicle(d, car("kamiq", "nw4", 2024), NOW))).toEqual(["nw"]);
		expect(names(upgradeStoredVehicle(d, car("patriot", "mk", 2010), NOW))).toEqual(["mk74"]);
		expect(names(upgradeStoredVehicle(d, car("rexton", "y250", 2012), NOW))).toEqual(["y200"]);
	});

	it("ask for a year the successor was never built in, and keep the retired id until the answer", () => {
		const up = upgradeStoredVehicle(d, car("patriot", "mk", 2018), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["mk74"] });
		expect(up.kind === "choose" && up.vehicle.g).toBe("mk");
	});
});

describe("the Mazda 3 Hatchback label '2003-2013' split into BK and BL", () => {
	const d = dataset(
		[
			{ id: "bk", model: "m3h", from: 2003, to: 2009 },
			{ id: "bl", model: "m3h", from: 2009, to: 2013 },
			{ id: "bm", model: "m3h", from: 2013, to: 2019 },
		],
		{ generations_split: { label: ["bk", "bl"] } },
	);

	it("is settled by the year where one window holds it", () => {
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2003), NOW))).toEqual(["bk"]);
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2007), NOW))).toEqual(["bk"]);
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2011), NOW))).toEqual(["bl"]);
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2013), NOW))).toEqual(["bl"]);
	});

	it("goes to the shopper in 2009, which both windows hold", () => {
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2009), NOW))).toEqual(["bk", "bl"]);
	});

	it("goes to the shopper for a year neither holds, never to BM by position or name", () => {
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2014), NOW))).toEqual(["bk", "bl"]);
		expect(names(upgradeStoredVehicle(d, car("m3h", "label", 2002), NOW))).toEqual(["bk", "bl"]);
	});
});

describe("a generation that stays but is given another end year", () => {
	const d = dataset(
		[
			{ id: "k2", model: "caddy", from: 2004, to: 2015 },
			{ id: "sa", model: "caddy", from: 2015, to: 2020 },
			{ id: "f3", model: "q3", from: 2018, to: 2025 },
		],
		{ generations: {} },
	);

	it("is left alone for a year inside the new window, 2015 included", () => {
		expect(upgradeStoredVehicle(d, car("caddy", "k2", 2015), NOW).kind).toBe("unchanged");
		expect(upgradeStoredVehicle(d, car("caddy", "k2", 2009), NOW).kind).toBe("unchanged");
		expect(upgradeStoredVehicle(d, car("q3", "f3", 2025), NOW).kind).toBe("unchanged");
	});

	it("asks again when the saved year is now past the end, offering the generations built that year", () => {
		const up = upgradeStoredVehicle(d, car("caddy", "k2", 2018), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["sa"] });
		// Nothing is rewritten into a guess: the shopper's own generation stays until they answer.
		expect(up.kind === "choose" && up.vehicle).toMatchObject({ g: "k2", y: 2018 });
	});

	it("shows the model's own generations when nothing else was built that year", () => {
		const up = upgradeStoredVehicle(d, car("q3", "f3", 2026), NOW);
		expect(up).toMatchObject({ kind: "choose", candidates: ["f3"] });
	});

	it("asks only about a year the generation was not built in, and offers only its own model", () => {
		const up = upgradeStoredVehicle(d, car("q3", "f3", 2019), NOW);
		expect(up.kind).toBe("unchanged");
		const past = upgradeStoredVehicle(d, car("caddy", "k2", 2019), NOW);
		expect(past).toMatchObject({ kind: "choose", candidates: ["sa"] });
	});

	it("keeps the cookie as it was and flags the car in the garage and for the car in use", () => {
		const payload: GaragePayload = {
			v: 1,
			a: 0,
			c: [car("caddy", "k2", 2018), car("q3", "f3", 2020)],
			u: car("caddy", "k2", 2017),
		} as unknown as GaragePayload;
		const out = canonicalGarage(payload, d, NOW);
		expect(out.changed).toBe(false);
		expect([...out.choices.keys()]).toEqual([0]);
		expect(out.choices.get(0)?.candidates).toEqual(["sa"]);
		expect(out.inUseChoice?.candidates).toEqual(["sa"]);
	});
});
