import { describe, expect, it } from "vitest";
import { codeKey, codeKeys, foldText, fuzzyGrade, searchWords, wordGrade } from "./words";

describe("how the search reads text", () => {
	it("folds case, diacritics and the letters NFD leaves alone", () => {
		expect(foldText("Strešný NOSIČ", "sk")).toBe("stresny nosic");
		expect(foldText("Łańcuchy śniegowe", "pl")).toBe("lancuchy sniegowe");
		expect(foldText("Fußsatz", "de")).toBe("fusssatz");
	});

	it("meets a German umlaut and its written-out spelling, in German only", () => {
		expect(foldText("Kühlbox", "de")).toBe(foldText("Kuehlbox", "de"));
		expect(foldText("Fahrradträger", "de-AT")).toBe(foldText("Fahrradtraeger", "de"));
		// "duet" is not "dut" in a language without the convention.
		expect(foldText("duel", "sk")).toBe("duel");
	});

	it("drops the words that say nothing and reads a measure as its number", () => {
		expect(searchWords("Nosič na bicykle pre 2 bicykle", "sk")).toEqual(["nosic", "bicykle", "2", "bicykle"]);
		expect(searchWords("Strešný box, 400 l", "sk")).toEqual(["stresny", "box", "400"]);
		expect(searchWords("autochladnicka 30l", "sk")).toEqual(["autochladnicka", "30"]);
		// German folds "ue" on both sides, inside "Quer" too: the catalogue's word and the customer's
		// become the same letters, which is all that is asked of them.
		expect(searchWords("Querträger 120cm für Golf", "de")).toEqual(["qurtrager", "120", "golf"]);
	});

	it("reads a code without its punctuation, and only when it holds a digit", () => {
		expect(codeKey("PZ-859")).toBe("pz859");
		expect(codeKey("Thule")).toBe("");
		expect(codeKeys("Montážny kit Nordrive C041 - (N21041)")).toEqual(["c041", "n21041"]);
	});
});

describe("when two words mean the same", () => {
	it.each([
		["box", "box", 1],
		["boxy", "box", 0.9],
		["dachboxen", "dachbox", 0.9],
		["kol", "kola", 0.9],
		["nosice", "nosicov", 0.9],
		["fahrrad", "fahrradtrager", 0.7],
		["kuhlbox", "autokuhlboxen", 0.6],
		["chladnicka", "autochladnicka", 0.6],
	])("%s stands for %s at %s", (asked, named, grade) => {
		expect(wordGrade(asked, named)).toBe(grade);
	});

	it.each([
		// A tail without a vowel is another word, and so is a short word with three letters more.
		["stan", "stand"],
		["dach", "dachbox"],
		// Numbers and words with a digit are themselves or nothing.
		["30", "300"],
		["fg2", "fg3"],
		["n21041", "n21050"],
		["thule", "peruzzo"],
	])("%s is not the same stem as %s", (asked, named) => {
		expect(wordGrade(asked, named)).toBeLessThan(0.9);
	});

	it("never grades a number or a code loosely", () => {
		expect(wordGrade("30", "300")).toBe(0);
		expect(wordGrade("n21041", "n21050")).toBe(0);
		expect(fuzzyGrade("2019", "2018")).toBe(0);
	});

	it("forgives one letter in a word of four to seven, two in a longer one, and nothing shorter", () => {
		expect(fuzzyGrade("tule", "thule")).toBeGreaterThan(0);
		expect(fuzzyGrade("octvia", "octavia")).toBeGreaterThan(0);
		expect(fuzzyGrade("fahradtrager", "fahrradtrager")).toBeGreaterThan(0);
		expect(fuzzyGrade("box", "bob")).toBe(0);
		expect(fuzzyGrade("thule", "table")).toBe(0);
	});
});
