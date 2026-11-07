import "server-only";

import { TYRE_FIELDS } from "./fields";
import { answerFits, isAnswerTo, tyreQuestionOf } from "./questions";
import { TYRE_SIZE_LIST_ID, tyreSizeIndex, tyreSizeProduct } from "./size-index";
import type { TyreRefusal, TyreSelection, TyreSelectionInput } from "./types";

export { TYRE_FIELDS };

type FormLike = { get(name: string): FormDataEntryValue | null };

const text = (value: FormDataEntryValue | null): string => (typeof value === "string" ? value : "");

/**
 * Read the choice from a submitted form. `null` is "the form says nothing about a tyre choice", which for a
 * size-controlled code is a refusal (`required`), never a default.
 */
export function tyreSelectionInputFromForm(form: FormLike): TyreSelectionInput | null {
	const mode = text(form.get(TYRE_FIELDS.mode));
	if (mode === "code") return { mode: "code" };
	if (mode === "size") {
		return {
			mode: "size",
			size: text(form.get(TYRE_FIELDS.size)),
			answer: text(form.get(TYRE_FIELDS.answer)),
		};
	}
	return null;
}

export type TyreSelectionResult =
	| { readonly ok: true; readonly selection: TyreSelection }
	| { readonly ok: false; readonly refusal: TyreRefusal };

/**
 * Check a choice against the list of one code.
 *
 * Exact match only. The size must be a label of this code, character for character: "205/55R16" is not
 * "205/55 R16", and a size that belongs to another code is not this code's. A size with a condition on the tyres
 * (only on these, or not on these) is accepted only with an ANSWER to that condition's question that the condition
 * allows: "Michelin" for "only Kleber / Michelin / Continental", "other" for "not Kleber / Michelin / Continental".
 * The condition cannot be skipped by omitting the answer, nor met by an answer that is not one of the question's
 * options. A size without a condition ignores whatever answer the form carried.
 *
 * `mode: "code"` is the customer's own statement that this code is the one they need. It is accepted, and
 * recorded as exactly that: the shop does not say the code fits their tyres.
 */
export function resolveTyreSelection(
	code: string,
	input: TyreSelectionInput | null | undefined,
): TyreSelectionResult {
	const product = tyreSizeProduct(code);
	if (!product) return { ok: false, refusal: "unknown-size" };
	if (!input) return { ok: false, refusal: "required" };

	if (input.mode === "code") return { ok: true, selection: { mode: "code", listId: TYRE_SIZE_LIST_ID } };

	if (input.mode !== "size" || input.size === "") return { ok: false, refusal: "required" };

	const row = product.sizes.find(([label]) => label === input.size);
	if (!row) return { ok: false, refusal: "unknown-size" };

	const [size, rim, conditionKey] = row;
	let condition: { mode: "only" | "not"; tyres: readonly string[]; answer: string } | null = null;
	if (conditionKey !== "") {
		const listed = tyreSizeIndex().conditions[conditionKey];
		if (input.answer === "") return { ok: false, refusal: "condition-required" };
		if (!isAnswerTo(tyreQuestionOf(listed), input.answer) || !answerFits(listed, input.answer)) {
			return { ok: false, refusal: "condition-mismatch" };
		}
		condition = { mode: listed.mode, tyres: [...listed.tyres], answer: input.answer };
	}

	return {
		ok: true,
		selection: { mode: "size", size, rim, condition, basis: product.source, listId: TYRE_SIZE_LIST_ID },
	};
}
