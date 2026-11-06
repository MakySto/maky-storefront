import "server-only";

import { TYRE_FIELDS } from "./fields";
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
			conditionKey: text(form.get(TYRE_FIELDS.condition)),
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
 * Exact match only. The size must be a label of this code, character for character, as the picker offered it:
 * "205/55R16" is not "205/55 R16", and a size that belongs to another code is not this code's. A size with a
 * condition (only on these tyres, or not on these) is accepted only together with the key of that very condition,
 * which the picker sends after the customer ticked it; a condition cannot be skipped by omitting it, nor
 * swapped for a different one. A size without a condition ignores whatever condition the form carried.
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
	let condition: { mode: "only" | "not"; tyres: readonly string[] } | null = null;
	if (conditionKey !== "") {
		if (input.conditionKey === "") return { ok: false, refusal: "condition-required" };
		if (input.conditionKey !== conditionKey) return { ok: false, refusal: "condition-mismatch" };
		const listed = tyreSizeIndex().conditions[conditionKey];
		condition = { mode: listed.mode, tyres: [...listed.tyres] };
	}

	return {
		ok: true,
		selection: { mode: "size", size, rim, condition, basis: product.source, listId: TYRE_SIZE_LIST_ID },
	};
}
