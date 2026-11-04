import { describe, expect, it } from "vitest";

import { localizedAttributeValues, localizedName, orderLineName } from "./summary-line-names";

describe("localizedName", () => {
	it("shows the market's translation, not the Slovak base row", () => {
		expect(
			localizedName({
				name: "Strešný nosič Nordrive Helio Black",
				translation: { name: "Dachträger Nordrive Helio Black" },
			}),
		).toBe("Dachträger Nordrive Helio Black");
	});

	it("falls back to the base name when the market has no translation", () => {
		expect(localizedName({ name: "Strešný nosič", translation: null })).toBe("Strešný nosič");
		expect(localizedName({ name: "Strešný nosič" })).toBe("Strešný nosič");
	});

	it("treats an empty or blank translation row as absent", () => {
		expect(localizedName({ name: "Strešný nosič", translation: { name: "" } })).toBe("Strešný nosič");
		expect(localizedName({ name: "Strešný nosič", translation: { name: "   " } })).toBe("Strešný nosič");
	});

	it("uses the fallback only when there is no name at all", () => {
		expect(localizedName(null, "Produkt")).toBe("Produkt");
		expect(localizedName({ name: "", translation: null }, "Produkt")).toBe("Produkt");
	});
});

describe("localizedAttributeValues", () => {
	it("translates each attribute's first value and keeps the order", () => {
		expect(
			localizedAttributeValues([
				{ values: [{ name: "Čierna", translation: { name: "Schwarz" } }] },
				{ values: [{ name: "Hliník", translation: null }] },
			]),
		).toEqual(["Schwarz", "Hliník"]);
	});

	it("drops attributes without a value instead of showing a blank", () => {
		expect(
			localizedAttributeValues([{ values: [] }, { values: [{ name: "", translation: { name: "" } }] }]),
		).toEqual([]);
		expect(localizedAttributeValues(undefined)).toEqual([]);
	});
});

describe("orderLineName", () => {
	it("prefers the name the order was placed under", () => {
		expect(orderLineName({ productName: "Strešný nosič", translatedProductName: "Dachträger" })).toBe(
			"Dachträger",
		);
	});

	it("keeps the base row when the order carries no translated name", () => {
		expect(orderLineName({ productName: "Strešný nosič", translatedProductName: "" })).toBe("Strešný nosič");
		expect(orderLineName({ productName: "Strešný nosič" })).toBe("Strešný nosič");
	});
});
