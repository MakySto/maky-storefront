import { describe, expect, it } from "vitest";
import { cardKicker, setKicker } from "./kicker";

describe("cardKicker", () => {
	it("drops a maker and a shelf that the name already says", () => {
		expect(cardKicker("Nordrive Silenzio Silver", "Nordrive", "Nordrive strešné nosiče")).toEqual({
			brand: null,
			category: null,
		});
		expect(
			cardKicker("Strešný nosič Menabo Delta Black BMW rad 3 G20", "Menabo", "Menabo strešné nosiče"),
		).toEqual({
			brand: null,
			category: null,
		});
	});

	it("keeps what the name does not say", () => {
		expect(cardKicker("Diamant FG2", "Pro-User", "Nosiče bicyklov na ťažné zariadenie")).toEqual({
			brand: "Pro-User",
			category: "Nosiče bicyklov na ťažné zariadenie",
		});
	});

	it("keeps a shelf that is not named after the maker", () => {
		expect(cardKicker("Strešný box Thule Motion XT L", "Thule", "Strešné boxy")).toEqual({
			brand: null,
			category: "Strešné boxy",
		});
	});

	it("ignores empty parts", () => {
		expect(cardKicker("Name", "", null)).toEqual({ brand: null, category: null });
	});
});

describe("setKicker", () => {
	it("keeps the maker and takes it out of the shelf's name", () => {
		expect(setKicker("Nordrive", "Nordrive strešné nosiče")).toEqual({
			brand: "Nordrive",
			category: "Strešné nosiče",
		});
	});

	it("leaves a shelf that is not named after the maker as it is", () => {
		expect(setKicker("Thule", "Strešné nosiče")).toEqual({ brand: "Thule", category: "Strešné nosiče" });
		expect(setKicker("Thule", "Thulesport")).toEqual({ brand: "Thule", category: "Thulesport" });
	});

	it("drops a shelf that is nothing but the maker, and empty parts", () => {
		expect(setKicker("Menabo", "Menabo")).toEqual({ brand: "Menabo", category: null });
		expect(setKicker("", "")).toEqual({ brand: null, category: null });
		expect(setKicker(null, "Nosiče lyží")).toEqual({ brand: null, category: "Nosiče lyží" });
	});
});
