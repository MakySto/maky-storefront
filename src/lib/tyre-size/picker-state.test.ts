import { describe, expect, it } from "vitest";

import { TYRE_FIELDS } from "./fields";
import {
	initialPickerState,
	reducePicker,
	viewPicker,
	type PickerAction,
	type PickerState,
} from "./picker-state";
import { resolveTyreSelection, tyreSelectionInputFromForm } from "./selection";
import { tyrePickerData, tyreSizeIndex } from "./size-index";

const data = (code: string) => tyrePickerData(code)!;

const run = (code: string, actions: PickerAction[], from?: PickerState) =>
	actions.reduce(
		(state, action) => reducePicker(data(code), state, action),
		from ?? initialPickerState(data(code)),
	);

const formOf = (fields: Record<string, string>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};

describe("the picker's steps", () => {
	it("starts with nothing chosen, and a form the server refuses as 'nothing chosen'", () => {
		const state = initialPickerState(data("N16061"));
		const view = viewPicker(data("N16061"), state);
		expect(view.complete).toBe(false);
		expect(view.fields).toEqual({ tyreMode: "size", tyreSize: "", tyreCondition: "" });
		const input = tyreSelectionInputFromForm(formOf(view.fields));
		expect(resolveTyreSelection("N16061", input)).toEqual({ ok: false, refusal: "required" });
	});

	it("takes the rim when the code has only one, and never takes the size", () => {
		const oneRim = Object.keys(tyreSizeIndex().products).find((code) => data(code).rims.length === 1)!;
		expect(oneRim).toBeDefined();
		const state = initialPickerState(data(oneRim));
		expect(state.rim).toBe(data(oneRim).rims[0].rim);
		expect(state.size).toBe("");
		expect(viewPicker(data(oneRim), state).complete).toBe(false);
	});

	it("offers only the sizes of the chosen rim", () => {
		const state = run("N16061", [{ type: "rim", rim: "12" }]);
		const view = viewPicker(data("N16061"), state);
		expect(view.sizeOptions.length).toBeGreaterThan(0);
		// "145/70 R12", "125 R12" and the older "4.00-12" all end in the rim.
		expect(view.sizeOptions.map((s) => s.label).every((label) => label.endsWith("12"))).toBe(true);
		expect(viewPicker(data("N16061"), initialPickerState(data("N16061"))).sizeOptions).toEqual([]);
	});

	it("starts the size over when the rim changes", () => {
		const first = data("N16061").rims[0];
		const second = data("N16061").rims[1];
		const state = run("N16061", [
			{ type: "rim", rim: first.rim },
			{ type: "size", size: first.sizes[0].label },
			{ type: "rim", rim: second.rim },
		]);
		expect(state.size).toBe("");
		expect(viewPicker(data("N16061"), state).complete).toBe(false);
	});

	it("does not take a size that is not on the chosen rim, however it got there", () => {
		const [first, second] = data("N16061").rims;
		const state = run("N16061", [
			{ type: "rim", rim: first.rim },
			{ type: "size", size: second.sizes[0].label },
		]);
		expect(state.size).toBe("");
		const invented = run("N16061", [
			{ type: "rim", rim: "13" },
			{ type: "size", size: "145/70 R13" },
		]);
		expect(invented.size).toBe("");
		expect(viewPicker(data("N16061"), invented).fields.tyreSize).toBe("");
	});

	it("is complete with a listed size that has no condition, and carries it in the form", () => {
		const state = run("N16061", [
			{ type: "rim", rim: "12" },
			{ type: "size", size: "145/70 R12" },
		]);
		const view = viewPicker(data("N16061"), state);
		expect(view.complete).toBe(true);
		expect(view.condition).toBeNull();
		expect(view.fields).toEqual({ tyreMode: "size", tyreSize: "145/70 R12", tyreCondition: "" });
	});
});

describe("a size with a condition on the tyres", () => {
	const choose = [
		{ type: "rim", rim: "16" },
		{ type: "size", size: "215/60 R16" },
	] satisfies PickerAction[];

	it("shows the condition and is not complete until it is ticked", () => {
		const view = viewPicker(data("N16128"), run("N16128", choose));
		expect(view.condition).toEqual({ key: "c01", mode: "only", tyres: ["Bridgestone Duravis Rxxx"] });
		expect(view.complete).toBe(false);
		expect(view.fields.tyreCondition).toBe("");
	});

	it("is complete once ticked, and the form then carries the condition's key", () => {
		const view = viewPicker(
			data("N16128"),
			run("N16128", [...choose, { type: "acknowledge", acknowledged: true }]),
		);
		expect(view.complete).toBe(true);
		expect(view.fields).toEqual({ tyreMode: "size", tyreSize: "215/60 R16", tyreCondition: "c01" });
	});

	it("loses the tick when the size changes, so a condition is never carried over to another size", () => {
		const state = run("N16128", [
			...choose,
			{ type: "acknowledge", acknowledged: true },
			{ type: "size", size: "195/75 R16" },
		]);
		const view = viewPicker(data("N16128"), state);
		expect(state.acknowledged).toBe(false);
		expect(view.condition).toEqual({ key: "c10", mode: "not", tyres: ["Kleber", "Michelin", "Continental"] });
		expect(view.complete).toBe(false);
	});

	it("can be unticked, which withdraws the condition from the form", () => {
		const state = run("N16128", [
			...choose,
			{ type: "acknowledge", acknowledged: true },
			{ type: "acknowledge", acknowledged: false },
		]);
		expect(viewPicker(data("N16128"), state).fields.tyreCondition).toBe("");
	});

	it("shows the same size of the sibling code in the opposite direction", () => {
		const state = run("N16105", [
			{ type: "rim", rim: "16" },
			{ type: "size", size: "215/60 R16" },
		]);
		expect(viewPicker(data("N16105"), state).condition).toMatchObject({ key: "c07", mode: "not" });
	});
});

describe("a customer who knows the code", () => {
	it("is complete with no size, and the form says so", () => {
		const view = viewPicker(data("N16061"), run("N16061", [{ type: "knows-code", knowsCode: true }]));
		expect(view.complete).toBe(true);
		expect(view.fields).toEqual({ tyreMode: "code", tyreSize: "", tyreCondition: "" });
	});

	it("sends no size even if one had been chosen before", () => {
		const state = run("N16061", [
			{ type: "rim", rim: "12" },
			{ type: "size", size: "145/70 R12" },
			{ type: "knows-code", knowsCode: true },
		]);
		expect(viewPicker(data("N16061"), state).fields).toEqual({
			tyreMode: "code",
			tyreSize: "",
			tyreCondition: "",
		});
	});

	it("goes back to the choice of a size when it is withdrawn", () => {
		const state = run("N16061", [
			{ type: "knows-code", knowsCode: true },
			{ type: "knows-code", knowsCode: false },
		]);
		expect(viewPicker(data("N16061"), state).complete).toBe(false);
	});
});

describe("the form the picker builds is exactly what the server accepts", () => {
	it("names the same fields on both ends", () => {
		const view = viewPicker(data("N16061"), initialPickerState(data("N16061")));
		expect(Object.keys(view.fields).sort()).toEqual(Object.values(TYRE_FIELDS).sort());
	});

	it("for EVERY size of EVERY code: choose it, tick its condition, and the server accepts that very size", () => {
		let checked = 0;
		for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
			for (const [label, rim, conditionKey] of product.sizes) {
				const state = run(code, [
					{ type: "rim", rim },
					{ type: "size", size: label },
					{ type: "acknowledge", acknowledged: true },
				]);
				const view = viewPicker(data(code), state);
				expect(view.complete, `${code} ${label}`).toBe(true);
				const result = resolveTyreSelection(code, tyreSelectionInputFromForm(formOf(view.fields)));
				expect(result.ok, `${code} ${label}`).toBe(true);
				if (result.ok && result.selection.mode === "size") {
					expect(result.selection.size).toBe(label);
					expect(result.selection.condition !== null).toBe(conditionKey !== "");
				}
				checked += 1;
			}
		}
		expect(checked).toBe(5324);
	});

	it("an unticked condition is refused by the server as well as held back by the page", () => {
		for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
			for (const [label, rim, conditionKey] of product.sizes) {
				if (conditionKey === "") continue;
				const state = run(code, [
					{ type: "rim", rim },
					{ type: "size", size: label },
				]);
				const view = viewPicker(data(code), state);
				expect(view.complete, `${code} ${label}`).toBe(false);
				const result = resolveTyreSelection(code, tyreSelectionInputFromForm(formOf(view.fields)));
				expect(result, `${code} ${label}`).toEqual({ ok: false, refusal: "condition-required" });
			}
		}
	});
});
