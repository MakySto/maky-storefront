import { describe, expect, it } from "vitest";

import { tyreViewOf, type TyreAnswers } from "./choice";
import { TYRE_FIELDS } from "./fields";
import { tyreFitState, type TyreFitView } from "./fit-state";
import { NO_MATCH_ANSWER, tyreQuestionOf } from "./questions";
import { resolveTyreSelection, tyreSelectionInputFromForm } from "./selection";
import { tyreSizeIndex } from "./size-index";

const formOf = (fields: Record<string, string>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};

/** What the product page does for one code: the server's verdict for the remembered tyres, drawn by `tyreFitState`. */
const viewOf = (code: string, size: string | null, answers: TyreAnswers = {}): TyreFitView =>
	tyreViewOf(code, size, answers)!;
const serverSays = (code: string, fields: Record<string, string>) =>
	resolveTyreSelection(code, tyreSelectionInputFromForm(formOf(fields)));

const DUV = "Bridgestone Duravis Rxxx";
const MAKE_KEY = "Continental|Kleber|Michelin";
const NOTHING = { tyreMode: "size", tyreSize: "", tyreAnswer: "" };

describe("no size yet", () => {
	it("holds the buy button and the form says 'nothing chosen', which the server refuses as such", () => {
		const state = tyreFitState({ kind: "no-size" }, { knowsCode: false });
		expect(state).toEqual({ complete: false, reason: "choose", fields: NOTHING });
		expect(serverSays("N16061", state.fields)).toEqual({ ok: false, refusal: "required" });
	});

	it("lets a shopper who knows the code buy without a size, and the form says exactly that", () => {
		const state = tyreFitState({ kind: "no-size" }, { knowsCode: true });
		expect(state.complete).toBe(true);
		expect(state.reason).toBeNull();
		expect(state.fields).toEqual({ tyreMode: "code", tyreSize: "", tyreAnswer: "" });
		expect(serverSays("N16061", state.fields)).toMatchObject({ ok: true, selection: { mode: "code" } });
	});
});

describe("a size the shop cannot verify", () => {
	const view: TyreFitView = { kind: "unlisted", size: "205/40 R21" };

	it("holds the button and sends the shopper to the people who can verify it", () => {
		const state = tyreFitState(view, { knowsCode: false });
		expect(state).toEqual({ complete: false, reason: "contact", fields: NOTHING });
	});

	it("lets the shopper who says they know the code buy it, as they would with no size at all", () => {
		const state = tyreFitState(view, { knowsCode: true });
		expect(state.complete).toBe(true);
		expect(state.fields.tyreMode).toBe("code");
		expect(serverSays("N16061", state.fields)).toMatchObject({ ok: true, selection: { mode: "code" } });
	});
});

describe("a size that fits", () => {
	it("is complete, and the form carries that very size", () => {
		const view = viewOf("N16061", "145/70 R12");
		expect(view.kind).toBe("fits");
		const state = tyreFitState(view, { knowsCode: false });
		expect(state.complete).toBe(true);
		expect(state.fields).toEqual({ tyreMode: "size", tyreSize: "145/70 R12", tyreAnswer: "" });
	});

	it("does not let 'I know the code' overrule a size the list has spoken about", () => {
		const fits = tyreFitState(viewOf("N16061", "145/70 R12"), { knowsCode: true });
		expect(fits.fields.tyreMode).toBe("size");
		const noFit = tyreFitState(viewOf("N16061", "195/75 R16"), { knowsCode: true });
		expect(noFit.complete).toBe(false);
		expect(noFit.fields.tyreMode).toBe("size");
	});
});

describe("a size that fits only on some tyres", () => {
	it("is held back until the shopper has said which tyres they have: the page asks, it does not tick for them", () => {
		const view = viewOf("N16128", "215/60 R16");
		expect(view.kind).toBe("ask");
		const state = tyreFitState(view, { knowsCode: false });
		expect(state).toEqual({ complete: false, reason: "ask", fields: NOTHING });
		// "I know the code" does not skip the question once the shop has a size to ask about.
		expect(tyreFitState(view, { knowsCode: true })).toEqual(state);
	});

	it("is complete once the answer makes the code the right one, and the form carries the answer", () => {
		const state = tyreFitState(viewOf("N16128", "215/60 R16", { [DUV]: DUV }), { knowsCode: false });
		expect(state.complete).toBe(true);
		expect(state.fields).toEqual({ tyreMode: "size", tyreSize: "215/60 R16", tyreAnswer: DUV });
		expect(serverSays("N16128", state.fields)).toMatchObject({
			ok: true,
			selection: { size: "215/60 R16", condition: { mode: "only", answer: DUV } },
		});
	});

	it("sends the shopper to the other code of the model when the answer makes this one the wrong one and the shop sells it", () => {
		const view = viewOf("N16128", "215/60 R16", { [DUV]: NO_MATCH_ANSWER });
		expect(view.kind).toBe("other");
		if (view.kind !== "other") return;
		const sold: TyreFitView = {
			...view,
			alternatives: view.alternatives.map((alternative) => ({
				...alternative,
				href: "/sk/snehove-retaze/x",
			})),
		};
		expect(tyreFitState(sold, { knowsCode: false })).toEqual({
			complete: false,
			reason: "other",
			fields: NOTHING,
		});
	});

	it("sends the shopper to the list of what the shop does sell for the size when it does not sell the right code", () => {
		const view = viewOf("N16128", "215/60 R16", { [DUV]: NO_MATCH_ANSWER });
		expect(view).toMatchObject({ kind: "other", elsewhere: true });
		expect(tyreFitState(view, { knowsCode: false })).toEqual({
			complete: false,
			reason: "find",
			fields: NOTHING,
		});
	});

	it("sends the shopper to the people when the shop sells nothing for the size at all", () => {
		const view = viewOf("N16128", "215/60 R16", { [DUV]: NO_MATCH_ANSWER });
		if (view.kind !== "other") throw new Error("expected another code of the model");
		const state = tyreFitState({ ...view, elsewhere: false }, { knowsCode: false });
		expect(state).toEqual({ complete: false, reason: "contact", fields: NOTHING });
	});

	it("is what the server says too: the same size without an answer, or with the wrong one, is refused", () => {
		expect(serverSays("N16128", { tyreMode: "size", tyreSize: "215/60 R16", tyreAnswer: "" })).toEqual({
			ok: false,
			refusal: "condition-required",
		});
		expect(
			serverSays("N16128", { tyreMode: "size", tyreSize: "215/60 R16", tyreAnswer: NO_MATCH_ANSWER }),
		).toEqual({
			ok: false,
			refusal: "condition-mismatch",
		});
	});
});

describe("a size the product does not fit", () => {
	it("holds the button for good: the page says so, and sends no size the server would refuse", () => {
		const view = viewOf("N16061", "195/75 R16");
		expect(view).toEqual({ kind: "no-fit", size: "195/75 R16", elsewhere: true });
		const state = tyreFitState(view, { knowsCode: false });
		expect(state).toEqual({ complete: false, reason: "find", fields: NOTHING });
		expect(serverSays("N16061", state.fields)).toEqual({ ok: false, refusal: "required" });
	});

	it("goes to the people who can help when nothing in the shop fits the size", () => {
		const state = tyreFitState(
			{ kind: "no-fit", size: "270/75 R15", elsewhere: false },
			{ knowsCode: false },
		);
		expect(state.reason).toBe("contact");
		expect(state.complete).toBe(false);
	});

	it("is what the server says about the size too, whenever somebody sends it anyway", () => {
		expect(serverSays("N16061", { tyreMode: "size", tyreSize: "195/75 R16", tyreAnswer: "" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});
});

describe("the form the page builds is exactly what the server accepts", () => {
	it("names the same fields on both ends", () => {
		const state = tyreFitState({ kind: "no-size" }, { knowsCode: false });
		expect(Object.keys(state.fields).sort()).toEqual(Object.values(TYRE_FIELDS).sort());
	});

	it("for EVERY size of EVERY code, once the question is answered the way that fits: the page is complete and the server accepts that very choice", () => {
		const { conditions, products } = tyreSizeIndex();
		let checked = 0;
		for (const [code, product] of Object.entries(products)) {
			for (const [label, , conditionKey] of product.sizes) {
				let answers: TyreAnswers = {};
				if (conditionKey !== "") {
					const condition = conditions[conditionKey];
					const question = tyreQuestionOf(condition);
					answers = { [question.key]: condition.mode === "only" ? condition.tyres[0] : NO_MATCH_ANSWER };
				}
				const view = viewOf(code, label, answers);
				expect(view.kind, `${code} ${label}`).toBe("fits");
				const state = tyreFitState(view, { knowsCode: false });
				expect(state.complete, `${code} ${label}`).toBe(true);
				const result = serverSays(code, state.fields);
				expect(result.ok, `${code} ${label}`).toBe(true);
				if (result.ok && result.selection.mode === "size") {
					expect(result.selection.size).toBe(label);
					expect(result.selection.condition !== null).toBe(conditionKey !== "");
					expect(result.selection.condition?.answer ?? "").toBe(Object.values(answers)[0] ?? "");
				}
				checked += 1;
			}
		}
		expect(checked).toBe(5324);
	});

	it("for EVERY conditional size, until it is answered the page asks and holds, and the server would hold it too", () => {
		for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
			for (const [label, , conditionKey] of product.sizes) {
				if (conditionKey === "") continue;
				const state = tyreFitState(viewOf(code, label), { knowsCode: false });
				expect(state.complete, `${code} ${label}`).toBe(false);
				expect(state.reason, `${code} ${label}`).toBe("ask");
				expect(
					serverSays(code, { tyreMode: "size", tyreSize: label, tyreAnswer: "" }),
					`${code} ${label}`,
				).toEqual({ ok: false, refusal: "condition-required" });
			}
		}
	});

	it("a size of ANOTHER code is never sent: the page holds and the form carries no size", () => {
		const view = viewOf("N16061", "195/75 R16", { [MAKE_KEY]: "Michelin" });
		expect(view.kind).toBe("no-fit");
		const state = tyreFitState(view, { knowsCode: true });
		expect(state.complete).toBe(false);
		expect(state.fields.tyreSize).toBe("");
		expect(state.fields.tyreAnswer).toBe("");
	});
});
