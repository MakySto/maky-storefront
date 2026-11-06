import { describe, expect, it } from "vitest";

import { resolveTyreSelection } from "./selection";
import { tyreSizeIndex } from "./size-index";
import {
	isKnownTyreSize,
	resolveTyreText,
	tyreFit,
	tyreFitViewOf,
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

describe("does this product fit this size", () => {
	it("is a yes for a size the list holds for the code", () => {
		const [code, product] = products[0];
		const [label] = product.sizes[0];
		const fit = tyreFit(code, label);
		expect(fit?.kind).toBe("fits");
	});

	it("says which list the size comes from, and the condition the list attaches", () => {
		const conditional = products.find(([, product]) => product.sizes.some(([, , key]) => key !== ""))!;
		const [code, product] = conditional;
		const [label, , key] = product.sizes.find(([, , conditionKey]) => conditionKey !== "")!;
		const fit = tyreFit(code, label);
		expect(fit).toMatchObject({ kind: "fits", size: label });
		if (fit?.kind !== "fits") throw new Error("expected a fit");
		expect(fit.condition?.key).toBe(key);
		expect(fit.condition?.tyres.length).toBeGreaterThan(0);
		expect(typeof fit.fromManufacturerList).toBe("boolean");

		const plain = products.flatMap(([c, p]) => p.sizes.filter(([, , k]) => k === "").map(([l]) => [c, l]))[0];
		expect(tyreFit(plain[0], plain[1])).toMatchObject({ kind: "fits", condition: null });
	});

	it("tells the manufacturer's own list from the supplier's data", () => {
		const bySource = (manufacturer: boolean) =>
			products.find(([, product]) => /^manufacturer_list/.test(product.source) === manufacturer);
		const manufacturer = bySource(true)!;
		const supplier = bySource(false)!;
		expect(tyreFit(manufacturer[0], manufacturer[1].sizes[0][0])).toMatchObject({
			fromManufacturerList: true,
		});
		expect(tyreFit(supplier[0], supplier[1].sizes[0][0])).toMatchObject({ fromManufacturerList: false });
	});

	it("is a no for a size the code's list does not hold, even when another code's does", () => {
		const [code, product] = products[0];
		const own = new Set(product.sizes.map(([label]) => label));
		const foreign = labels.find((label) => !own.has(label))!;
		expect(tyreFit(code, foreign)).toEqual({ kind: "no-fit", size: foreign });
	});

	it("has nothing to say when there is no size, or the code is not size-controlled", () => {
		const [code, product] = products[0];
		expect(tyreFit(code, null)).toBeNull();
		expect(tyreFit(code, "")).toBeNull();
		expect(tyreFit("THULE-123", product.sizes[0][0])).toBeNull();
		expect(tyreFit(null, product.sizes[0][0])).toBeNull();
		expect(tyreFit(undefined, product.sizes[0][0])).toBeNull();
		expect(tyreFit("constructor", product.sizes[0][0])).toBeNull();
	});

	it("agrees with the add-to-cart check on EVERY size of EVERY code", () => {
		for (const [code, product] of products) {
			for (const [label, , key] of product.sizes) {
				const fit = tyreFit(code, label);
				expect(fit?.kind, `${code} ${label}`).toBe("fits");
				// What the page would let a customer submit for this fit, the server accepts.
				const accepted = resolveTyreSelection(code, {
					mode: "size",
					size: label,
					conditionKey: fit?.kind === "fits" && fit.condition ? fit.condition.key : "",
				});
				expect(accepted.ok, `${code} ${label}`).toBe(true);
				expect(fit?.kind === "fits" ? fit.condition?.key ?? "" : "?").toBe(key);
			}
		}
	});

	it("is a no exactly where the add-to-cart check says the size is not the code's", () => {
		for (const [code, product] of products.slice(0, 20)) {
			const own = new Set(product.sizes.map(([label]) => label));
			for (const label of labels.filter((candidate) => !own.has(candidate)).slice(0, 25)) {
				expect(tyreFit(code, label)?.kind, `${code} ${label}`).toBe("no-fit");
				expect(resolveTyreSelection(code, { mode: "size", size: label, conditionKey: "" })).toEqual({
					ok: false,
					refusal: "unknown-size",
				});
			}
		}
	});
});

describe("what the product page is told about a product", () => {
	const [code, product] = products[0];
	const size = product.sizes[0][0];

	it("is nothing for a product that is not size-controlled, whatever the size", () => {
		expect(tyreFitViewOf("A7604", size)).toBeNull();
		expect(tyreFitViewOf("A7604", null)).toBeNull();
		expect(tyreFitViewOf(null, size)).toBeNull();
		expect(tyreFitViewOf(undefined, size)).toBeNull();
		expect(tyreFitViewOf("constructor", size)).toBeNull();
	});

	it("is 'no size yet' for a size-controlled product when the shopper has told the shop nothing", () => {
		expect(tyreFitViewOf(code, null)).toEqual({ kind: "no-size" });
		expect(tyreFitViewOf(code, undefined)).toEqual({ kind: "no-size" });
		expect(tyreFitViewOf(code, "")).toEqual({ kind: "no-size" });
	});

	it("is the verdict once a size is known", () => {
		expect(tyreFitViewOf(code, size)).toEqual(tyreFit(code, size));
		const own = new Set(product.sizes.map(([label]) => label));
		const foreign = labels.find((label) => !own.has(label))!;
		expect(tyreFitViewOf(code, foreign)).toEqual({ kind: "no-fit", size: foreign });
	});

	it("carries nothing internal into the page", () => {
		for (const [productCode, one] of products) {
			const text = JSON.stringify(tyreFitViewOf(productCode, one.sizes[0][0])).toLowerCase();
			expect(text.includes("cfmp"), productCode).toBe(false);
			expect(text.includes("tazar"), productCode).toBe(false);
		}
	});

	it("names the conditions of a size in the shopper's terms: the direction and the tyres", () => {
		expect(tyreFitViewOf("N16128", "215/60 R16")).toEqual({
			kind: "fits",
			size: "215/60 R16",
			fromManufacturerList: true,
			condition: { key: "c01", mode: "only", tyres: ["Bridgestone Duravis Rxxx"] },
		});
		expect(tyreFitViewOf("N16128", "195/75 R16")).toMatchObject({
			condition: { key: "c10", mode: "not", tyres: ["Kleber", "Michelin", "Continental"] },
		});
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
