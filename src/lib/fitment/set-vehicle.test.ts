import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "./contract";
import { setVehicleOf } from "./set-vehicle";

const dataset = (): FitmentDataset =>
	({
		makes: [
			{ id: "mk:bmw", name: "BMW" },
			{ id: "mk:audi", name: "AUDI", displayNames: { sk: "Audi" } },
			{ id: "mk:renault", name: "RENAULT", displayNames: { sk: "Renault" } },
		],
		models: [
			{
				id: "md:5t",
				makeId: "mk:bmw",
				name: "5 Series Touring",
				displayNames: { sk: "Rad 5 Touring", de: "5er Touring" },
			},
			{ id: "md:a6", makeId: "mk:audi", name: "A6 Avant" },
			{ id: "md:laguna", makeId: "mk:renault", name: "Renault Laguna" },
		],
		generations: [
			{ id: "gn:g31", modelId: "md:5t", name: "G31" },
			{ id: "gn:c8", modelId: "md:a6", name: "C8", displayNames: { sk: "C8 (4K)" } },
			{ id: "gn:laguna", modelId: "md:laguna", name: "III" },
			{ id: "gn:orphan", modelId: "md:missing", name: "X" },
		],
	}) as unknown as FitmentDataset;

describe("setVehicleOf", () => {
	it("names the car with the words CFM states for the reading language", () => {
		const data = dataset();
		expect(setVehicleOf(data, "gn:g31", "sk")?.label).toBe("BMW Rad 5 Touring G31");
		expect(setVehicleOf(data, "gn:g31", "de")?.label).toBe("BMW 5er Touring G31");
		// no stated name for a language: the dataset's own, never another language's
		expect(setVehicleOf(data, "gn:g31", "cs")?.label).toBe("BMW 5 Series Touring G31");
		expect(setVehicleOf(data, "gn:g31")?.label).toBe("BMW 5 Series Touring G31");
	});

	it("lists the names the maker and the generation may carry in a product name", () => {
		const car = setVehicleOf(dataset(), "gn:c8", "sk")!;
		expect(car.make).toEqual(["AUDI", "Audi"]);
		expect(car.generation).toEqual(["C8", "C8 (4K)"]);
		expect(car.label).toBe("Audi A6 Avant C8 (4K)");
	});

	it("does not give a model that already begins with its maker the maker twice", () => {
		expect(setVehicleOf(dataset(), "gn:laguna", "sk")?.label).toBe("Renault Laguna III");
	});

	it("does not name a generation the tree cannot name", () => {
		expect(setVehicleOf(dataset(), "gn:orphan", "sk")).toBeNull();
		expect(setVehicleOf(dataset(), "gn:nope", "sk")).toBeNull();
	});
});
