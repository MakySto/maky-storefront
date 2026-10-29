import { describe, expect, it } from "vitest";
import { splitSetTitle } from "./set-title";
import type { SetVehicle } from "./set-vehicle";

const makes = ["Land Rover", "Mercedes-Benz", "Audi", "BMW", "Dacia", "EVO", "Škoda"];

describe("splitSetTitle", () => {
	it("takes a set's name apart into the product and the car", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Silenzio Silver Dacia Bigster (2025–) — Klasické lyžiny", {
				brand: "Nordrive",
				makes,
			}),
		).toEqual({ model: "Nordrive Silenzio Silver", vehicle: "Dacia Bigster" });
	});

	it("keeps a car whose name has several words and a model with a digit", () => {
		expect(
			splitSetTitle(
				"Strešný nosič Thule WingBar Edge Black BMW 5 Series Touring G31 (2017–2024) — Integrované lyžiny",
				{
					brand: "Thule",
					makes,
				},
			),
		).toEqual({ model: "Thule WingBar Edge Black", vehicle: "BMW 5 Series Touring G31" });
	});

	it("does not mistake a product line that is also a make for the car", () => {
		expect(
			splitSetTitle("Strešný nosič Thule WingBar EVO Silver Audi A6 Avant FN (2025–) — Integrované lyžiny", {
				brand: "Thule",
				makes,
			}),
		).toEqual({ model: "Thule WingBar EVO Silver", vehicle: "Audi A6 Avant FN" });
	});

	it("prefers the longer make at the same place", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio Land Rover Discovery 5 (2017–) — Pevné body", {
				brand: "Nordrive",
				makes,
			}),
		).toEqual({ model: "Nordrive Helio", vehicle: "Land Rover Discovery 5" });
	});

	it("leaves the name whole when it cannot be told where the car starts", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio Black Neznáma značka X (2020–)", {
				brand: "Nordrive",
				makes,
			}),
		).toBeNull();
		expect(splitSetTitle("", { makes })).toBeNull();
	});

	it("leaves the name whole when nothing would be left of the product", () => {
		expect(splitSetTitle("Audi A6 Avant (2018–)", { makes })).toBeNull();
	});

	it("works without a brand and without a roof or years", () => {
		expect(splitSetTitle("Nosič Menabo Omega Dacia Duster", { makes })).toEqual({
			model: "Nosič Menabo Omega",
			vehicle: "Dacia Duster",
		});
	});

	it("does not match inside a longer word", () => {
		expect(splitSetTitle("Strešný nosič Nordrive Audiovox X", { brand: "Nordrive", makes })).toBeNull();
	});
});

describe("splitSetTitle with makes that overlap", () => {
	const NAME = "Strešný nosič Nordrive Helio Land Rover Discovery 5 (2017–) — Pevné body";
	const expected = { model: "Nordrive Helio", vehicle: "Land Rover Discovery 5" };

	// "Rover" is a make of its own as well as the end of "Land Rover": the car starts at the longer one,
	// whichever way the export lists them.
	it("starts the car at Land Rover, not at the Rover inside it", () => {
		for (const list of [
			["Land Rover", "Rover", "BMW"],
			["Rover", "Land Rover", "BMW"],
			["BMW", "Rover", "Audi", "Land Rover"],
		]) {
			expect(splitSetTitle(NAME, { brand: "Nordrive", makes: list })).toEqual(expected);
		}
	});

	it("still takes a Rover that stands alone for the car", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio Rover 75 (1999–2005) — Klasické lyžiny", {
				brand: "Nordrive",
				makes: ["Land Rover", "Rover"],
			}),
		).toEqual({ model: "Nordrive Helio", vehicle: "Rover 75" });
	});
});

describe("splitSetTitle with the car the set is for", () => {
	const car = (make: string, generation: string, label: string): SetVehicle => ({
		make: [make],
		generation: [generation],
		label,
	});

	it("words the car the way the shop does when the name says it is that car", () => {
		// the same car, spelled three ways in the catalogue
		for (const spelled of ["BMW 5 Series Touring G31", "BMW rad 5 Touring G31", "BMW 5-Rad G31"]) {
			expect(
				splitSetTitle(`Strešný nosič Nordrive Helio Black ${spelled} (2017–2024) — Integrované lyžiny`, {
					brand: "Nordrive",
					makes,
					vehicles: [car("BMW", "G31", "BMW Rad 5 Touring G31")],
				}),
			).toEqual({ model: "Nordrive Helio Black", vehicle: "BMW Rad 5 Touring G31" });
		}
	});

	it("starts at the car's own maker, so a model that is also a maker is not taken for the car", () => {
		const name = "Strešný nosič Nordrive Helio Abarth Punto Evo (2010–2014) — Klasické lyžiny";
		// without the car, the last maker named is EVO and the car would be "Evo"
		expect(splitSetTitle(name, { brand: "Nordrive", makes })).toEqual({
			model: "Nordrive Helio Abarth Punto",
			vehicle: "Evo",
		});
		expect(
			splitSetTitle(name, {
				brand: "Nordrive",
				makes,
				vehicles: [car("Abarth", "199", "Abarth Punto Evo 199")],
			}),
		).toEqual({ model: "Nordrive Helio", vehicle: "Abarth Punto Evo" });
	});

	it("keeps Land Rover's own Range Rover inside the car", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio Land Rover Range Rover Evoque (2019–) — Pevné body", {
				brand: "Nordrive",
				makes: ["Land Rover", "Rover"],
				vehicles: [car("Land Rover", "L551", "Land Rover Range Rover Evoque L551")],
			}),
		).toEqual({ model: "Nordrive Helio", vehicle: "Land Rover Range Rover Evoque" });
	});

	it("keeps the name's own words when it does not say it is that car — it is never worded as another", () => {
		// the set belongs to G30 and G31 (one fit, two generations); the name is for G31
		expect(
			splitSetTitle(
				"Strešný nosič Nordrive Helio BMW 5 Series Touring G31 (2017–2024) — Integrované lyžiny",
				{
					brand: "Nordrive",
					makes,
					vehicles: [car("BMW", "G30", "BMW Rad 5 G30"), car("BMW", "G31", "BMW Rad 5 Touring G31")],
				},
			),
		).toEqual({ model: "Nordrive Helio", vehicle: "BMW Rad 5 Touring G31" });
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio BMW 5 Series Touring (2017–2024) — Integrované lyžiny", {
				brand: "Nordrive",
				makes,
				vehicles: [car("BMW", "G31", "BMW Rad 5 Touring G31")],
			}),
		).toEqual({ model: "Nordrive Helio", vehicle: "BMW 5 Series Touring" });
	});

	it("leaves the name whole when its maker is not the car's", () => {
		expect(
			splitSetTitle("Strešný nosič Nordrive Helio Audi A6 Avant C8 (2018–) — Integrované lyžiny", {
				brand: "Nordrive",
				makes,
				vehicles: [car("BMW", "G31", "BMW Rad 5 Touring G31")],
			}),
		).toBeNull();
	});
});
