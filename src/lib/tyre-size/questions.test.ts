import { describe, expect, it } from "vitest";

import { answerFits, isAnswerTo, NO_MATCH_ANSWER, tyreQuestionKey, tyreQuestionOf } from "./questions";
import { tyreSizeIndex } from "./size-index";

const only = (...tyres: string[]) => ({ mode: "only", tyres }) as const;
const not = (...tyres: string[]) => ({ mode: "not", tyres }) as const;

describe("the question a condition asks", () => {
	it("is one question for the 'only' and the 'not' form of the same tyres, whatever the order", () => {
		const kleber = ["Kleber", "Michelin", "Continental"];
		expect(tyreQuestionKey(kleber)).toBe("Continental|Kleber|Michelin");
		expect(tyreQuestionOf(only(...kleber)).key).toBe(
			tyreQuestionOf(not("Continental", "Michelin", "Kleber")).key,
		);
		expect(tyreQuestionKey(["Michelin"])).not.toBe(tyreQuestionKey(["Michelin Alpin"]));
	});

	it("asks for the make when the list names makes, for the model when it names models", () => {
		expect(tyreQuestionOf(only("Kleber", "Michelin", "Continental")).subject).toBe("make");
		expect(tyreQuestionOf(not("Continental", "Goodyear")).subject).toBe("make");
		expect(tyreQuestionOf(only("Bridgestone Duravis Rxxx")).subject).toBe("model");
		expect(tyreQuestionOf(not("Michelin Alpin")).subject).toBe("model");
		expect(tyreQuestionOf(only("Nokian TRI-2")).subject).toBe("model");
	});

	it("offers exactly the tyres the list names, in the list's own order, and does not share them", () => {
		const condition = only("Kleber", "Michelin", "Continental");
		const question = tyreQuestionOf(condition);
		expect(question.options).toEqual(["Kleber", "Michelin", "Continental"]);
		expect(question.options).not.toBe(condition.tyres);
	});

	it("is the same eight questions the sixteen conditions of the list make, each with both readings", () => {
		const groups = new Map<string, Set<string>>();
		for (const condition of Object.values(tyreSizeIndex().conditions)) {
			const key = tyreQuestionOf(condition).key;
			groups.set(key, (groups.get(key) ?? new Set()).add(condition.mode));
		}
		expect(groups.size).toBe(8);
		for (const [key, modes] of groups) expect([...modes].sort(), key).toEqual(["not", "only"]);
	});
});

describe("what counts as an answer", () => {
	const question = tyreQuestionOf(only("Kleber", "Michelin", "Continental"));

	it("is one of the options, spelled as the list spells it, or 'none of them'", () => {
		expect(isAnswerTo(question, "Michelin")).toBe(true);
		expect(isAnswerTo(question, NO_MATCH_ANSWER)).toBe(true);
		expect(isAnswerTo(question, "michelin")).toBe(false);
		expect(isAnswerTo(question, " Michelin")).toBe(false);
		expect(isAnswerTo(question, "Pirelli")).toBe(false);
		expect(isAnswerTo(question, "")).toBe(false);
		for (const value of [undefined, null, 1, true, {}, ["Michelin"]])
			expect(isAnswerTo(question, value)).toBe(false);
	});
});

describe("whether a condition holds for an answer", () => {
	it("holds an 'only' condition for one of its tyres, and not for the others", () => {
		const condition = only("Kleber", "Michelin", "Continental");
		expect(answerFits(condition, "Kleber")).toBe(true);
		expect(answerFits(condition, "Continental")).toBe(true);
		expect(answerFits(condition, NO_MATCH_ANSWER)).toBe(false);
	});

	it("holds a 'not' condition for 'none of them', and for none of its tyres", () => {
		const condition = not("Kleber", "Michelin", "Continental");
		expect(answerFits(condition, NO_MATCH_ANSWER)).toBe(true);
		expect(answerFits(condition, "Michelin")).toBe(false);
	});

	it("holds neither reading for something that is not an answer", () => {
		for (const value of ["Pirelli", "", "OTHER", undefined, null, 0]) {
			expect(answerFits(only("Kleber", "Michelin", "Continental"), value), String(value)).toBe(false);
			expect(answerFits(not("Kleber", "Michelin", "Continental"), value), String(value)).toBe(false);
		}
	});

	it("gives exactly one of the two readings to every possible answer", () => {
		// Whatever the shopper has, one of the two codes of a pair fits and the other does not: never both, never neither.
		const { conditions } = tyreSizeIndex();
		const byKey = new Map<
			string,
			{ only?: (typeof conditions)[string]; not?: (typeof conditions)[string] }
		>();
		for (const condition of Object.values(conditions)) {
			const pair = byKey.get(tyreQuestionOf(condition).key) ?? {};
			pair[condition.mode] = condition;
			byKey.set(tyreQuestionOf(condition).key, pair);
		}
		for (const [key, pair] of byKey) {
			for (const answer of [...pair.only!.tyres, NO_MATCH_ANSWER]) {
				expect(answerFits(pair.only!, answer) !== answerFits(pair.not!, answer), `${key} / ${answer}`).toBe(
					true,
				);
			}
		}
	});
});
