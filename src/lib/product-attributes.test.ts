import { describe, expect, it } from "vitest";
import {
	extendedWarrantyYears,
	formatAttributeValue,
	formatOuterDimensions,
	formatProductAttributeValue,
	formatTemperatureRange,
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

	it("answers a yes/no parameter in the market's words, never with Saleor's value name", () => {
		// The live shape: Saleor names the value "<attribute>: Yes" and carries the flag beside it.
		const tilt: AttributeInput = {
			attribute: {
				name: "Sklopná funkcia",
				slug: "tilt-function",
				externalReference: "cfm:attribute:tilt_function",
				inputType: "BOOLEAN",
				unit: null,
			},
			values: [{ name: "Sklopná funkcia: Yes", boolean: true }],
		};
		expect(formatProductAttributeValue(tilt, SK, { yes: "Áno", no: "Nie" })).toEqual(["Áno"]);
		expect(
			formatProductAttributeValue(
				{ ...tilt, values: [{ name: "Sklopná funkcia: No", boolean: false }] },
				SK,
				{ yes: "Áno", no: "Nie" },
			),
		).toEqual(["Nie"]);
		// Without words there is nothing honest to print — not "Sklopná funkcia: Yes".
		expect(formatProductAttributeValue(tilt, SK)).toEqual([]);
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

describe("a car fridge's attributes", () => {
	const fridge = (key: string, values: string[], extra: Partial<AttributeInput["attribute"]> = {}) =>
		attr(`cfm:attribute:${key}`, values, extra);

	it("carry the unit of the specification key CFM wrote them from", () => {
		const unit = (key: string) => getAttributeUnit(fridge(key, []).attribute);
		expect(unit("rated_power")).toBe("W");
		expect(unit("net_volume")).toBe("l");
		expect(unit("interior_height")).toBe("mm");
		expect(unit("input_current_ac")).toBe("A");
		expect(unit("temperature_min")).toBe("°C");
		expect(unit("temperature_max")).toBe("°C");
		// A text with its own unit inside ("5 / 2,5") has none to add.
		expect(unit("input_current_dc")).toBeUndefined();
	});

	it("prints a number with the unit and the market's decimal comma", () => {
		expect(formatProductAttributeValue(fridge("rated_power", ["60"]), SK)).toEqual([`60${NBSP}W`]);
		expect(formatProductAttributeValue(fridge("input_current_ac", ["0.26"]), SK)).toEqual([`0,26${NBSP}A`]);
	});

	it("prints a count of years with the market's plural, and only when it is given one", () => {
		const years = (count: number) => `${count} roky`;
		const warranty = fridge("warranty_years", ["3"]);
		expect(formatProductAttributeValue(warranty, SK, undefined, years)).toEqual(["3 roky"]);
		// Without the plural the number stays what it was: no invented unit.
		expect(formatProductAttributeValue(warranty, SK)).toEqual(["3"]);
		// Only the attribute that counts years is written so; a text value is left alone.
		expect(formatProductAttributeValue(fridge("rated_power", ["3"]), SK, undefined, years)).toEqual([
			`3${NBSP}W`,
		]);
		expect(
			formatProductAttributeValue(fridge("warranty_years", ["do konca roka"]), SK, undefined, years),
		).toEqual(["do konca roka"]);
	});

	it("prints a list CFM keeps as one joined text as the list it is", () => {
		const modes = fridge("cooling_modes", ["Rýchle chladenie | Úsporný režim"], { inputType: "PLAIN_TEXT" });
		expect(formatProductAttributeValue(modes, SK)).toEqual(["Rýchle chladenie", "Úsporný režim"]);
		const one = fridge("interior_components", ["1 rošt"], { inputType: "PLAIN_TEXT" });
		expect(formatProductAttributeValue(one, SK)).toEqual(["1 rošt"]);
		// Any other text keeps its bar: a separator is not guessed from a value.
		const other = fridge("climate_class", ["T | ST"], { inputType: "PLAIN_TEXT" });
		expect(formatProductAttributeValue(other, SK)).toEqual(["T | ST"]);
	});
});

describe("extendedWarrantyYears", () => {
	const WARRANTY = "cfm:attribute:warranty_years";
	const warranty = (...values: string[]) => attr(WARRANTY, values);

	it("answers the whole years the product's attribute states, when they are more than the statutory two", () => {
		expect(extendedWarrantyYears([warranty("3")], WARRANTY)).toBe(3);
		expect(extendedWarrantyYears([warranty("5")], WARRANTY)).toBe(5);
		expect(extendedWarrantyYears([warranty("10")], WARRANTY)).toBe(10);
		// The way a catalogue writes a whole number with a decimal part, and a stray space.
		expect(extendedWarrantyYears([warranty("3,0")], WARRANTY)).toBe(3);
		expect(extendedWarrantyYears([warranty(" 3 ")], WARRANTY)).toBe(3);
	});

	it("answers nothing for the statutory two years and for fewer: the strip keeps its statutory line", () => {
		for (const value of ["2", "1", "0", "-3"]) {
			expect(extendedWarrantyYears([warranty(value)], WARRANTY), value).toBeNull();
		}
	});

	it("answers nothing for a value that is not a whole number of years in full", () => {
		for (const value of ["2,5", "3.5", "3 roky", "3 years", "tri", "", "  ", "11", "30", "1e1"]) {
			expect(extendedWarrantyYears([warranty(value)], WARRANTY), value).toBeNull();
		}
	});

	it("answers nothing when the value is not one and one only", () => {
		expect(extendedWarrantyYears([warranty("3", "5")], WARRANTY)).toBeNull();
		expect(extendedWarrantyYears([warranty()], WARRANTY)).toBeNull();
		// An empty second value is no second value.
		expect(extendedWarrantyYears([warranty("3", "")], WARRANTY)).toBe(3);
	});

	it("reads only the attribute it is told to, and none when it is told none", () => {
		const other = attr("cfm:attribute:weight", ["3"]);
		expect(extendedWarrantyYears([other], WARRANTY)).toBeNull();
		expect(extendedWarrantyYears([], WARRANTY)).toBeNull();
		expect(extendedWarrantyYears([warranty("3")], undefined)).toBeNull();
		expect(extendedWarrantyYears([warranty("3")], "")).toBeNull();
		expect(extendedWarrantyYears([attr(null, ["3"])], WARRANTY)).toBeNull();
	});
});

describe("a name that already states the unit", () => {
	// The market's plural as the catalogue writes it: one / few / many / other, so "rok" "roky" "roka" "rokov".
	const years = (count: number) =>
		Number.isInteger(count)
			? count === 1
				? "1 rok"
				: count < 5
					? `${count} roky`
					: `${count} rokov`
			: `${count} roka`;
	const named = (key: string, name: string | null, values: string[]) =>
		attr(`cfm:attribute:${key}`, values, { name });
	const beside = { nameBesideValue: true };
	const table = (attribute: AttributeInput) =>
		formatProductAttributeValue(attribute, SK, undefined, years, beside);

	it("prints the bare number where the name says years, as the live warranty does", () => {
		// The production attribute is "Záruka (roky)": "Záruka (roky) 2 roky" said years twice.
		expect(table(named("warranty_years", "Záruka (roky)", ["2"]))).toEqual(["2"]);
		expect(table(named("warranty_years", "Záruka (roky)", ["1,5"]))).toEqual(["1,5"]);
	});

	it("still writes the plural where the name does not say years", () => {
		expect(table(named("warranty_years", "Záruka", ["2"]))).toEqual(["2 roky"]);
		expect(table(named("warranty_years", null, ["2"]))).toEqual(["2 roky"]);
		// A bracket is not the unit just for being a bracket.
		expect(table(named("warranty_years", "Záruka (výrobca)", ["2"]))).toEqual(["2 roky"]);
		expect(table(named("warranty_years", "Záruka 2 roky", ["2"]))).toEqual(["2 roky"]);
	});

	it.each(["rok", "roky", "rokov", "roka", "ROKY"])("knows %s as the market's word for years", (word) => {
		expect(table(named("warranty_years", `Záruka (${word})`, ["2"]))).toEqual(["2"]);
	});

	it("keeps the unit of a measurement the name does not state, and drops the one it does", () => {
		const power = (name: string) => table(named("rated_power", name, ["60"]));
		expect(power("Menovitý výkon")).toEqual([`60${NBSP}W`]);
		expect(power("Menovitý výkon (W)")).toEqual(["60"]);
		expect(power("Menovitý výkon [w]")).toEqual(["60"]);
		expect(power("Menovitý výkon (W, 12/24 V)")).toEqual(["60"]);
		// The unit we hold is the one asked for: "(kW)" is another, and is not guessed to be it.
		expect(power("Menovitý výkon (kW)")).toEqual([`60${NBSP}W`]);
	});

	it.each([
		["net_volume", "Čistý objem (l)", "17", `17${NBSP}l`],
		["interior_height", "Výška vnútra (mm)", "287", `287${NBSP}mm`],
		["input_current_ac", "Vstupný prúd AC (A)", "0,26", `0,26${NBSP}A`],
		["temperature_min", "Najnižšia teplota (°C)", "2", `2${NBSP}°C`],
		["temperature_max", "Najvyššia teplota (°C)", "8", `8${NBSP}°C`],
	])("%s: the number alone under %s", (key, name, value, withUnit) => {
		expect(table(named(key, name, [value]))).toEqual([value]);
		expect(table(named(key, name.replace(/ \(.*\)$/, ""), [value]))).toEqual([withUnit]);
	});

	it("keeps the unit wherever the value stands without its name", () => {
		// The key-facts band prints "Príkon 60 W": the name is not beside the value there.
		const power = named("rated_power", "Menovitý výkon (W)", ["60"]);
		expect(formatProductAttributeValue(power, SK)).toEqual([`60${NBSP}W`]);
		expect(formatProductAttributeValue(power, SK, undefined, years)).toEqual([`60${NBSP}W`]);
		const warranty = named("warranty_years", "Záruka (roky)", ["2"]);
		expect(formatProductAttributeValue(warranty, SK, undefined, years)).toEqual(["2 roky"]);
	});

	it("leaves the older units as the live pages print them", () => {
		// These units were printed beside their names long before the car-fridge page; nothing about
		// them changes with it, whatever the name says.
		expect(table(named("weight", "Hmotnosť (kg)", ["25,2"]))).toEqual([`25,2${NBSP}kg`]);
		expect(table(named("volume", "Objem (l)", ["590"]))).toEqual([`590${NBSP}l`]);
		expect(table(named("max_load", "Nosnosť (kg)", ["75"]))).toEqual([`75${NBSP}kg`]);
	});

	it("never touches a value that is text", () => {
		expect(table(named("warranty_years", "Záruka (roky)", ["do konca roka"]))).toEqual(["do konca roka"]);
		expect(table(named("rated_power", "Menovitý výkon (W)", ["podľa režimu"]))).toEqual(["podľa režimu"]);
	});
});

describe("formatTemperatureRange", () => {
	const join = (min: string, max: string) => `${min} až ${max}`;
	const ends = (min: string | null, max: string | null): AttributeInput[] => [
		...(min === null ? [] : [attr("cfm:attribute:temperature_min", [min])]),
		...(max === null ? [] : [attr("cfm:attribute:temperature_max", [max])]),
	];

	it("writes both ends as one range, with a real minus and the plus the range crosses zero with", () => {
		expect(formatTemperatureRange(ends("-20", "20"), SK, join)).toEqual({
			full: `\u221220${NBSP}°C až +20${NBSP}°C`,
			short: `\u221220 až +20${NBSP}°C`,
		});
	});

	it("has no plus when the range does not cross zero", () => {
		expect(formatTemperatureRange(ends("2", "8"), SK, join)?.short).toBe(`2 až 8${NBSP}°C`);
		expect(formatTemperatureRange(ends("-25", "-5"), SK, join)?.short).toBe(`\u221225 až \u22125${NBSP}°C`);
	});

	it("is not a range with one end missing, an end that is not a number, or the ends the wrong way round", () => {
		expect(formatTemperatureRange(ends("-20", null), SK, join)).toBeNull();
		expect(formatTemperatureRange(ends(null, "20"), SK, join)).toBeNull();
		expect(formatTemperatureRange(ends("-20", "podľa režimu"), SK, join)).toBeNull();
		expect(formatTemperatureRange(ends("20", "-20"), SK, join)).toBeNull();
		expect(formatTemperatureRange([], SK, join)).toBeNull();
	});
});
