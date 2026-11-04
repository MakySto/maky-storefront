import { describe, expect, it } from "vitest";
import { readCategoryArticle } from "./category-description";

const doc = (blocks: unknown[]) => JSON.stringify({ blocks, version: "2.30.8" });
const p = (text: string) => ({ type: "paragraph", data: { text } });
const h = (text: string, level = 2) => ({ type: "header", data: { text, level } });
const ul = (...items: string[]) => ({ type: "list", data: { style: "unordered", items } });

describe("readCategoryArticle", () => {
	it("cuts at the first heading: the lead for the hero, everything from the heading for below the listing", () => {
		const article = readCategoryArticle(
			doc([
				p("Úvod s <strong>tučným</strong>."),
				p("Druhý odsek úvodu."),
				h("Sekcia"),
				p("Text."),
				ul("a", "b"),
			]),
		);
		expect(article?.heroText).toBe("Úvod s tučným. Druhý odsek úvodu.");
		expect(article?.body.map((block) => block.type)).toEqual(["header", "paragraph", "list"]);
	});

	it("keeps the links and the bold of the sections as markup for the block renderer", () => {
		const article = readCategoryArticle(
			doc([p("Úvod."), h("Sekcia"), ul('<a href="/sk/strechy">Strechy</a>')]),
		);
		const list = article?.body[1];
		expect(list?.type === "list" && list.data.items[0]).toBe('<a href="/sk/strechy">Strechy</a>');
	});

	it("leaves a description with no heading to the old path", () => {
		expect(readCategoryArticle(doc([p("Len jeden odsek.")]))).toBeNull();
		expect(readCategoryArticle(doc([p("Jeden."), p("Druhý.")]))).toBeNull();
	});

	it("leaves a description that opens with a heading to the old path", () => {
		expect(readCategoryArticle(doc([h("Nadpis"), p("Text.")]))).toBeNull();
	});

	it("leaves a description with a block this renderer does not draw to the old path, whole", () => {
		const table = { type: "table", data: { withHeadings: true, content: [["a"], ["b"]] } };
		expect(readCategoryArticle(doc([p("Úvod."), h("Sekcia"), table]))).toBeNull();
		expect(readCategoryArticle(doc([p("Úvod."), h("Sekcia"), { type: "image", data: {} }]))).toBeNull();
		expect(readCategoryArticle(doc([p("Úvod."), h("Sekcia", 4)]))).toBeNull();
	});

	it("is null for no description, an empty one and text that is not a document", () => {
		for (const value of [null, undefined, "", "obyčajný text", "{", doc([]), "null", "[]"]) {
			expect(readCategoryArticle(value)).toBeNull();
		}
	});

	it("is null when the lead has no words, so the hero is never emptied", () => {
		expect(readCategoryArticle(doc([p("  "), h("Sekcia"), p("Text.")]))).toBeNull();
	});
});
