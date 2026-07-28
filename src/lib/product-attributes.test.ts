import { describe, expect, it } from "vitest";
import {
	formatAttributeValue,
	formatOuterDimensions,
	formatProductAttributeValue,
	getAttributeUnit,
	type AttributeInput,
} from "./product-attributes";

const SK = "sk-SK";
const NBSP = " ";

const attr = (
	externalReference: string | null,
	values: string[],
	extra: Partial<AttributeInput["attribute"]> = {},
): AttributeInput => ({
	attribute: { name: "x", slug: "x", externalReference, inputType: "NUMERIC", unit: null, ...extra },
	values: values.map((name) => ({ name })),
});

describe("getAttributeUnit", () => {
	it("maps the proven CFM references", () => {
		expect(getAttributeUnit(attr("cfm:attribute:weight", []).attribute)).toBe("kg");
		expect(getAttributeUnit(attr("cfm:attribute:volume", []).attribute)).toBe("l");
		expect(getAttributeUnit(attr("cfm:attribute:max_speed", []).attribute)).toBe("km/h");
		expect(getAttributeUnit(attr("cfm:attribute:outer_length", []).attribute)).toBe("cm");
	});

	it("returns no unit for attributes whose unit is not established", () => {
		// A guessed unit is a factual claim about the product.
		expect(getAttributeUnit(attr("cfm:attribute:max_tire_width", []).attribute)).toBeUndefined();
		expect(getAttributeUnit(attr("cfm:attribute:max_wheelbase", []).attribute)).toBeUndefined();
		expect(getAttributeUnit(attr("cfm:attribute:bike_capacity", []).attribute)).toBeUndefined();
		expect(getAttributeUnit(attr(null, []).attribute)).toBeUndefined();
		expect(getAttributeUnit(attr("cfm:attribute:not_a_real_one", []).attribute)).toBeUndefined();
	});

	it("prefers Saleor's native unit over the local map", () => {
		expect(getAttributeUnit(attr("cfm:attribute:weight", [], { unit: "G" }).attribute)).toBe("g");
	});

	it("falls back to the local map when the native unit is unrecognised", () => {
		expect(getAttributeUnit(attr("cfm:attribute:weight", [], { unit: "ACRE_IN" }).attribute)).toBe("kg");
	});
});

describe("formatAttributeValue", () => {
	it("uses a decimal comma in Slovak and appends the unit", () => {
		expect(formatAttributeValue("25.2", attr("cfm:attribute:weight", []).attribute, SK)).toBe(
			`25,2${NBSP}kg`,
		);
	});

	it("joins value and unit with a non-breaking space", () => {
		const out = formatAttributeValue("130", attr("cfm:attribute:max_speed", []).attribute, SK);
		expect(out).toBe(`130${NBSP}km/h`);
		expect(out).not.toContain(" km/h");
	});

	it("formats integers without a fractional part", () => {
		expect(formatAttributeValue("590", attr("cfm:attribute:volume", []).attribute, SK)).toBe(`590${NBSP}l`);
	});

	it("leaves a number bare when no unit is proven", () => {
		expect(formatAttributeValue("1", attr("cfm:attribute:bike_capacity", []).attribute, SK)).toBe("1");
	});

	it("passes text and boolean-as-dropdown values through untouched", () => {
		const dropdown = attr("cfm:attribute:t_adapter", [], { inputType: "DROPDOWN" }).attribute;
		expect(formatAttributeValue("Nie", dropdown, SK)).toBe("Nie");
		expect(formatAttributeValue("Áno", dropdown, SK)).toBe("Áno");
		expect(formatAttributeValue("Rýchloupínací systém PowerClick", dropdown, SK)).toBe(
			"Rýchloupínací systém PowerClick",
		);
	});

	it("does not mangle a value that merely starts with digits", () => {
		const dropdown = attr("cfm:attribute:ski_count", [], { inputType: "DROPDOWN" }).attribute;
		expect(formatAttributeValue("5–7 lyží / 3–5 snowboardov", dropdown, SK)).toBe(
			"5–7 lyží / 3–5 snowboardov",
		);
	});

	it("accepts a value already written with a decimal comma", () => {
		expect(formatAttributeValue("25,2", attr("cfm:attribute:weight", []).attribute, SK)).toBe(
			`25,2${NBSP}kg`,
		);
	});
});

describe("formatProductAttributeValue", () => {
	it("formats every value and drops empty ones", () => {
		const a = attr("cfm:attribute:max_load", ["20", "", "75"]);
		expect(formatProductAttributeValue(a, SK)).toEqual([`20${NBSP}kg`, `75${NBSP}kg`]);
	});

	it("returns an empty list for an attribute with no values", () => {
		expect(formatProductAttributeValue(attr("cfm:attribute:weight", []), SK)).toEqual([]);
	});
});

describe("formatOuterDimensions", () => {
	const dims = [
		attr("cfm:attribute:outer_length", ["232"]),
		attr("cfm:attribute:outer_width", ["92"]),
		attr("cfm:attribute:outer_height", ["45"]),
	];

	it("combines all three axes into one labelled value", () => {
		expect(formatOuterDimensions(dims, SK)).toBe(`232 × 92 × 45${NBSP}cm`);
	});

	it("is null when an axis is missing — a partial line hides which one", () => {
		expect(formatOuterDimensions(dims.slice(0, 2), SK)).toBeNull();
	});

	it("is null when an axis has no value", () => {
		const withBlank = [dims[0], dims[1], attr("cfm:attribute:outer_height", [""])];
		expect(formatOuterDimensions(withBlank, SK)).toBeNull();
	});

	it("is null when the axes disagree on the unit", () => {
		const mixed = [dims[0], dims[1], attr("cfm:attribute:outer_height", ["450"], { unit: "MM" })];
		expect(formatOuterDimensions(mixed, SK)).toBeNull();
	});

	it("is null when a value is not numeric", () => {
		const bad = [dims[0], dims[1], attr("cfm:attribute:outer_height", ["n/a"])];
		expect(formatOuterDimensions(bad, SK)).toBeNull();
	});
});
