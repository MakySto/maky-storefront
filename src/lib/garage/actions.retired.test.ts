import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FitmentDataset } from "@/lib/fitment/contract";
import { decodeGarageCookie, EMPTY_GARAGE, encodeGarageCookie, type GaragePayload } from "./cookie";

/**
 * The garage actions work on the garage as the page shows it.
 *
 * After CFM merges a generation the page lists the cars in their new form (and one car where two
 * became the same). An action that indexed the raw cookie would act on a different car than the one
 * the shopper clicked, and would write the retired ids back for the next visit to translate again.
 */
const store = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (name: string) => (name === "maky-garage" && store.value ? { value: store.value } : undefined),
		set: (name: string, value: string) => {
			if (name === "maky-garage") store.value = value;
		},
		delete: () => undefined,
	}),
}));

const dataset = {
	makes: [{ id: "mk", name: "MAKE" }],
	models: [{ id: "md", makeId: "mk", name: "Model" }],
	generations: [
		{
			id: "g-new",
			modelId: "md",
			name: "g-new",
			productionYearFrom: 2010,
			productionYearTo: 2020,
			qualifiers: {},
		},
		{
			id: "g-other",
			modelId: "md",
			name: "g-other",
			productionYearFrom: 2021,
			productionYearTo: null,
			qualifiers: {},
		},
	],
	applications: [],
	retiredVehicleIds: { generations: { "g-old": "g-new" } },
} as unknown as FitmentDataset;

vi.mock("@/lib/fitment/provider", () => ({
	loadFitmentDataset: async () => ({ dataset, status: {} }),
}));

import { removeVehicle, setActiveVehicle } from "./actions";

const write = (payload: Partial<GaragePayload>) => {
	store.value = encodeGarageCookie({ ...EMPTY_GARAGE, ...payload }, null);
};
const read = (): GaragePayload => {
	const decoded = decodeGarageCookie(store.value, { secret: null, requireSignature: false });
	if (!decoded.ok) throw new Error("cookie did not decode");
	return decoded.payload;
};

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
	store.value = undefined;
});

describe("choosing a saved car after CFM merged one", () => {
	it("acts on the car the page showed, and heals the cookie with the new ids", async () => {
		// The page shows [g-new 2015, g-other 2022]: the retired entry collapsed onto the first.
		write({
			c: [
				{ k: "mk", m: "md", g: "g-old", y: 2015 },
				{ k: "mk", m: "md", g: "g-new", y: 2015 },
				{ k: "mk", m: "md", g: "g-other", y: 2022 },
			],
		});
		const result = await setActiveVehicle(1);
		expect(result).toEqual({ ok: true, activeIndex: 1, count: 2 });
		const after = read();
		expect(after.c.map((v) => v.g)).toEqual(["g-new", "g-other"]);
		expect(after.a).toBe(1);
	});

	it("removes the car the shopper clicked, not its neighbour in the raw cookie", async () => {
		write({
			c: [
				{ k: "mk", m: "md", g: "g-old", y: 2015 },
				{ k: "mk", m: "md", g: "g-new", y: 2015 },
				{ k: "mk", m: "md", g: "g-other", y: 2022 },
			],
		});
		await removeVehicle(1);
		expect(read().c.map((v) => v.g)).toEqual(["g-new"]);
	});
});
