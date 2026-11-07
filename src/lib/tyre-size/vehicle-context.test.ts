import { beforeEach, describe, expect, it, vi } from "vitest";

const garage = vi.hoisted(() => ({
	payload: { v: 3, a: 0, c: [] } as Record<string, unknown>,
	throws: false,
}));
vi.mock("@/lib/garage/state", () => ({
	readGaragePayload: async () => {
		if (garage.throws) throw new Error("no request scope");
		return { payload: garage.payload, status: "ok", signed: true };
	},
}));

import { readActiveVehicleKey, tyreVehicleKeyOf } from "./vehicle-context";

const golf = { k: "veh:mk:vw", m: "veh:md:golf", g: "veh:gn:golf-7", y: 2019 };
const octavia = { k: "veh:mk:skoda", m: "veh:md:octavia", g: "veh:gn:octavia-3", y: 2016 };

beforeEach(() => {
	garage.payload = { v: 3, a: 0, c: [] };
	garage.throws = false;
});

describe("which car the shopper's tyres belong to", () => {
	it("is the car's identity in the dataset: make, model, generation and year", () => {
		expect(tyreVehicleKeyOf(golf)).toBe("veh:mk:vw|veh:md:golf|veh:gn:golf-7|2019");
	});

	it("does not depend on what decides roof fit, which says nothing about wheels", () => {
		expect(tyreVehicleKeyOf({ ...golf, r: "rails", b: "estate", d: 5, mo: 4 } as never)).toBe(
			tyreVehicleKeyOf(golf),
		);
	});

	it("tells two cars apart, and one car in two years", () => {
		expect(tyreVehicleKeyOf(golf)).not.toBe(tyreVehicleKeyOf(octavia));
		expect(tyreVehicleKeyOf(golf)).not.toBe(tyreVehicleKeyOf({ ...golf, y: 2020 }));
	});
});

describe("the car in use", () => {
	it("is no car when the garage is empty", async () => {
		await expect(readActiveVehicleKey()).resolves.toBeNull();
	});

	it("is the saved car the garage points at", async () => {
		garage.payload = { v: 3, a: 1, c: [golf, octavia] };
		await expect(readActiveVehicleKey()).resolves.toBe(tyreVehicleKeyOf(octavia));
	});

	it("is the car in use that was not saved, before any saved one", async () => {
		garage.payload = { v: 3, a: 0, c: [golf], u: octavia };
		await expect(readActiveVehicleKey()).resolves.toBe(tyreVehicleKeyOf(octavia));
	});

	it("is no car, not a crash, where the garage cannot be read", async () => {
		garage.throws = true;
		await expect(readActiveVehicleKey()).resolves.toBeNull();
	});

	it("is no car when the garage points at a car that is not there", async () => {
		garage.payload = { v: 3, a: 5, c: [golf] };
		await expect(readActiveVehicleKey()).resolves.toBeNull();
	});
});
