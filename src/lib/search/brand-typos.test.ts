import { describe, expect, it } from "vitest";
import { correctBrandTypos } from "./brand-typos";

describe("correctBrandTypos", () => {
	it.each([
		["tule", "thule"],
		["Tuhle", "thule"],
		["thuel", "thule"],
		["jakima", "yakima"],
		["menaboo", "menabo"],
		["nordrajve", "nordrive"],
		["tule box", "thule box"],
		["strešný tule", "strešný thule"],
	])("reads %s as %s", (typed, corrected) => {
		expect(correctBrandTypos(typed)).toBe(corrected);
	});

	it.each(["thule", "Yakima", "strecha", "box", "mena", "nosič bicyklov", "stresny box", ""])(
		"leaves %s alone",
		(typed) => {
			expect(correctBrandTypos(typed)).toBeNull();
		},
	);
});
