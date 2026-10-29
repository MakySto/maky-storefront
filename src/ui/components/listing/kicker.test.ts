import { describe, expect, it } from "vitest";
import { cardKicker } from "./kicker";

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
