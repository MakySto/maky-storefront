import { describe, expect, it } from "vitest";

import { NO_MATCH_ANSWER } from "./questions";
import { resolveTyreSelection, TYRE_FIELDS, tyreSelectionInputFromForm } from "./selection";
import { tyreSizeIndex, tyreSizeProduct } from "./size-index";

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe("tyreSelectionInputFromForm", () => {
	it("reads the three fields the page sends", () => {
		expect(
			tyreSelectionInputFromForm(
				form({
					[TYRE_FIELDS.mode]: "size",
					[TYRE_FIELDS.size]: "205/55 R16",
					[TYRE_FIELDS.answer]: "Bridgestone Duravis Rxxx",
				}),
			),
		).toEqual({ mode: "size", size: "205/55 R16", answer: "Bridgestone Duravis Rxxx" });
		expect(tyreSelectionInputFromForm(form({ [TYRE_FIELDS.mode]: "code" }))).toEqual({ mode: "code" });
	});

	it("keeps the field names the page and the action agree on", () => {
		expect(TYRE_FIELDS).toEqual({ mode: "tyreMode", size: "tyreSize", answer: "tyreAnswer" });
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
		expect(tyreSelectionInputFromForm(data)).toEqual({ mode: "size", size: "", answer: "" });
	});
});

describe("resolveTyreSelection", () => {
	it("accepts a size of the code and records the rim and the list it was checked against", () => {
		const result = resolveTyreSelection("N16061", { mode: "size", size: "145/70 R12", answer: "" });
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
		expect(resolveTyreSelection("N16061", { mode: "size", size: "145/70 R13", answer: "" })).toEqual({
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
				resolveTyreSelection("N16061", { mode: "size", size, answer: "" }),
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
		expect(resolveTyreSelection("N16061", { mode: "size", size: foreign, answer: "" })).toEqual({
			ok: false,
			refusal: "unknown-size",
		});
	});

	it("refuses nothing chosen and an empty size, and a code that is not on the list", () => {
		expect(resolveTyreSelection("N16061", null)).toEqual({ ok: false, refusal: "required" });
		expect(resolveTyreSelection("N16061", undefined)).toEqual({ ok: false, refusal: "required" });
		expect(resolveTyreSelection("N16061", { mode: "size", size: "", answer: "" })).toEqual({
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
		it("asks for the answer: N16128 at 215/60 R16 is for Bridgestone Duravis Rxxx only", () => {
			expect(resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", answer: "" })).toEqual({
				ok: false,
				refusal: "condition-required",
			});
		});

		it("accepts it with the tyre the list names, and writes its direction, its tyres and the answer", () => {
			const result = resolveTyreSelection("N16128", {
				mode: "size",
				size: "215/60 R16",
				answer: "Bridgestone Duravis Rxxx",
			});
			expect(result).toMatchObject({
				ok: true,
				selection: {
					mode: "size",
					size: "215/60 R16",
					rim: "16",
					condition: {
						mode: "only",
						tyres: ["Bridgestone Duravis Rxxx"],
						answer: "Bridgestone Duravis Rxxx",
					},
				},
			});
		});

		it("refuses the answer that makes the condition false, and one that is no option of the question", () => {
			// N16128 is the Duravis-only code: "other tyres" rules it out, and so does a tyre the list does not name.
			expect(
				resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", answer: NO_MATCH_ANSWER }),
			).toEqual({ ok: false, refusal: "condition-mismatch" });
			expect(resolveTyreSelection("N16128", { mode: "size", size: "215/60 R16", answer: "Pirelli" })).toEqual(
				{
					ok: false,
					refusal: "condition-mismatch",
				},
			);
			expect(
				resolveTyreSelection("N16128", {
					mode: "size",
					size: "215/60 R16",
					answer: "bridgestone duravis rxxx",
				}),
			).toEqual({ ok: false, refusal: "condition-mismatch" });
		});

		it("keeps the sibling code's opposite reading: N16105 fits 215/60 R16 on any tyre but Duravis", () => {
			expect(
				resolveTyreSelection("N16105", { mode: "size", size: "215/60 R16", answer: NO_MATCH_ANSWER }),
			).toMatchObject({
				ok: true,
				selection: {
					condition: { mode: "not", tyres: ["Bridgestone Duravis Rxxx"], answer: NO_MATCH_ANSWER },
				},
			});
			expect(
				resolveTyreSelection("N16105", {
					mode: "size",
					size: "215/60 R16",
					answer: "Bridgestone Duravis Rxxx",
				}),
			).toEqual({ ok: false, refusal: "condition-mismatch" });
		});

		it("splits 195/75 R16 between the two codes by the tyre: Michelin takes N16105, any other tyre N16128", () => {
			const michelin = { mode: "size", size: "195/75 R16", answer: "Michelin" } as const;
			const other = { mode: "size", size: "195/75 R16", answer: NO_MATCH_ANSWER } as const;
			expect(resolveTyreSelection("N16105", michelin)).toMatchObject({
				ok: true,
				selection: {
					condition: { mode: "only", tyres: ["Kleber", "Michelin", "Continental"], answer: "Michelin" },
				},
			});
			expect(resolveTyreSelection("N16105", other)).toEqual({ ok: false, refusal: "condition-mismatch" });
			expect(resolveTyreSelection("N16128", other)).toMatchObject({
				ok: true,
				selection: {
					condition: { mode: "not", tyres: ["Kleber", "Michelin", "Continental"], answer: NO_MATCH_ANSWER },
				},
			});
			expect(resolveTyreSelection("N16128", michelin)).toEqual({ ok: false, refusal: "condition-mismatch" });
		});
	});

	it("ignores an answer sent with a size that has no condition, and writes none", () => {
		const result = resolveTyreSelection("N16061", { mode: "size", size: "145/70 R12", answer: "Michelin" });
		expect(result).toMatchObject({ ok: true, selection: { condition: null } });
	});

	it("accepts the customer's own statement that they know the code, and records it as nothing more", () => {
		expect(resolveTyreSelection("N16061", { mode: "code" })).toEqual({
			ok: true,
			selection: { mode: "code", listId: "snehove-retaze-20261105" },
		});
	});

	it("accepts every row of every code with the answer that meets its condition, and only that one", () => {
		// The whole list through the same check the action runs: a row the page offers must always be accepted, the
		// opposite answer must always be refused, and no answer at all must always be asked for.
		const { conditions, products } = tyreSizeIndex();
		let accepted = 0;
		let conditional = 0;
		for (const [code, product] of Object.entries(products)) {
			for (const [size, , conditionKey] of product.sizes) {
				if (conditionKey === "") {
					expect(resolveTyreSelection(code, { mode: "size", size, answer: "" }).ok, `${code} ${size}`).toBe(
						true,
					);
					accepted += 1;
					continue;
				}
				const condition = conditions[conditionKey];
				const meets = condition.mode === "only" ? condition.tyres[0] : NO_MATCH_ANSWER;
				const breaks = condition.mode === "only" ? NO_MATCH_ANSWER : condition.tyres[0];
				expect(resolveTyreSelection(code, { mode: "size", size, answer: meets }).ok, `${code} ${size}`).toBe(
					true,
				);
				expect(resolveTyreSelection(code, { mode: "size", size, answer: breaks }), `${code} ${size}`).toEqual(
					{
						ok: false,
						refusal: "condition-mismatch",
					},
				);
				expect(resolveTyreSelection(code, { mode: "size", size, answer: "" }), `${code} ${size}`).toEqual({
					ok: false,
					refusal: "condition-required",
				});
				accepted += 1;
				conditional += 1;
			}
		}
		expect(accepted).toBe(5324);
		expect(conditional).toBeGreaterThan(0);
	});
});
