import { describe, expect, it } from "vitest";
import { splitSetTitle } from "./set-title";

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
