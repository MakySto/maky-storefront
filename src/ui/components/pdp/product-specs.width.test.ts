import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { parseProductContent, TABLE_SCROLL_CLASS } from "@/lib/editorjs";
import { liftSections, templateFor } from "@/lib/product-templates";
import { ProductSpecs } from "./product-specs";

/**
 * A description never makes the page wider than the phone.
 *
 * On 2026-11-16 the product page of a snow chain was 608px wide on a 360px phone: the tyre-size table
 * in its description (one row per rim, the sizes of the rim in one cell) kept its natural width, the
 * card around it grew with it, and the buy bar, as wide as the page, had its button off the screen.
 * 1 468 of the 1 740 chain pages (145 products in twelve languages) were wider than the screen.
 *
 * No test here can lay a page out, so these pin the three things the layout rests on, each of which
 * was measured in a browser to be enough alone for the table: the cards may shrink (`min-w-0`), the
 * table's frame reports no width of its own (`contain: inline-size`), and a table of two columns
 * wraps. A word longer than the line breaks (`break-words`).
 */

const SK = "sk-SK";

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

const render = async (element: Promise<ReactNode> | ReactNode): Promise<string> =>
	renderToStaticMarkup(createElement(Fragment, null, await element));

/** The tyre-size table of SnowDrive WX-9, size 1 (NGD02001), as CFM writes it for the German market. */
const CHAIN_DESCRIPTION = JSON.stringify({
	time: 0,
	version: "2.30.8",
	blocks: [
		{ type: "paragraph", data: { text: "SnowDrive WX-9 sind Schneeketten mit 9-mm-Gliedern." } },
		{ type: "header", data: { level: 2, text: "Reifengrößen für Code NGD02001" } },
		{
			type: "table",
			data: {
				withHeadings: true,
				content: [
					["Felge", "Reifengrößen (Breite/Querschnitt)"],
					["R10", "120/80, 145/80, 155/80, 165/70, 145, 155, 5.00-10"],
					["R12", "120/80, 125/80, 130/80, 135/80, 140/70, 145/70, 150/65, 125, 135, 4.00-12"],
					["R13", "135/70, 145/60, 125"],
				],
			},
		},
	],
});

/** The class list the pattern captures, as it was written: the markup escapes `&` and `>`. */
const classesOf = (html: string, pattern: RegExp): string =>
	(pattern.exec(html)?.[1] ?? "").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

describe("a description on a phone", () => {
	const template = templateFor(null);
	const content = parseProductContent(CHAIN_DESCRIPTION);
	const sections = content ? liftSections(content.blocks, template) : null;
	const page = () =>
		render(ProductSpecs({ descriptionHtml: sections?.description, attributes: [], locale: SK, template }));

	it("puts the table in its scrolling frame, inside the description card", async () => {
		const html = await page();
		const card = /<article id="product-description"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
		expect(card).toContain(`<div class="${TABLE_SCROLL_CLASS}"><table>`);
	});

	it("lets every card of the page be narrower than what it holds", async () => {
		const html = await page();
		// The grid the cards stand in: its items keep `min-width: auto` unless it says otherwise.
		const grid = classesOf(html, /<div class="([^"]*)"><article id="product-description"/);
		expect(grid.split(" ")).toContain("grid");
		expect(grid.split(" ")).toContain("[&>*]:min-w-0");
	});

	it("breaks a word that is longer than the line", async () => {
		const html = await page();
		expect(classesOf(html, /^<section class="([^"]*)"/).split(" ")).toContain("break-words");
	});
});

describe("the frame of a description's table (brand.css)", () => {
	const css = readFileSync(path.join(process.cwd(), "src/styles/brand.css"), "utf8");
	const rule = (selector: string): string => {
		const start = css.indexOf(`${selector} {`);
		return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
	};

	it("scrolls sideways and reports no width of its own to what it stands in", () => {
		const frame = rule(`.${TABLE_SCROLL_CLASS}`);
		expect(frame).toMatch(/overflow-x:\s*auto/);
		expect(frame).toMatch(/contain:\s*inline-size/);
	});

	it("keeps the natural width only for a table of three or more columns", () => {
		expect(rule(`.${TABLE_SCROLL_CLASS} > table:has(tr > :nth-child(3))`)).toMatch(
			/min-width:\s*max-content/,
		);
		// Not for every table again: a table of two columns wraps in the width it has.
		expect(rule(`.${TABLE_SCROLL_CLASS} > table`)).toBe("");
	});
});
