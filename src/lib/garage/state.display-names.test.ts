import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FitmentDataset } from "@/lib/fitment/contract";
import { EMPTY_GARAGE, encodeGarageCookie, GARAGE_COOKIE_NAME, type GaragePayload } from "./cookie";

/**
 * The garage names a saved car from the DATASET at render time — never from the cookie, which holds
 * ids only — and, since the Thule opening, in the language CFM states for the reader.
 */
const { cookieValue } = vi.hoisted(() => ({ cookieValue: { current: undefined as string | undefined } }));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === "maky-garage" && cookieValue.current ? { value: cookieValue.current } : undefined,
	}),
}));

import { readGarage } from "./state";

const dataset = {
	makes: [{ id: "mk", name: "PORSCHE", displayNames: { sk: "Porsche" } }],
	models: [{ id: "md", makeId: "mk", name: "Macan", displayNames: { sk: "Macan", cs: "Macan S" } }],
	generations: [
		{
			id: "gn",
			modelId: "md",
			name: "95B",
			productionYearFrom: 2014,
			productionYearTo: null,
			qualifiers: {},
		},
	],
} as unknown as FitmentDataset;

const payload: GaragePayload = {
	...EMPTY_GARAGE,
	c: [{ k: "mk", m: "md", g: "gn", y: 2020, r: "flush-rails" }],
};

beforeEach(() => {
	expect(GARAGE_COOKIE_NAME).toBe("maky-garage");
	cookieValue.current = encodeGarageCookie(payload, null);
});

describe("a saved car's names", () => {
	it("are the ones CFM states for the reader's language", async () => {
		const garage = await readGarage(dataset, "sk");
		expect(garage.active).toMatchObject({
			makeName: "Porsche",
			modelName: "Macan",
			generationName: "95B",
			unresolved: false,
		});
	});

	it("fall back to the dataset's own name where CFM states none for that language", async () => {
		const garage = await readGarage(dataset, "cs");
		// No `cs` for the make: the dataset's own name. A `cs` for the model: that one.
		expect(garage.active).toMatchObject({ makeName: "PORSCHE", modelName: "Macan S", generationName: "95B" });
	});

	it("are the dataset's own when no language is given — every caller that was not changed keeps working", async () => {
		const garage = await readGarage(dataset);
		expect(garage.active).toMatchObject({ makeName: "PORSCHE", modelName: "Macan", generationName: "95B" });
	});

	it("leave the stored identity alone: only the label moved", async () => {
		const garage = await readGarage(dataset, "sk");
		expect(garage.active?.stored).toMatchObject({ k: "mk", m: "md", g: "gn", y: 2020, r: "flush-rails" });
		expect(garage.active?.selection).toMatchObject({
			makeId: "mk",
			modelId: "md",
			generationId: "gn",
			year: 2020,
		});
	});

	it("stay unresolved, and unnamed, when the dataset no longer holds the car", async () => {
		const gone = { ...dataset, generations: [] } as unknown as FitmentDataset;
		const garage = await readGarage(gone, "sk");
		expect(garage.active).toMatchObject({ unresolved: true, generationName: null });
	});
});
