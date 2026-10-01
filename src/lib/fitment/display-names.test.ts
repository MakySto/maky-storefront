import { describe, expect, it } from "vitest";

import { vehicleNodeName } from "./contract";

/**
 * A vehicle's name is one string in CFM for every market; where a market reads it differently CFM
 * says so, per language, in `displayNames`. The rule is one line and every part of it is a way to
 * print the wrong word.
 */
describe("vehicleNodeName", () => {
	const bmw = { name: "3 Series", displayNames: { sk: "Rad 3", cs: "Řada 3", de: "3er" } };

	it("uses the name CFM states for the reader's language", () => {
		expect(vehicleNodeName(bmw, "sk")).toBe("Rad 3");
		expect(vehicleNodeName(bmw, "cs")).toBe("Řada 3");
		expect(vehicleNodeName(bmw, "de")).toBe("3er");
	});

	it("falls back to the dataset's own name where CFM states none — never to another language's", () => {
		// A Czech name on a Hungarian page is exactly the mistake this boundary exists to stop.
		expect(vehicleNodeName(bmw, "hu")).toBe("3 Series");
		expect(vehicleNodeName({ name: "Octavia" }, "sk")).toBe("Octavia");
	});

	it("falls back when no language is asked for", () => {
		expect(vehicleNodeName(bmw, undefined)).toBe("3 Series");
		expect(vehicleNodeName(bmw, null)).toBe("3 Series");
		expect(vehicleNodeName(bmw, "")).toBe("3 Series");
	});

	it("ignores a blank or malformed entry — a display field is cosmetic and must not cost the vehicle", () => {
		expect(vehicleNodeName({ name: "X", displayNames: { sk: "" } }, "sk")).toBe("X");
		expect(vehicleNodeName({ name: "X", displayNames: { sk: "   " } }, "sk")).toBe("X");
		expect(vehicleNodeName({ name: "X", displayNames: { sk: 5 as unknown as string } }, "sk")).toBe("X");
		expect(vehicleNodeName({ name: "X", displayNames: null as unknown as undefined }, "sk")).toBe("X");
	});

	it("does not read a language that is an inherited property name", () => {
		expect(vehicleNodeName({ name: "X", displayNames: {} }, "constructor")).toBe("X");
		expect(vehicleNodeName({ name: "X", displayNames: {} }, "__proto__")).toBe("X");
	});

	it("does not repair capitalisation by itself", () => {
		// "PORSCHE" stays "PORSCHE" until CFM states "Porsche" — the storefront has no second table.
		expect(vehicleNodeName({ name: "PORSCHE" }, "sk")).toBe("PORSCHE");
		expect(vehicleNodeName({ name: "PORSCHE", displayNames: { sk: "Porsche" } }, "sk")).toBe("Porsche");
	});
});
