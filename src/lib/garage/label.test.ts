import { describe, expect, it } from "vitest";

import { joinVehicleDetail, vehicleDetailParts, vehicleDisplayName, vehicleShortLabel } from "./label";

const OCTAVIA = {
	makeName: "ŠKODA",
	modelName: "Octavia Combi",
	generationName: "NX",
	unresolved: false,
};

/**
 * What the shopper must be able to check: WHICH configuration of their car the answer
 * on screen is for.
 *
 * Every surface used to print the identity alone — "ŠKODA Octavia Combi NX" — which is
 * the same string for a 2018 car and a 2024 car even though those are different
 * generations with different roofs and different racks.
 */
describe("the vehicle label", () => {
	it("puts the year in the short form", () => {
		expect(vehicleShortLabel({ ...OCTAVIA, year: 2024 })).toBe("ŠKODA Octavia Combi NX · 2024");
	});

	it("prints no dangling separator when the year is unknown", () => {
		expect(vehicleShortLabel(OCTAVIA)).toBe("ŠKODA Octavia Combi NX");
		expect(vehicleShortLabel({ ...OCTAVIA, year: null })).toBe("ŠKODA Octavia Combi NX");
	});

	it("still refuses to name an unresolved vehicle", () => {
		// Its ids mean nothing to the current dataset, so any name would be a guess —
		// and a year appended to a guess is a more convincing guess.
		expect(vehicleShortLabel({ ...OCTAVIA, unresolved: true, year: 2024 })).toBeNull();
		expect(vehicleDisplayName({ ...OCTAVIA, unresolved: true })).toBeNull();
	});

	it("reports an unconfirmed roof as unconfirmed rather than guessing one", () => {
		// The roof decides which feet fit. "Iný typ" and "Neviem rozpoznať" are real
		// answers, and substituting the common roof for them is the substitution the
		// whole selector is built to avoid.
		expect(vehicleDetailParts({ ...OCTAVIA, year: 2024 })).toEqual({
			roofType: null,
			roofConfirmed: false,
			month: null,
		});
		expect(vehicleDetailParts({ ...OCTAVIA, roofType: "flush-rails" })).toMatchObject({
			roofType: "flush-rails",
			roofConfirmed: true,
		});
	});

	it("shows a month only when the shopper stated one", () => {
		expect(vehicleDetailParts({ ...OCTAVIA, manufactureMonth: 3 }).month).toBe(3);
		expect(vehicleDetailParts(OCTAVIA).month).toBeNull();
		// A month outside 1-12 is not a month.
		expect(vehicleDetailParts({ ...OCTAVIA, manufactureMonth: 0 }).month).toBeNull();
		expect(vehicleDetailParts({ ...OCTAVIA, manufactureMonth: 13 }).month).toBeNull();
	});

	it("joins detail pieces with the shared separator and drops the empty ones", () => {
		expect(joinVehicleDetail(["Integrované pozdĺžniky", null, "marec"])).toBe(
			"Integrované pozdĺžniky · marec",
		);
		expect(joinVehicleDetail([null, undefined, "  "])).toBe("");
	});
});
