import { describe, expect, it } from "vitest";

import { type FitmentApplication, type FitmentDataset } from "@/lib/fitment/contract";
import { variantAsked } from "@/lib/fitment/selector-plan";
import {
	decodeGarageCookie,
	encodeGarageCookie,
	fromVehicleSelection,
	normalizePayload,
	sameVehicle,
	toVehicleSelection,
	type GaragePayload,
	type StoredVehicle,
} from "./cookie";
import { variantDetails } from "./label";
import { upgradeStoredVehicle } from "./retired";
import { resolveVariantAnswer } from "./selection";

/**
 * The glass roof and a van's roof height (CFM, 2026-11-17) in the Garage: stored when the shopper
 * answered, never invented, asked again where a car saved earlier has no answer.
 */

const CAR: StoredVehicle = { k: "mk", m: "md", g: "gen", y: 2022 };
const SECRET = "test-secret";

const payload = (c: StoredVehicle[]): GaragePayload => ({ v: 3, a: 0, c });

describe("the cookie carries the answers and survives a round trip", () => {
	it("stores glassRoof and roofHeight in short keys and reads them back", () => {
		const car = { ...CAR, gr: "without", rh: "high" } as const;
		const decoded = decodeGarageCookie(encodeGarageCookie(payload([car]), SECRET), {
			secret: SECRET,
			requireSignature: true,
		});
		expect(decoded.ok && decoded.payload.c[0]).toEqual(car);
		expect(toVehicleSelection(car)).toMatchObject({ glassRoof: "without", roofHeight: "high" });
		expect(fromVehicleSelection(toVehicleSelection(car))).toEqual(car);
	});

	it("leaves a car with no answer without the keys (nothing is defaulted)", () => {
		const selection = toVehicleSelection(CAR);
		expect("glassRoof" in selection).toBe(false);
		expect("roofHeight" in selection).toBe(false);
	});

	it("takes the answer into account: the same car with another answer is another car", () => {
		expect(sameVehicle({ ...CAR, gr: "with" }, { ...CAR, gr: "without" })).toBe(false);
		expect(sameVehicle({ ...CAR, gr: "with" }, CAR)).toBe(false);
		expect(sameVehicle({ ...CAR, gr: "with" }, { ...CAR, gr: "with" })).toBe(true);
	});

	it("drops a value outside the contract and keeps the car, unanswered", () => {
		const read = normalizePayload({ v: 3, a: 0, c: [{ ...CAR, gr: "panorama", rh: "high" }] });
		expect(read?.c[0]).toEqual({ ...CAR, rh: "high" });
	});

	it("reads a cookie written before the question existed, with no answer", () => {
		const read = normalizePayload({ v: 3, a: 0, c: [CAR] });
		expect(read?.c[0]).toEqual(CAR);
	});
});

describe("which cars are asked", () => {
	const app = (generationId: string, qualifiers: FitmentApplication["qualifiers"]) => ({
		generationId,
		qualifiers,
	});

	it("asks when the generation says its sets differ in it", () => {
		expect(variantAsked([], { id: "g", glassRoof: ["with", "without"] }, "glassRoof")).toBe(true);
	});

	it("asks when only an application is made for one version, even if the generation lists none", () => {
		expect(variantAsked([app("g", { glassRoof: ["without"] })], { id: "g" }, "glassRoof")).toBe(true);
	});

	it("asks when one value is the only one named: a set made for one version says nothing about this car", () => {
		expect(variantAsked([], { id: "g", roofHeight: ["high"] }, "roofHeight")).toBe(true);
	});

	it("asks nothing of a car that does not differ, and nothing of another generation's sets", () => {
		expect(variantAsked([app("other", { glassRoof: ["with"] })], { id: "g" }, "glassRoof")).toBe(false);
		expect(variantAsked([app("g", {})], { id: "g" }, "glassRoof")).toBe(false);
		expect(variantAsked([app("g", { glassRoof: ["with"] })], { id: "g" }, "roofHeight")).toBe(false);
	});
});

describe("the answer on the way in", () => {
	it("is kept when asked and given, and never invented", () => {
		expect(resolveVariantAnswer(true, ["with", "without"] as const, "with")).toBe("with");
		expect(resolveVariantAnswer(true, ["with", "without"] as const, undefined)).toBeUndefined();
	});

	it("is dropped for a generation that does not ask, refused when outside the contract", () => {
		expect(resolveVariantAnswer(false, ["with", "without"] as const, "with")).toBeUndefined();
		expect(resolveVariantAnswer<string>(true, ["with", "without"], "panorama")).toBe("invalid");
	});
});

describe("what a saved car shows", () => {
	it("says 'not said' as null for a car saved before the question, and lists only what is asked", () => {
		expect(variantDetails(["glassRoof"], {})).toEqual([{ key: "glassRoof", value: null }]);
		expect(variantDetails(["glassRoof", "roofHeight"], { gr: "with", rh: "standard" })).toEqual([
			{ key: "glassRoof", value: "with" },
			{ key: "roofHeight", value: "standard" },
		]);
		expect(variantDetails([], { gr: "with" })).toEqual([]);
	});
});

describe("a car moved to another generation by CFM", () => {
	const NOW = new Date("2026-11-18T12:00:00Z");
	const dataset = (asks: boolean): Parameters<typeof upgradeStoredVehicle>[0] =>
		({
			makes: [{ id: "mk", name: "MAKE" }],
			models: [{ id: "md", makeId: "mk", name: "md" }],
			generations: [
				{
					id: "gen-new",
					modelId: "md",
					name: "new",
					productionYearFrom: 2018,
					productionYearTo: null,
					qualifiers: asks ? { glassRoof: ["with", "without"] } : {},
				},
			],
			applications: [],
			retiredVehicleIds: { generations: { gen: "gen-new" } },
		}) as unknown as FitmentDataset;

	it("keeps the answer where the new generation asks the same question", () => {
		const result = upgradeStoredVehicle(dataset(true), { ...CAR, gr: "with" }, NOW);
		expect(result.kind === "moved" && result.vehicle.gr).toBe("with");
	});

	it("drops it where the new generation no longer asks", () => {
		const result = upgradeStoredVehicle(dataset(false), { ...CAR, gr: "with" }, NOW);
		expect(result.kind === "moved" && result.vehicle.gr).toBeUndefined();
	});
});
