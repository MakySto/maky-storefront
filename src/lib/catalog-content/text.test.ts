import { describe, expect, it } from "vitest";
import { type CatalogContentPage, type ContentBlock } from "./contract";
import { hasReadableText, splitContent } from "./text";

const para = (text: string): ContentBlock => ({ type: "paragraph", data: { text } });
const head = (text: string): ContentBlock => ({ type: "header", data: { text, level: 2 } });
const list = (...items: string[]): ContentBlock => ({ type: "list", data: { style: "unordered", items } });

const page = (over: Partial<CatalogContentPage>): CatalogContentPage => ({
	publicId: "pg:1",
	kind: "vehicle_generation",
	urlPath: "/x",
	hasEditorialText: true,
	...over,
});

describe("splitContent", () => {
	it("uses the export's own split when it has one", () => {
		const result = splitContent(
			page({
				top: { blocks: [para("lead")] },
				body: { blocks: [head("H"), para("rest")] },
				intro: { blocks: [] },
			}),
		);
		expect(result.source).toBe("export");
		expect(result.top).toHaveLength(1);
		expect(result.body).toHaveLength(2);
	});

	/**
	 * The case the 2026-09-11 export actually ships: top and body empty on all
	 * 1475 pages, intro carrying everything. Rendering top/body literally, as the
	 * integration plan describes, would produce 1473 blank pages.
	 */
	it("derives the split from intro when the export did not materialise it", () => {
		const result = splitContent(
			page({
				top: { blocks: [] },
				body: { blocks: [] },
				intro: { blocks: [para("lead"), head("H"), para("advice")] },
			}),
		);
		expect(result.source).toBe("derived");
		expect(result.top).toEqual([para("lead")]);
		expect(result.body).toEqual([head("H"), para("advice")]);
	});

	it("cuts at the FIRST header, wherever it sits", () => {
		// Measured: index 1 on 1358 pages, index 2 on 115.
		const twoLead = splitContent(page({ intro: { blocks: [para("a"), para("b"), head("H"), para("c")] } }));
		expect(twoLead.top).toHaveLength(2);
		expect(twoLead.body).toHaveLength(2);
	});

	it("puts everything below the listing when the page opens with a header", () => {
		const result = splitContent(page({ intro: { blocks: [head("H"), para("a")] } }));
		expect(result.top).toEqual([]);
		expect(result.body).toHaveLength(2);
	});

	it("puts everything below the listing when there is no header at all", () => {
		const result = splitContent(page({ intro: { blocks: [para("a"), para("b")] } }));
		expect(result.top).toEqual([]);
		expect(result.body).toHaveLength(2);
	});

	it("reports empty rather than inventing a split", () => {
		expect(splitContent(page({ intro: { blocks: [] } })).source).toBe("empty");
		expect(splitContent(page({})).source).toBe("empty");
	});

	it("never returns intro AND the split — they are the same words", () => {
		const result = splitContent(page({ intro: { blocks: [para("a"), head("H"), para("b")] } }));
		expect([...result.top, ...result.body]).toHaveLength(3);
	});
});

describe("hasReadableText", () => {
	it("sees text in paragraphs and list items", () => {
		expect(hasReadableText(page({ intro: { blocks: [para("hello")] } }))).toBe(true);
		expect(hasReadableText(page({ intro: { blocks: [head("H"), list("one")] } }))).toBe(true);
	});

	it("does not count markup as text", () => {
		expect(hasReadableText(page({ intro: { blocks: [para("<b></b>")] } }))).toBe(false);
		expect(hasReadableText(page({ intro: { blocks: [] } }))).toBe(false);
	});
});
