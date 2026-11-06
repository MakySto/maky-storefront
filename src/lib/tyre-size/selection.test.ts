import { describe, expect, it } from "vitest";

import { resolveTyreSelection, TYRE_FIELDS, tyreSelectionInputFromForm } from "./selection";
import { tyreSizeIndex, tyreSizeProduct } from "./size-index";

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe("tyreSelectionInputFromForm", () => {
	it("reads the three fields the picker sends", () => {
		expect(
			tyreSelectionInputFromForm(
				form({
					[TYRE_FIELDS.mode]: "size",
					[TYRE_FIELDS.size]: "205/55 R16",
					[TYRE_FIELDS.condition]: "c01",
				}),
			),
		).toEqual({ mode: "size", size: "205/55 R16", conditionKey: "c01" });
		expect(tyreSelectionInputFromForm(form({ [TYRE_FIELDS.mode]: "code" }))).toEqual({ mode: "code" });
	});

	it("keeps the field names the page and the action agree on", () => {
		expect(TYRE_FIELDS).toEqual({ mode: "tyreMode", size: "tyreSize", condition: "tyreCondition" });
	});

	it("reads nothing as nothing, and an unknown mode as nothing", () => {
		expect(tyreSelectionInputFromForm(form({}))).toBeNull();
		expect(tyreSelectionInputFromForm(form({ [TYRE_FIELDS.mode]: "" }))).toBeNull();
		expect(tyreSelectionInputFromForm(form({ [TYRE_FIELDS.mode]: "anything" }))).toBeNull();
		expect(tyreSelectionInputFromForm(form({ [TYRE_FIELDS.mode]: "SIZE" }))).toBeNull();
	});

	it("reads a file upload in a size field as an empty size, not as a value", () => {
		const data = new FormData();
		data.set(TYRE_FIELDS.mode, "size");
		data.set(TYRE_FIELDS.size, new Blob(["205/55 R16"]), "size.txt");
		expect(tyreSelectionInputFromForm(data)).toEqual({ mode: "size", size: "", conditionKey: "" });
	});
});

describe("resolveTyreSelection", () => {
	it("accepts a size of the code and records the rim and the list it was checked against", () => {
		const result = resolveTyreSelection("N16061", { mode: "size", size: "145/70 R12", conditionKey: "" });
		expect(result).toEqual({
			ok: true,
			selection: {
				mode: "size",
				size: "145/70 R12",
				rim: "12",
				condition: null,
				basis: tyreSizeProduct("N16061")!.source,
				listId: "snehove-retaze-20261105",
			},
		});
	});

	it("refuses the invented combination 145/70 R13 on N16061", () => {
		expect(resolveTyreSelection("N16061", { mode: "size", size: "145/70 R13", conditionKey: "" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});

	it("matches exactly: no spacing, case or whitespace forgiveness", () => {
		for (const size of [
			"145/70R12",
			"145/70 r12",
			" 145/70 R12",
			"145/70 R12 ",
			"145 / 70 R12",
			"145/70 R12\n",
		]) {
			expect(
				resolveTyreSelection("N16061", { mode: "size", size, conditionKey: "" }),
				JSON.stringify(size),
			).toEqual({
				ok: false,
				refusal: "unknown-size",
			});
		}
	});

	it("refuses a size that belongs to another code", () => {
		const other = tyreSizeProduct("N17144")!.sizes.map(([label]) => label);
		const mine = new Set(tyreSizeProduct("N16061")!.sizes.map(([label]) => label));
		const foreign = other.find((label) => !mine.has(label))!;
		expect(resolveTyreSelection("N16061", { mode: "size", size: foreign, conditionKey: "" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});

	it("refuses nothing chosen and an empty size, and a code that is not on the list", () => {
		expect(resolveTyreSelection("N16061", null)).toEqual({ ok: false, refusal: "required" });
		expect(resolveTyreSelection("N16061", undefined)).toEqual({ ok: false, refusal: "required" });
		expect(resolveTyreSelection("N16061", { mode: "size", size: "", conditionKey: "" })).toEqual({
			ok: false,
			refusal: "required",
		});
		expect(resolveTyreSelection("A7604", { mode: "code" })).toEqual({ ok: false, refusal: "unknown-size" });
		expect(resolveTyreSelection("constructor", { mode: "code" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});

	it("refuses a mode the types do not know", () => {
		expect(resolveTyreSelection("N16061", { mode: "whatever" } as never)).toEqual({
			ok: false,
			refusal: "required",
		});
	});

	describe("a size that carries a condition on the tyres", () => {
		it("asks for the condition: N16128 at 215/60 R16 is for Bridgestone Duravis Rxxx only", () => {
			expect(resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", conditionKey: "" })).toEqual({
				ok: false,
				refusal: "condition-required",
			});
		});

		it("accepts it with that very condition, and writes its direction and tyres", () => {
			const result = resolveTyreSelection("N16128", {
				mode: "size",
				size: "215/60 R16",
				conditionKey: "c01",
			});
			expect(result).toMatchObject({
				ok: true,
				selection: {
					mode: "size",
					size: "215/60 R16",
					rim: "16",
					condition: { mode: "only", tyres: ["Bridgestone Duravis Rxxx"] },
				},
			});
		});

		it("refuses another condition than the one the list attaches", () => {
			expect(
				resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", conditionKey: "c10" }),
			).toEqual({ ok: false, refusal: "condition-mismatch" });
			expect(
				resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", conditionKey: "c99" }),
			).toEqual({ ok: false, refusal: "condition-mismatch" });
		});

		it("keeps the sibling code's opposite reading: N16105 fits 215/60 R16 on any tyre but Duravis", () => {
			expect(
				resolveTyreSelection("N16105", { mode: "size", size: "215/60 R16", conditionKey: "c07" }),
			).toMatchObject({
				ok: true,
				selection: { condition: { mode: "not", tyres: ["Bridgestone Duravis Rxxx"] } },
			});
			expect(
				resolveTyreSelection("N16105", { mode: "size", size: "195/75 R16", conditionKey: "c04" }),
			).toMatchObject({
				ok: true,
				selection: { condition: { mode: "only", tyres: ["Kleber", "Michelin", "Continental"] } },
			});
		});
	});

	it("ignores a condition sent with a size that has none, and writes none", () => {
		const result = resolveTyreSelection("N16061", { mode: "size", size: "145/70 R12", conditionKey: "c01" });
		expect(result).toMatchObject({ ok: true, selection: { condition: null } });
	});

	it("accepts the customer's own statement that they know the code, and records it as nothing more", () => {
		expect(resolveTyreSelection("N16061", { mode: "code" })).toEqual({
			ok: true,
			selection: { mode: "code", listId: "snehove-retaze-20261105" },
		});
	});

	it("accepts every row of every code with its own condition, and nothing else", () => {
		// The whole list through the same check the action runs: a row the picker offers must always be accepted.
		let accepted = 0;
		for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
			for (const [size, , conditionKey] of product.sizes) {
				const result = resolveTyreSelection(code, { mode: "size", size, conditionKey });
				expect(result.ok, `${code} ${size}`).toBe(true);
				accepted += 1;
			}
		}
		expect(accepted).toBe(5324);
	});
});
