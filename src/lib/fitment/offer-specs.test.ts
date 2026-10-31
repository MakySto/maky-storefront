import { describe, expect, it } from "vitest";
import { describeIncludes, isCompleteSet, offerSpecs, withAttributeSpecs } from "./offer-specs";

const t = (key: string) => `[${key}]`;

describe("offerSpecs", () => {
	it("prints the facts in the order a shopper compares bars in", () => {
		const rows = offerSpecs(
			{ maxLoadKg: 75, barMaterial: "aluminium", barShape: "aero", barLengthCm: 118, barColour: "black" },
			t,
		);
		expect(rows.map((row) => row.key)).toEqual(["material", "shape", "length", "load"]);
		expect(rows[3]).toEqual({ key: "load", label: "[propertyBarLoad]", value: "75 kg" });
		expect(rows[2]!.value).toBe("118 cm");
	});

	it("has the colour only when there is room", () => {
		expect(offerSpecs({ barMaterial: "steel", barColour: "silver" }, t).map((row) => row.key)).toEqual([
			"material",
			"colour",
		]);
		expect(
			offerSpecs(
				{ maxLoadKg: 50, barMaterial: "steel", barShape: "square", barLengthCm: 100, barColour: "alu" },
				t,
			),
		).toHaveLength(4);
	});

	it("says nothing for a fact the export does not carry or does not word", () => {
		expect(offerSpecs(null, t)).toEqual([]);
		expect(offerSpecs({}, t)).toEqual([]);
		// an unknown enumeration is not copy: no row, never the raw token
		expect(offerSpecs({ barShape: "mystery", barMaterial: "carbon", barColour: "pink" }, t)).toEqual([]);
	});

	it("never prints a load that is zero, negative or not a number", () => {
		expect(offerSpecs({ maxLoadKg: 0 }, t)).toEqual([]);
		expect(offerSpecs({ maxLoadKg: -5 }, t)).toEqual([]);
		expect(offerSpecs({ maxLoadKg: Number.NaN }, t)).toEqual([]);
		expect(offerSpecs({ maxLoadKg: "75" }, t)).toEqual([]);
	});

	it("honours a smaller maximum", () => {
		expect(offerSpecs({ maxLoadKg: 75, barMaterial: "steel", barShape: "wing" }, t, { max: 2 })).toHaveLength(
			2,
		);
	});
});

describe("describeIncludes / isCompleteSet", () => {
	it("words only what is documented", () => {
		expect(describeIncludes(["bars", "feet"], t)).toBe("[includesBars], [includesFeet]");
		expect(describeIncludes(["unknown"], t)).toBeNull();
		expect(describeIncludes(null, t)).toBeNull();
		expect(describeIncludes([], t)).toBeNull();
	});

	it("calls a set complete only when the bars, the feet and the fitting kit are all documented", () => {
		expect(isCompleteSet(["bars", "feet", "fitting-kit"])).toBe(true);
		expect(isCompleteSet(["fitting-kit", "feet", "bars"])).toBe(true);
	});

	it("does not take a rule about packing for a document: bars plus a kit is not read as complete", () => {
		// whether a kit comes with its feet differs per system; the export has to say so
		expect(isCompleteSet(["bars", "fitting-kit"])).toBe(false);
		// and the contents line still says what is documented
		expect(describeIncludes(["bars", "fitting-kit"], t)).toBe("[includesBars], [includesFittingKit]");
	});

	it("does not call a set complete from what is not documented, and does not call it incomplete either", () => {
		expect(isCompleteSet(["bars", "feet"])).toBe(false);
		expect(isCompleteSet(["feet", "fitting-kit"])).toBe(false);
		expect(isCompleteSet(undefined)).toBe(false);
		expect(isCompleteSet([])).toBe(false);
	});
});

describe("withAttributeSpecs", () => {
	const dimensions = { key: "dimensions", label: "Rozmery", value: "420 × 180 × 12 cm" };
	const bars = { key: "bars", label: "Priečniky", value: "4 × 180 cm" };
	const load = { key: "cfm:attribute:max_load", label: "Maximálna nosnosť", value: "50 kg" };

	it("puts the product's own attribute rows first and keeps the facts the attributes do not say", () => {
		const rows = offerSpecs({ barColour: "black", barShape: "aero" }, t);
		const merged = withAttributeSpecs(rows, [dimensions]);
		expect(merged.map((row) => row.key)).toEqual(["dimensions", "shape", "colour"]);
	});

	it("never prints a fact twice: the attribute row wins over the facet that says the same", () => {
		const rows = offerSpecs({ maxLoadKg: 50, barMaterial: "aluminium", barLengthCm: 180 }, t);
		const merged = withAttributeSpecs(rows, [
			bars,
			load,
			{ key: "cfm:attribute:material", label: "Materiál", value: "hliník" },
		]);
		expect(merged.map((row) => row.key)).toEqual([
			"bars",
			"cfm:attribute:max_load",
			"cfm:attribute:material",
		]);
		expect(merged.find((row) => row.key === "cfm:attribute:max_load")?.value).toBe("50 kg");
	});

	it("keeps the facet row when no attribute states that fact, and is the facts alone without attributes", () => {
		const rows = offerSpecs({ maxLoadKg: 50 }, t);
		expect(withAttributeSpecs(rows, [dimensions]).map((row) => row.key)).toEqual(["dimensions", "load"]);
		expect(withAttributeSpecs(rows, [])).toEqual(rows);
		expect(withAttributeSpecs([], [])).toEqual([]);
	});

	it("is four rows at most", () => {
		const rows = offerSpecs({ barMaterial: "steel", barShape: "square", barLengthCm: 110, maxLoadKg: 60 }, t);
		expect(withAttributeSpecs(rows, [dimensions])).toHaveLength(4);
	});
});
