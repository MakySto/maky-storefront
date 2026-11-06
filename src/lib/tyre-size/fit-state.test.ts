import { describe, expect, it } from "vitest";

import { TYRE_FIELDS } from "./fields";
import { tyreFitState, type TyreFitView } from "./fit-state";
import { resolveTyreSelection, tyreSelectionInputFromForm } from "./selection";
import { tyreSizeIndex } from "./size-index";
import { tyreFit } from "./size-lookup";

const formOf = (fields: Record<string, string>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};

/** What the product page does for one code: the server's verdict for the remembered size, drawn by `tyreFitState`. */
const viewOf = (code: string, size: string | null): TyreFitView =>
	size === null ? { kind: "no-size" } : tyreFit(code, size)!;
const serverSays = (code: string, fields: Record<string, string>) =>
	resolveTyreSelection(code, tyreSelectionInputFromForm(formOf(fields)));

describe("no size yet", () => {
	it("holds the buy button and the form says 'nothing chosen', which the server refuses as such", () => {
		const state = tyreFitState({ kind: "no-size" }, { acknowledged: false, knowsCode: false });
		expect(state).toEqual({
			complete: false,
			reason: "choose",
			fields: { tyreMode: "size", tyreSize: "", tyreCondition: "" },
		});
		expect(serverSays("N16061", state.fields)).toEqual({ ok: false, refusal: "required" });
	});

	it("lets a shopper who knows the code buy without a size, and the form says exactly that", () => {
		const state = tyreFitState({ kind: "no-size" }, { acknowledged: false, knowsCode: true });
		expect(state.complete).toBe(true);
		expect(state.reason).toBeNull();
		expect(state.fields).toEqual({ tyreMode: "code", tyreSize: "", tyreCondition: "" });
		expect(serverSays("N16061", state.fields)).toMatchObject({ ok: true, selection: { mode: "code" } });
	});
});

describe("a size that fits", () => {
	it("is complete, and the form carries that very size", () => {
		const view = viewOf("N16061", "145/70 R12");
		expect(view.kind).toBe("fits");
		const state = tyreFitState(view, { acknowledged: false, knowsCode: false });
		expect(state.complete).toBe(true);
		expect(state.fields).toEqual({ tyreMode: "size", tyreSize: "145/70 R12", tyreCondition: "" });
	});

	it("does not let 'I know the code' overrule a size the list has spoken about", () => {
		const fits = tyreFitState(viewOf("N16061", "145/70 R12"), { acknowledged: false, knowsCode: true });
		expect(fits.fields.tyreMode).toBe("size");
		const noFit = tyreFitState(viewOf("N16061", "205/55 R22"), { acknowledged: false, knowsCode: true });
		expect(noFit.complete).toBe(false);
		expect(noFit.fields.tyreMode).toBe("size");
	});
});

describe("a size that fits only under a condition", () => {
	const view = () => viewOf("N16128", "215/60 R16");

	it("is held back until the condition is ticked, and the form then carries the condition's key", () => {
		expect(view()).toMatchObject({ kind: "fits", condition: { key: "c01", mode: "only" } });
		const before = tyreFitState(view(), { acknowledged: false, knowsCode: false });
		expect(before.complete).toBe(false);
		expect(before.reason).toBe("confirm");
		expect(before.fields).toEqual({ tyreMode: "size", tyreSize: "215/60 R16", tyreCondition: "" });

		const after = tyreFitState(view(), { acknowledged: true, knowsCode: false });
		expect(after.complete).toBe(true);
		expect(after.reason).toBeNull();
		expect(after.fields).toEqual({ tyreMode: "size", tyreSize: "215/60 R16", tyreCondition: "c01" });
	});

	it("withdraws the condition from the form when it is unticked", () => {
		const state = tyreFitState(view(), { acknowledged: false, knowsCode: false });
		expect(state.fields.tyreCondition).toBe("");
	});
});

describe("a size the product does not fit", () => {
	it("holds the button for good: the page says so, and sends no size the server would refuse", () => {
		const view = viewOf("N16061", "205/55 R22");
		expect(view).toEqual({ kind: "no-fit", size: "205/55 R22" });
		const state = tyreFitState(view, { acknowledged: true, knowsCode: false });
		expect(state.complete).toBe(false);
		expect(state.reason).toBe("no-fit");
		expect(state.fields).toEqual({ tyreMode: "size", tyreSize: "", tyreCondition: "" });
		expect(serverSays("N16061", state.fields)).toEqual({ ok: false, refusal: "required" });
	});

	it("is what the server says about the size too, whenever somebody sends it anyway", () => {
		expect(serverSays("N16061", { tyreMode: "size", tyreSize: "205/55 R22", tyreCondition: "" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});
});

describe("the form the page builds is exactly what the server accepts", () => {
	it("names the same fields on both ends", () => {
		const state = tyreFitState({ kind: "no-size" }, { acknowledged: false, knowsCode: false });
		expect(Object.keys(state.fields).sort()).toEqual(Object.values(TYRE_FIELDS).sort());
	});

	it("for EVERY size of EVERY code: the verdict is 'fits', the tick completes it, and the server accepts that very size", () => {
		let checked = 0;
		for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
			for (const [label, , conditionKey] of product.sizes) {
				const view = viewOf(code, label);
				expect(view.kind, `${code} ${label}`).toBe("fits");
				const state = tyreFitState(view, { acknowledged: true, knowsCode: false });
				expect(state.complete, `${code} ${label}`).toBe(true);
				const result = serverSays(code, state.fields);
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
			for (const [label, , conditionKey] of product.sizes) {
				if (conditionKey === "") continue;
				const state = tyreFitState(viewOf(code, label), { acknowledged: false, knowsCode: false });
				expect(state.complete, `${code} ${label}`).toBe(false);
				expect(serverSays(code, state.fields), `${code} ${label}`).toEqual({
					ok: false,
					refusal: "condition-required",
				});
			}
		}
	});

	it("a size of ANOTHER code is a 'no-fit' here, and the page never sends it", () => {
		const entries = Object.entries(tyreSizeIndex().products);
		const [codeA, productA] = entries[0]!;
		const own = new Set(productA.sizes.map(([label]) => label));
		const foreign = entries
			.flatMap(([, product]) => product.sizes.map(([label]) => label))
			.find((label) => !own.has(label));
		expect(foreign).toBeDefined();
		const view = viewOf(codeA, foreign!);
		expect(view.kind).toBe("no-fit");
		const state = tyreFitState(view, { acknowledged: true, knowsCode: false });
		expect(state.complete).toBe(false);
		expect(state.fields.tyreSize).toBe("");
	});
});
