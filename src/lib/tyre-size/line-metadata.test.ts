import { describe, expect, it } from "vitest";

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

const selectionOf = (code: string, size: string, conditionKey = ""): TyreSelection => {
	const result = resolveTyreSelection(code, { mode: "size", size, conditionKey });
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

	it("writes the condition's direction and tyres", () => {
		const items = tyreSelectionToMetadata(selectionOf("N16128", "195/75 R16", "c10"));
		expect(asMap(items)).toMatchObject({
			[TYRE_META.size]: "195/75 R16",
			[TYRE_META.conditionMode]: "not",
			[TYRE_META.conditionTyres]: "Kleber / Michelin / Continental",
		});
	});

	it("writes only the mode and the list for a customer who knows the code", () => {
		const items = tyreSelectionToMetadata({ mode: "code", listId: "snehove-retaze-20261105" });
		expect(asMap(items)).toEqual({ [TYRE_META.mode]: "code", [TYRE_META.list]: "snehove-retaze-20261105" });
	});

	it("is the same input for the same choice, every time", () => {
		const a = tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", "c01"));
		const b = tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", "c01"));
		expect(a).toEqual(b);
	});

	it("keeps every key and value free of anything Saleor would object to", () => {
		for (const item of tyreSelectionToMetadata(selectionOf("N16128", "215/60 R16", "c01"))) {
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
			selectionOf("N16128", "195/75 R16", "c10"),
			selectionOf("N16128", "215/60 R16", "c01"),
			{ mode: "code", listId: "snehove-retaze-20261105" } as TyreSelection,
		]) {
			const choice = tyreChoiceFromMetadata(tyreSelectionToMetadata(selection));
			expect(choice).not.toBeNull();
			expect(tyreChoiceKey(choice)).toBe(tyreSelectionKey(selection));
		}
		expect(
			tyreChoiceFromMetadata(tyreSelectionToMetadata(selectionOf("N16128", "195/75 R16", "c10"))),
		).toEqual({
			mode: "size",
			size: "195/75 R16",
			condition: { mode: "not", tyres: ["Kleber", "Michelin", "Continental"] },
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

	it("tells the same size under two different conditions apart", () => {
		// The same label may carry a different condition on two codes; on one line the pair is the choice.
		const under = (conditionKey: string) =>
			tyreSelectionKey(selectionOf("N16128", "215/60 R16", conditionKey));
		const other = tyreChoiceKey({
			mode: "size",
			size: "215/60 R16",
			condition: { mode: "not", tyres: ["Bridgestone Duravis Rxxx"] },
		});
		expect(under("c01")).not.toBe(other);
	});

	it("does not confuse a known code with a size", () => {
		expect(tyreChoiceKey({ mode: "code" })).toBe("code");
		expect(tyreChoiceKey({ mode: "code" })).not.toBe(tyreSelectionKey(selectionOf("N16061", "145/70 R12")));
	});
});
