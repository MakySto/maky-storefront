import { describe, expect, it } from "vitest";

import { NO_MATCH_ANSWER } from "./questions";
import { resolveTyreSelection } from "./selection";
import { tyreSizeProduct } from "./size-index";
import {
	TYRE_META,
	tyreChoiceFromMetadata,
	tyreChoiceKey,
	tyreSelectionKey,
	tyreSelectionToMetadata,
} from "./line-metadata";
import type { TyreSelection } from "./types";

const DUVIRAVIS = "Bridgestone Duravis Rxxx";

const selectionOf = (code: string, size: string, answer = ""): TyreSelection => {
	const result = resolveTyreSelection(code, { mode: "size", size, answer });
	if (!result.ok) throw new Error(`${code} ${size}: ${result.refusal}`);
	return result.selection;
};

const asMap = (items: readonly { key: string; value: string }[]) =>
	Object.fromEntries(items.map((i) => [i.key, i.value]));

describe("tyreSelectionToMetadata", () => {
	it("writes the size, the list it was checked against and where the sizes come from", () => {
		const items = tyreSelectionToMetadata(selectionOf("N16061", "145/70 R12"));
		expect(asMap(items)).toEqual({
			[TYRE_META.mode]: "size",
			[TYRE_META.list]: "snehove-retaze-20261105",
			[TYRE_META.size]: "145/70 R12",
			[TYRE_META.basis]: "manufacturer_list_2026_10",
		});
	});

	it("writes the condition's direction and tyres, and what the shopper said about their tyres", () => {
		const items = tyreSelectionToMetadata(selectionOf("N16128", "195/75 R16", NO_MATCH_ANSWER));
		expect(asMap(items)).toMatchObject({
			[TYRE_META.size]: "195/75 R16",
			[TYRE_META.conditionMode]: "not",
			[TYRE_META.conditionTyres]: "Kleber / Michelin / Continental",
			[TYRE_META.answer]: "other",
		});
		expect(asMap(tyreSelectionToMetadata(selectionOf("N16105", "195/75 R16", "Michelin")))).toMatchObject({
			[TYRE_META.conditionMode]: "only",
			[TYRE_META.answer]: "Michelin",
		});
	});

	it("writes no answer for a size that asked no question", () => {
		const items = asMap(tyreSelectionToMetadata(selectionOf("N16061", "145/70 R12")));
		expect(items[TYRE_META.answer]).toBeUndefined();
		expect(items[TYRE_META.conditionMode]).toBeUndefined();
	});

	it("writes only the mode and the list for a customer who knows the code", () => {
		const items = tyreSelectionToMetadata({ mode: "code", listId: "snehove-retaze-20261105" });
		expect(asMap(items)).toEqual({ [TYRE_META.mode]: "code", [TYRE_META.list]: "snehove-retaze-20261105" });
	});

	it("is the same input for the same choice, every time", () => {
		const a = tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", DUVIRAVIS));
		const b = tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", DUVIRAVIS));
		expect(a).toEqual(b);
	});

	it("keeps every key and value free of anything Saleor would object to", () => {
		for (const item of tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", DUVIRAVIS))) {
			expect(item.key).toMatch(/^[a-z][a-z0-9_]*$/);
			expect(item.value.trim()).toBe(item.value);
			expect(item.value).not.toBe("");
		}
	});
});

describe("tyreChoiceFromMetadata", () => {
	it("reads back what was written, for a size, a conditional size and a known code", () => {
		for (const selection of [
			selectionOf("N16061", "145/70 R12"),
			selectionOf("N16128", "195/75 R16", NO_MATCH_ANSWER),
			selectionOf("N16105", "195/75 R16", "Kleber"),
			selectionOf("N16128", "215/60 R16", DUVIRAVIS),
			{ mode: "code", listId: "snehove-retaze-20261105" } as TyreSelection,
		]) {
			const choice = tyreChoiceFromMetadata(tyreSelectionToMetadata(selection));
			expect(choice).not.toBeNull();
			expect(tyreChoiceKey(choice)).toBe(tyreSelectionKey(selection));
		}
		expect(
			tyreChoiceFromMetadata(tyreSelectionToMetadata(selectionOf("N16128", "195/75 R16", NO_MATCH_ANSWER))),
		).toEqual({
			mode: "size",
			size: "195/75 R16",
			condition: { mode: "not", tyres: ["Kleber", "Michelin", "Continental"], answer: "other" },
		});
	});

	it("reads a line written before the answer was recorded as it was: a condition with no answer", () => {
		const legacy = [
			{ key: TYRE_META.mode, value: "size" },
			{ key: TYRE_META.size, value: "195/75 R16" },
			{ key: TYRE_META.conditionMode, value: "only" },
			{ key: TYRE_META.conditionTyres, value: "Kleber / Michelin / Continental" },
		];
		expect(tyreChoiceFromMetadata(legacy)).toEqual({
			mode: "size",
			size: "195/75 R16",
			condition: { mode: "only", tyres: ["Kleber", "Michelin", "Continental"], answer: "" },
		});
	});

	it("reads a line with no metadata, or someone else's metadata, as no choice", () => {
		expect(tyreChoiceFromMetadata(null)).toBeNull();
		expect(tyreChoiceFromMetadata(undefined)).toBeNull();
		expect(tyreChoiceFromMetadata([])).toBeNull();
		expect(tyreChoiceFromMetadata([{ key: "gift_wrap", value: "yes" }])).toBeNull();
	});

	it("reads a half-written choice as no choice, so nothing half-true is shown", () => {
		const m = (...pairs: [string, string][]) => pairs.map(([key, value]) => ({ key, value }));
		expect(tyreChoiceFromMetadata(m([TYRE_META.mode, "size"]))).toBeNull();
		expect(tyreChoiceFromMetadata(m([TYRE_META.mode, "size"], [TYRE_META.size, ""]))).toBeNull();
		expect(tyreChoiceFromMetadata(m([TYRE_META.mode, "other"], [TYRE_META.size, "205/55 R16"]))).toBeNull();
		expect(
			tyreChoiceFromMetadata(
				m([TYRE_META.mode, "size"], [TYRE_META.size, "205/55 R16"], [TYRE_META.conditionMode, "only"]),
			),
		).toBeNull();
		expect(
			tyreChoiceFromMetadata(
				m(
					[TYRE_META.mode, "size"],
					[TYRE_META.size, "205/55 R16"],
					[TYRE_META.conditionMode, "maybe"],
					[TYRE_META.conditionTyres, "X"],
				),
			),
		).toBeNull();
	});
});

describe("tyreChoiceKey", () => {
	it("is empty for no choice and equal exactly for equal choices", () => {
		expect(tyreChoiceKey(null)).toBe("");
		const [first, second] = tyreSizeProduct("N16061")!.sizes.map(([label]) => label);
		const a = tyreSelectionKey(selectionOf("N16061", first));
		const b = tyreSelectionKey(selectionOf("N16061", first));
		const c = tyreSelectionKey(selectionOf("N16061", second));
		expect(a).toBe(b);
		expect(a).not.toBe(c);
		expect(a).not.toBe("");
	});

	it("tells the same size under two different answers apart: the line is the tyres the shopper has", () => {
		// 195/75 R16 on a Kleber and on a Michelin is one condition and two answers; a shopper who asks for one pair of each
		// has two lines, and the packer reads two answers.
		const under = (answer: string) => tyreSelectionKey(selectionOf("N16105", "195/75 R16", answer));
		expect(under("Kleber")).not.toBe(under("Michelin"));
		expect(under("Kleber")).toBe(under("Kleber"));
	});

	it("tells the same size under two different conditions apart", () => {
		// The same label may carry a different condition on two codes; on one line the pair is the choice.
		const duravis = tyreSelectionKey(selectionOf("N16128", "215/60 R16", DUVIRAVIS));
		const other = tyreChoiceKey({
			mode: "size",
			size: "215/60 R16",
			condition: { mode: "not", tyres: [DUVIRAVIS], answer: NO_MATCH_ANSWER },
		});
		expect(duravis).not.toBe(other);
	});

	it("does not confuse a known code with a size", () => {
		expect(tyreChoiceKey({ mode: "code" })).toBe("code");
		expect(tyreChoiceKey({ mode: "code" })).not.toBe(tyreSelectionKey(selectionOf("N16061", "145/70 R12")));
	});
});
