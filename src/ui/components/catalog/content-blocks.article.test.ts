import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readCategoryArticle } from "@/lib/category-description";
import { ContentBlocks } from "./content-blocks";

const document = JSON.stringify({
	version: "2.30.8",
	blocks: [
		{ type: "paragraph", data: { text: "Úvod nad produktmi." } },
		{ type: "header", data: { text: "Aký nosič vybrať", level: 2 } },
		{ type: "paragraph", data: { text: "Začnite <strong>uchytením</strong>." } },
		{
			type: "list",
			data: {
				style: "unordered",
				items: ['<a href="/sk/nosice-bicyklov-na-strechu">Na strechu</a>', "<strong>Na ťažné:</strong> text"],
			},
		},
		{ type: "header", data: { text: "Časté otázky", level: 2 } },
		{ type: "paragraph", data: { text: "<strong>Otázka?</strong>" } },
		{ type: "paragraph", data: { text: "Odpoveď." } },
	],
});

describe("a category article below the listing", () => {
	const article = readCategoryArticle(document);
	const html = renderToStaticMarkup(
		createElement(ContentBlocks, { blocks: article?.body ?? [], market: "sk", id: "category-article" }),
	);

	it("keeps the lead out of the sections", () => {
		expect(article?.heroText).toBe("Úvod nad produktmi.");
		expect(html).not.toContain("Úvod nad produktmi");
	});

	it("draws headings, bold and lists as elements", () => {
		expect(html).toContain("<h2");
		expect(html).toContain("Aký nosič vybrať");
		expect(html).toContain("<strong><span>uchytením</span></strong>");
		expect(html).toContain("<strong><span>Na ťažné:</span></strong>");
		expect(html).toContain("<ul");
	});

	it("links to the public address once, with the market prefix", () => {
		expect(html).toContain('href="/sk/nosice-bicyklov-na-strechu"');
		expect(html).not.toContain("/sk/sk/");
	});

	it("never shows raw tags as text", () => {
		expect(html).not.toContain("&lt;strong");
		expect(html).not.toContain("&lt;a ");
	});
});
