import { describe, expect, it } from "vitest";

import { KEEP_TOGETHER_MAX_LENGTH, keepTogetherParts } from "./keep-together";

const kept = (text: string) =>
	keepTogetherParts(text)
		.filter((part) => part.keep)
		.map((part) => part.text);

describe("keepTogetherParts", () => {
	it("gives the text back unchanged when its parts are joined", () => {
		for (const text of [
			"Strešný nosič Menabo Delta Mazda CX-60 KH (2022–) — hladká strecha",
			"Dachträger Nordrive Quadra Black Evos LP Mazda CX-60 KH (2022–) — Normaldach",
			"  dve  medzery a\ttabulátor ",
			"",
			"Thule",
		]) {
			expect(
				keepTogetherParts(text)
					.map((part) => part.text)
					.join(""),
			).toBe(text);
		}
	});

	it("keeps a model designation on one line", () => {
		// The name that wrapped as "Mazda CX-" / "60 KH" on the live product page.
		expect(kept("Strešný nosič Menabo Delta Mazda CX-60 KH (2022–)")).toEqual(["CX-60"]);
		expect(kept("Volkswagen T-Roc")).toEqual(["T-Roc"]);
		expect(kept("Toyota C-HR")).toEqual(["C-HR"]);
		expect(kept("Audi e-tron GT")).toEqual(["e-tron"]);
		expect(kept("Honda CR-V a HR-V")).toEqual(["CR-V", "HR-V"]);
		expect(kept("Autochladnička Pro-USER CoolZ")).toEqual(["Pro-USER"]);
	});

	it("keeps a tyre size on one line", () => {
		expect(kept("Snehové reťaze 205/55 R16")).toEqual(["205/55"]);
	});

	it("leaves a kept token without the spaces around it", () => {
		const parts = keepTogetherParts("Mazda CX-60 KH");
		expect(parts).toEqual([
			{ text: "Mazda ", keep: false },
			{ text: "CX-60", keep: true },
			{ text: " KH", keep: false },
		]);
	});

	it("lets a long compound break at its hyphen", () => {
		const long = "Fahrradträger-Befestigungssatz";
		expect(long.length).toBeGreaterThan(KEEP_TOGETHER_MAX_LENGTH);
		expect(kept(`Nordrive ${long}`)).toEqual([]);
	});

	it("does not mark a dash that stands between words", () => {
		// Spaced dashes are separate tokens with nothing on either side.
		expect(kept("Mazda CX 60 - hladká strecha")).toEqual([]);
		expect(kept("Menabo Delta — Normaldach")).toEqual([]);
		// A trailing or leading hyphen has no letter on one side.
		expect(kept("pre- a post-")).toEqual([]);
		// Years written with an en dash are not a hyphen and are left to the browser.
		expect(kept("(2022–2025)")).toEqual([]);
	});

	it("handles names with letters outside ASCII", () => {
		expect(kept("Škoda Š-1 skúška")).toEqual(["Š-1"]);
	});
});
