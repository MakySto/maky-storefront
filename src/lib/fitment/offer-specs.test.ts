import { describe, expect, it } from "vitest";
import { describeIncludes, isCompleteSet, offerSpecs } from "./offer-specs";

const t = (key: string) => `[${key}]`;

describe("offerSpecs", () => {
	it("prints the facts in the order a shopper decides in", () => {
		const rows = offerSpecs(
			{ maxLoadKg: 75, barMaterial: "aluminium", barShape: "aero", barLengthCm: 118, barColour: "black" },
			t,
		);
		expect(rows.map((row) => row.key)).toEqual(["load", "material", "shape", "length"]);
		expect(rows[0]).toEqual({ key: "load", label: "[propertyMaxLoad]", value: "75 kg" });
		expect(rows[3]!.value).toBe("118 cm");
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

	it("calls a set complete only with bars, feet and the fitting kit", () => {
		expect(isCompleteSet(["bars", "feet", "fitting-kit"])).toBe(true);
		expect(isCompleteSet(["bars", "feet"])).toBe(false);
		expect(isCompleteSet(["feet", "fitting-kit"])).toBe(false);
		expect(isCompleteSet(undefined)).toBe(false);
	});
});
