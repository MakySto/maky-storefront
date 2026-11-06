import { describe, expect, it } from "vitest";

import { tyreSizeIndex } from "./size-index";
import {
	isKnownTyreSize,
	isPlausibleTyreSize,
	isRememberableTyreSize,
	resolveTyreInput,
	resolveTyreText,
	tyreLabelFromSteps,
	tyreSizeEntries,
	tyreSizeKey,
	tyreSteps,
} from "./size-lookup";

const index = tyreSizeIndex();
const products = Object.entries(index.products);

/** Every distinct label of the list, in the list's own spelling. */
const labels = [...new Set(products.flatMap(([, product]) => product.sizes.map(([label]) => label)))];

describe("the list seen from the size's side", () => {
	it("holds every row of the list, once: the same 5 324 rows, turned over", () => {
		const rows = labels.reduce((sum, label) => sum + tyreSizeEntries(label).length, 0);
		expect(rows).toBe(index.counts.sizes);
		expect(labels).toHaveLength(981);
	});

	it("answers for every code of the list, and for no other", () => {
		const codes = new Set(labels.flatMap((label) => tyreSizeEntries(label).map((entry) => entry.code)));
		expect([...codes].sort()).toEqual(Object.keys(index.products).sort());
	});

	it("knows 205/55 R16 for 11 of the 145 products, the example the design shows", () => {
		expect(tyreSizeEntries("205/55 R16")).toHaveLength(11);
	});

	it("says nothing about a size the list does not hold", () => {
		expect(tyreSizeEntries("145/70 R13 XL")).toEqual([]);
		expect(isKnownTyreSize("145/70 R13 XL")).toBe(false);
		expect(isKnownTyreSize("")).toBe(false);
		expect(isKnownTyreSize(205)).toBe(false);
		expect(isKnownTyreSize(null)).toBe(false);
		expect(isKnownTyreSize("constructor")).toBe(false);
	});

	it("keeps the condition a row carries with the code it belongs to", () => {
		const withCondition = products.find(([, product]) => product.sizes.some(([, , key]) => key !== ""));
		expect(withCondition).toBeDefined();
		const [code, product] = withCondition!;
		const [label, , key] = product.sizes.find(([, , conditionKey]) => conditionKey !== "")!;
		expect(tyreSizeEntries(label).find((entry) => entry.code === code)?.conditionKey).toBe(key);
	});
});

describe("a size typed or copied is matched to the list's own label, never converted", () => {
	it.each([
		["205/55 R16", "205/55 R16"],
		["205/55R16", "205/55 R16"],
		["205/55r16", "205/55 R16"],
		["205 / 55 R 16", "205/55 R16"],
		["205 55 16", "205/55 R16"],
		["205-55-16", "205/55 R16"],
		["205/55-16", "205/55 R16"],
		["2055516", "205/55 R16"],
		["20555R16", "205/55 R16"],
		["  205/55 R16  ", "205/55 R16"],
		// What the sidewall says after the size: the load index and the speed symbol.
		["205/55 R16 91V", "205/55 R16"],
		["205/55R16 91H", "205/55 R16"],
		// The rim mark of a high-speed tyre.
		["205/55 ZR16", "205/55 R16"],
		// Not the standard shape: found by the list's own spelling, with case, spacing and the decimal sign forgiven.
		["175 R13", "175 R13"],
		["175r13", "175 R13"],
		["4.00-12", "4.00-12"],
		["4.00 - 12", "4.00-12"],
		["205/65 R17,5", "205/65 R17,5"],
		["205/65 R17.5", "205/65 R17,5"],
		["205/65r17.5", "205/65 R17,5"],
	])("%s is %s", (typed, label) => {
		expect(resolveTyreText(typed)).toBe(label);
	});

	it.each([
		"",
		"   ",
		"nič",
		"205",
		"205/55",
		"R16",
		// A well-formed size the list does not hold is no size: nothing is rounded to a neighbour.
		"205/55 R22",
		"205/55 R10",
		"206/55 R16",
		"205/56 R16",
		"145/70 R22",
		"205/55 R16 and more words than a tyre wall holds",
		"x".repeat(200),
	])("%j is no size of the list", (typed) => {
		expect(resolveTyreText(typed)).toBeNull();
	});

	it("the sizes above that are no size really are absent from the list, so the test means what it says", () => {
		for (const absent of ["205/55 R22", "205/55 R10", "206/55 R16", "205/56 R16", "145/70 R22"]) {
			expect(labels, absent).not.toContain(absent);
		}
	});

	it("does not take a non-string for a size", () => {
		expect(resolveTyreText(undefined)).toBeNull();
		expect(resolveTyreText(null)).toBeNull();
		expect(resolveTyreText(205)).toBeNull();
		expect(resolveTyreText({ toString: () => "205/55 R16" })).toBeNull();
	});

	it("finds every label of the list by its own spelling", () => {
		for (const label of labels) expect(resolveTyreText(label), label).toBe(label);
	});

	it("never leaves two labels as one size to a customer", () => {
		const keys = new Set(labels.map(tyreSizeKey));
		expect(keys.size).toBe(labels.length);
	});
});

describe("a size that is well-formed but not on the list is still the shopper's size", () => {
	// A tyre that exists (an SUV on 21-inch rims) and that no snow chain of the list is made for.
	it("is the fixture it claims to be: a plausible size the list does not hold", () => {
		expect(labels).not.toContain("205/40 R21");
	});

	it("tells a listed size from a plausible one the list does not hold", () => {
		expect(resolveTyreInput("205/55r16")).toEqual({ label: "205/55 R16", listed: true });
		expect(resolveTyreInput("205/40 R21")).toEqual({ label: "205/40 R21", listed: false });
		expect(resolveTyreInput("205/40R21 100V")).toEqual({ label: "205/40 R21", listed: false });
		expect(resolveTyreInput("205 40 21")).toEqual({ label: "205/40 R21", listed: false });
	});

	it("keeps the list's spelling for a listed size and the standard spelling for the rest", () => {
		expect(resolveTyreInput("175r13")).toEqual({ label: "175 R13", listed: true });
		expect(resolveTyreInput("4.00 - 12")).toEqual({ label: "4.00-12", listed: true });
	});

	it("is no size when it is not a tyre's size at all", () => {
		for (const text of ["", "   ", "nič", "205", "205/55", "R16", "x".repeat(200)]) {
			expect(resolveTyreInput(text), JSON.stringify(text)).toBeNull();
		}
		// Outside the range of tyres that exist: width 125-395, profile 25-90, rim 10-24.
		for (const text of ["205/55 R61", "999/55 R16", "205/99 R16", "205/10 R16", "205/55 R9", "100/55 R16"]) {
			expect(resolveTyreInput(text), text).toBeNull();
		}
		for (const value of [undefined, null, 205, {}, ["205/55 R16"]])
			expect(resolveTyreInput(value)).toBeNull();
	});

	it("says what may be remembered: a size of the list, or a well-formed one", () => {
		expect(isRememberableTyreSize("205/55 R16")).toBe(true);
		expect(isRememberableTyreSize("205/40 R21")).toBe(true);
		expect(isRememberableTyreSize("175 R13")).toBe(true);
		expect(isRememberableTyreSize("205/55 R61")).toBe(false);
		expect(isRememberableTyreSize("205/55R16")).toBe(false);
		expect(isRememberableTyreSize("")).toBe(false);
		expect(isRememberableTyreSize(205)).toBe(false);
		expect(isPlausibleTyreSize("205/40 R21")).toBe(true);
		expect(isPlausibleTyreSize("175 R13")).toBe(false);
		expect(isPlausibleTyreSize("4.00-12")).toBe(false);
	});

	it("no plausible size is mistaken for a listed one", () => {
		expect(isKnownTyreSize("205/40 R21")).toBe(false);
		expect(tyreSizeEntries("205/40 R21")).toEqual([]);
	});
});

describe("the steps offer only what the list holds", () => {
	it("starts with the widths, the most usual ones marked", () => {
		const { widths, profiles, rims } = tyreSteps();
		expect(profiles).toBeNull();
		expect(rims).toBeNull();
		expect(widths.map((width) => width.value)).toEqual(
			[...widths.map((width) => width.value)].sort((a, b) => a - b),
		);
		expect(widths.filter((width) => width.common)).toHaveLength(12);
		// The sizes cars on snow actually wear are among the up-front ones.
		for (const usual of [175, 185, 195, 205, 215, 225, 235]) {
			expect(widths.find((width) => width.value === usual)?.common, String(usual)).toBe(true);
		}
		expect(widths).toHaveLength(43);
	});

	it("offers the profiles that exist for a width, then the rims that exist for both", () => {
		expect(tyreSteps(205).profiles).toContain(55);
		expect(tyreSteps(205).rims).toBeNull();
		expect(tyreSteps(205, 55).rims).toContain("16");
		expect(tyreSteps(205, 55).rims).toEqual(
			[...tyreSteps(205, 55).rims!].sort((a, b) => Number(a) - Number(b)),
		);
	});

	it("offers nothing for a width or a profile the list does not hold", () => {
		expect(tyreSteps(999).profiles).toEqual([]);
		expect(tyreSteps(205, 99).rims).toEqual([]);
		expect(tyreSteps(999, 55).rims).toEqual([]);
	});

	it("every path through the steps ends on a size the list holds", () => {
		let paths = 0;
		for (const { value: width } of tyreSteps().widths) {
			for (const profile of tyreSteps(width).profiles!) {
				for (const rim of tyreSteps(width, profile).rims!) {
					const label = tyreLabelFromSteps(width, profile, rim);
					expect(label, `${width}/${profile} R${rim}`).not.toBeNull();
					expect(isKnownTyreSize(label)).toBe(true);
					paths++;
				}
			}
		}
		// Every standard label of the list is reachable that way: 865 of the 981.
		expect(paths).toBe(865);
	});

	it("builds a label only from what was offered", () => {
		expect(tyreLabelFromSteps(205, 55, "16")).toBe("205/55 R16");
		expect(tyreLabelFromSteps(205, 55, "22")).toBeNull();
		expect(tyreLabelFromSteps("205", 55, "16")).toBeNull();
		expect(tyreLabelFromSteps(205, 55, 16)).toBeNull();
		expect(tyreLabelFromSteps(205, 55, undefined)).toBeNull();
	});
});
