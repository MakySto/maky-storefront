import { describe, expect, it } from "vitest";

import { matchWindow, type FitmentWindow } from "./contract";

/**
 * Month boundaries, and the third answer.
 *
 * Every case here is shaped after a real row in CFM's first 3.0.0 pilot. The one that
 * matters most is the boundary year with a known month and a shopper who does not know
 * theirs: rounding that to "fits" sells a rack to a car built two months too early, and
 * rounding it to "does not fit" refuses a customer whose car very likely does. Asking is
 * the only honest third option, and it only exists because the answer is not a boolean.
 */

const w = (over: Partial<FitmentWindow>): FitmentWindow => ({
	from: { year: 2016, month: 6 },
	to: { year: 2019, month: 11 },
	startPrecision: "month",
	endPrecision: "month",
	reconciledToGeneration: false,
	...over,
});

describe("inside the window, where the month cannot matter", () => {
	it("accepts an inner year with no month given", () => {
		expect(matchWindow(w({}), 2017)).toBe("in");
	});
	it("accepts an inner year whatever the month is", () => {
		expect(matchWindow(w({}), 2017, 1)).toBe("in");
		expect(matchWindow(w({}), 2017, 12)).toBe("in");
	});
	it("rejects years outside the window without asking anything", () => {
		expect(matchWindow(w({}), 2015)).toBe("out");
		expect(matchWindow(w({}), 2020)).toBe("out");
	});
});

describe("on a boundary year the source knows to the month", () => {
	it("asks for the month rather than guessing — start", () => {
		expect(matchWindow(w({}), 2016)).toBe("needs-detail");
	});
	it("asks for the month rather than guessing — end", () => {
		expect(matchWindow(w({}), 2019)).toBe("needs-detail");
	});
	it("is inclusive of the boundary month itself", () => {
		expect(matchWindow(w({}), 2016, 6)).toBe("in");
		expect(matchWindow(w({}), 2019, 11)).toBe("in");
	});
	it("excludes the month before the start and after the end", () => {
		expect(matchWindow(w({}), 2016, 5)).toBe("out");
		expect(matchWindow(w({}), 2019, 12)).toBe("out");
	});
});

describe("when the source itself does not know the month", () => {
	it("takes the whole boundary year — reconciliation lost the month, we do not invent one", () => {
		// CFM's `reconciledToGeneration` rows: the start was pulled onto the generation
		// edge and the month went with it. 303 of 9,192 in the first real export.
		const reconciled = w({ from: { year: 2006 }, startPrecision: "year", reconciledToGeneration: true });
		expect(matchWindow(reconciled, 2006)).toBe("in");
		expect(matchWindow(reconciled, 2006, 1)).toBe("in");
		expect(matchWindow(reconciled, 2006, 12)).toBe("in");
		expect(matchWindow(reconciled, 2005)).toBe("out");
	});

	it("still asks when the OTHER end is month-precise and the shopper lands on it", () => {
		// Straight out of the pilot: from {2003} year-precise, to {2003, 4} month-precise.
		// The start cannot decide 2003 and the end can — so the month is still needed.
		const pilot = w({
			from: { year: 2003 },
			startPrecision: "year",
			to: { year: 2003, month: 4 },
			endPrecision: "month",
			reconciledToGeneration: true,
		});
		expect(matchWindow(pilot, 2003)).toBe("needs-detail");
		expect(matchWindow(pilot, 2003, 4)).toBe("in");
		expect(matchWindow(pilot, 2003, 5)).toBe("out");
	});
});

describe("open-ended windows", () => {
	const open = w({ to: null, endPrecision: "open" });

	it("never ends", () => {
		expect(matchWindow(open, 2099)).toBe("in");
	});
	it("still asks on the start boundary", () => {
		expect(matchWindow(open, 2016)).toBe("needs-detail");
		expect(matchWindow(open, 2016, 7)).toBe("in");
		expect(matchWindow(open, 2016, 5)).toBe("out");
	});
	it("is out before it starts, with no question asked", () => {
		expect(matchWindow(open, 2015)).toBe("out");
	});
});

describe("a definite yes needs both ends definite", () => {
	it("does not upgrade a needs-detail start because the end is clear", () => {
		const oneYear = w({ from: { year: 2020, month: 3 }, to: { year: 2020, month: 9 } });
		expect(matchWindow(oneYear, 2020)).toBe("needs-detail");
		expect(matchWindow(oneYear, 2020, 6)).toBe("in");
		expect(matchWindow(oneYear, 2020, 2)).toBe("out");
		expect(matchWindow(oneYear, 2020, 10)).toBe("out");
	});
});
