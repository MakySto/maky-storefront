import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FitmentDataset } from "@/lib/fitment/contract";
import { EMPTY_GARAGE, encodeGarageCookie, type GaragePayload } from "./cookie";

/**
 * What every surface sees when CFM has merged a saved car's generation into another one.
 *
 * Header, garage, configurator, product page and cart all read the garage through `readGarage`, so
 * this is the one place to prove they agree: the car moves to the generation that remained, and a car
 * the year cannot settle is kept, named by make and model, flagged unresolved — which every one of
 * those surfaces already treats as "no car chosen yet".
 */
const { cookieValue } = vi.hoisted(() => ({ cookieValue: { current: undefined as string | undefined } }));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === "maky-garage" && cookieValue.current ? { value: cookieValue.current } : undefined,
	}),
}));

import { readActiveSelection, readCanonicalGaragePayload, readGarage } from "./state";

const gen = (id: string, from: number, to: number | null) => ({
	id,
	modelId: "md",
	name: id,
	productionYearFrom: from,
	productionYearTo: to,
	qualifiers: {},
});

const dataset = {
	makes: [{ id: "mk", name: "SKODA" }],
	models: [{ id: "md", makeId: "mk", name: "Octavia" }],
	generations: [gen("g-new", 2010, 2020), gen("g-a", 2004, 2013), gen("g-b", 2013, 2020)],
	applications: [],
	retiredVehicleIds: {
		generations: { "g-old": "g-new" },
		generations_split: { "g-label": ["g-a", "g-b"] },
	},
} as unknown as FitmentDataset;

const set = (payload: Partial<GaragePayload>) => {
	cookieValue.current = encodeGarageCookie({ ...EMPTY_GARAGE, ...payload }, null);
};

beforeEach(() => {
	cookieValue.current = undefined;
});

describe("a saved car on a merged generation", () => {
	beforeEach(() => set({ c: [{ k: "mk", m: "md", g: "g-old", y: 2015, r: "flush-rails" }] }));

	it("is read as the generation that remained, named, and resolved", async () => {
		const garage = await readGarage(dataset, "sk");
		expect(garage.active).toMatchObject({
			makeName: "SKODA",
			modelName: "Octavia",
			generationName: "g-new",
			unresolved: false,
		});
		expect(garage.active?.stored).toMatchObject({ g: "g-new", y: 2015 });
	});

	it("gives the resolver the new generation, so fitment is answered for the car that exists", async () => {
		const selection = await readActiveSelection(dataset, "sk");
		expect(selection).toMatchObject({ generationId: "g-new", year: 2015 });
	});

	it("is the old car, unresolved, when no dataset is at hand — nothing is guessed without the map", async () => {
		const garage = await readGarage(null, "sk");
		expect(garage.active).toMatchObject({ unresolved: true });
		expect(garage.active?.stored.g).toBe("g-old");
	});
});

describe("a saved car on a dissolved label", () => {
	it("is kept, named by make and model, and offers the generations that remain", async () => {
		set({ c: [{ k: "mk", m: "md", g: "g-label", y: 2013 }] });
		const garage = await readGarage(dataset, "sk");
		expect(garage.active).toMatchObject({
			makeName: "SKODA",
			modelName: "Octavia",
			generationName: null,
			unresolved: true,
			choose: { makeId: "mk", modelId: "md" },
		});
		expect(garage.active?.choose?.candidates.map((g) => g.id)).toEqual(["g-a", "g-b"]);
	});

	it("no surface may take it for a car: the active selection is empty", async () => {
		set({ c: [{ k: "mk", m: "md", g: "g-label", y: 2013 }] });
		expect(await readActiveSelection(dataset, "sk")).toBeNull();
	});

	it("is settled by the year when only one generation was built then", async () => {
		set({ c: [{ k: "mk", m: "md", g: "g-label", y: 2006 }] });
		const garage = await readGarage(dataset, "sk");
		expect(garage.active).toMatchObject({ unresolved: false, generationName: "g-a" });
		expect(garage.active?.choose).toBeUndefined();
	});
});

describe("a car the dataset neither holds nor explains", () => {
	it("is unresolved with no choice offered, exactly as before the map existed", async () => {
		set({ c: [{ k: "mk", m: "md", g: "g-never", y: 2015 }] });
		const garage = await readGarage(dataset, "sk");
		expect(garage.active).toMatchObject({ unresolved: true, generationName: null });
		expect(garage.active?.choose).toBeUndefined();
	});
});

describe("two saved cars that became one", () => {
	it("are one car in the list the page shows and in the payload the actions work on", async () => {
		set({
			a: 1,
			c: [
				{ k: "mk", m: "md", g: "g-new", y: 2015 },
				{ k: "mk", m: "md", g: "g-old", y: 2015 },
			],
		});
		const garage = await readGarage(dataset, "sk");
		expect(garage.vehicles).toHaveLength(1);
		expect(garage.activeIndex).toBe(0);
		const { payload } = await readCanonicalGaragePayload(dataset);
		expect(payload.c).toHaveLength(1);
		expect(payload.a).toBe(0);
	});
});
