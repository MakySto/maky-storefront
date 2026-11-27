import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { publicComponentEans, type ComponentRole } from "@/lib/component-eans";
import { SET_PARTS_LIST_MAX, SetParts, partName, type SetPartsLabels } from "./set-parts";

/**
 * The parts of a set under its code on the product page (owner, 2026-11-27, audit S3): one part on a
 * line with its name, code and EAN while the set is a handful of parts, the wrapped line it always was
 * for a set of many.
 */

const ROLE_DE: Record<ComponentRole, string | null> = {
	bars: "Querträger",
	feet: "Füße",
	kit: "Montagekit",
	other: null,
};
const ROLE_SK: Record<ComponentRole, string | null> = {
	bars: "priečniky",
	feet: "pätky",
	kit: "montážny kit",
	other: null,
};

const labels = (roles: Record<ComponentRole, string | null>, locale: string): SetPartsLabels => ({
	heading: "Zostava sa skladá z týchto dielov:",
	compactHeading: "EAN dielov",
	ean: "EAN",
	roleName: (role) => roles[role],
	locale,
});

const render = (raw: unknown, roles = ROLE_SK, locale = "sk-SK") =>
	renderToStaticMarkup(
		createElement(SetParts, {
			parts: publicComponentEans(JSON.stringify(raw)),
			labels: labels(roles, locale),
		}),
	);

/** The text of each table row, cell by cell. */
const rows = (html: string) =>
	[...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((row) =>
		[...row[1]!.matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map((cell) => cell[1]!.replace(/<[^>]+>/g, "")),
	);

// The set on the owner's screenshot: Nordrive Silenzio for a BMW 5, `N21220|N20001|N15085`.
const NORDRIVE = [
	{ code: "N21220", role: "kit", ean: "8034057212200", qty: 1 },
	{ code: "N20001", role: "feet", ean: "8034057200016", qty: 1 },
	{ code: "N15085", role: "bars", ean: "8034057150854", qty: 1 },
];

describe("a set of a few parts", () => {
	it("lists one part on a line: its name, its code, its EAN", () => {
		const html = render(NORDRIVE);
		expect(html).toContain("Zostava sa skladá z týchto dielov:");
		expect(rows(html)).toEqual([
			["Montážny kit", "N21220", "EAN: 8034057212200"],
			["Pätky", "N20001", "EAN: 8034057200016"],
			["Priečniky", "N15085", "EAN: 8034057150854"],
		]);
		// One table with a caption, not three loose lines: a screen reader announces what the rows are.
		expect(html.match(/<table/g)).toHaveLength(1);
		expect(html).toContain("<caption");
		expect(html.match(/<th scope="row"/g)).toHaveLength(3);
	});

	it("keeps a German noun as it is written and gives a part of no role its code for a name", () => {
		const html = render(
			[...NORDRIVE.slice(0, 1), { code: "N10099", role: "something-new", ean: "8034057100996", qty: 1 }],
			ROLE_DE,
			"de-DE",
		);
		expect(rows(html)).toEqual([
			["Montagekit", "N21220", "EAN: 8034057212200"],
			["N10099", "", "EAN: 8034057100996"],
		]);
	});

	it("says how many of a part the set holds", () => {
		const html = render([{ code: "N15085", role: "bars", ean: "8034057150854", qty: 2 }]);
		expect(rows(html)[0]![0]).toBe("Priečniky (2×)");
	});

	it("renders nothing for a set whose parts CFM has not published", () => {
		expect(render([])).toBe("");
		expect(
			renderToStaticMarkup(createElement(SetParts, { parts: [], labels: labels(ROLE_SK, "sk-SK") })),
		).toBe("");
	});
});

describe("a set of many parts", () => {
	// A roof basket: valid EAN-13s, six of them. Twelve rows above the price would push the button down.
	const BASKET = [
		"4006381333931",
		"5901234123457",
		"4012345678901",
		"8710398527905",
		"9780201379624",
		"4003994155486",
	].map((ean, index) => ({ code: `K${index + 1}00`, role: "other", ean, qty: 1 }));

	it("keeps the wrapped line it had, under its own label", () => {
		expect(BASKET.length).toBeGreaterThan(SET_PARTS_LIST_MAX);
		const html = render(BASKET);
		expect(publicComponentEans(JSON.stringify(BASKET))).toHaveLength(BASKET.length);
		expect(html).not.toContain("<table");
		expect(html).not.toContain("Zostava sa skladá");
		expect(html).toContain("EAN dielov:");
		expect(html.match(/<dd/g)).toHaveLength(BASKET.length);
	});

	it("is a table again at exactly the limit", () => {
		expect(render(BASKET.slice(0, SET_PARTS_LIST_MAX))).toContain("<table");
	});
});

describe("a part's name", () => {
	it("starts with a capital in the market's own alphabet", () => {
		expect(partName("priečniky", "sk-SK")).toBe("Priečniky");
		expect(partName("čelá", "sk-SK")).toBe("Čelá");
		expect(partName("Querträger", "de-DE")).toBe("Querträger");
		expect(partName(null, "sk-SK")).toBeNull();
	});
});
