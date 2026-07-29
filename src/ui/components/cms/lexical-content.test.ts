import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { type LexicalDocument } from "@/lib/cms/lexical";
import { LexicalContent } from "./lexical-content";

/** Render the component the way a server component would, and return the HTML. */
function render(root: Record<string, unknown>): string {
	const document = { root: { type: "root", ...root } } as unknown as LexicalDocument;
	return renderToStaticMarkup(createElement(LexicalContent, { document, channel: "sk-eur" }));
}

function paragraph(...children: Record<string, unknown>[]) {
	return { type: "paragraph", format: "start", children };
}

function text(value: string, format = 0) {
	return { type: "text", text: value, format };
}

describe("LexicalContent — the shapes in production content", () => {
	it("renders paragraphs of plain text", () => {
		const html = render({ children: [paragraph(text("MAKY.STORE je slovenský e-shop."))] });
		expect(html).toBe("<p>MAKY.STORE je slovenský e-shop.</p>");
	});

	it("renders the bold company name as strong", () => {
		// The live o-nas document carries format 1 on "MAKY.STORE s. r. o.".
		const html = render({ children: [paragraph(text("MAKY.STORE s. r. o.", 1))] });
		expect(html).toBe("<p><strong>MAKY.STORE s. r. o.</strong></p>");
	});

	it("renders linebreaks inside a paragraph", () => {
		const html = render({
			children: [paragraph(text("Riadok 1"), { type: "linebreak" }, text("Riadok 2"))],
		});
		expect(html).toBe("<p>Riadok 1<br/>Riadok 2</p>");
	});

	it("renders a mailto autolink, the one link in the live content", () => {
		const html = render({
			children: [
				paragraph({
					type: "autolink",
					fields: { url: "mailto:info@maky.store", linkType: "custom" },
					children: [text("info@maky.store")],
				}),
			],
		});
		expect(html).toBe('<p><a href="mailto:info@maky.store">info@maky.store</a></p>');
	});
});

describe("LexicalContent — nodes the editor can produce", () => {
	it("renders headings at h2–h4 and never a second h1", () => {
		expect(render({ children: [{ type: "heading", tag: "h2", children: [text("Nadpis")] }] })).toBe(
			"<h2>Nadpis</h2>",
		);
		expect(render({ children: [{ type: "heading", tag: "h1", children: [text("Nadpis")] }] })).toBe(
			"<h2>Nadpis</h2>",
		);
	});

	it("renders both list flavours", () => {
		const items = [
			{ type: "listitem", children: [text("jedna")] },
			{ type: "listitem", children: [text("dva")] },
		];
		expect(render({ children: [{ type: "list", listType: "bullet", children: items }] })).toBe(
			"<ul><li>jedna</li><li>dva</li></ul>",
		);
		expect(render({ children: [{ type: "list", listType: "number", children: items }] })).toBe(
			"<ol><li>jedna</li><li>dva</li></ol>",
		);
	});

	it("renders combined text formats", () => {
		const html = render({ children: [paragraph(text("x", 1 | 2 | 16))] });
		expect(html).toBe("<p><strong><em><code>x</code></em></strong></p>");
	});

	it("applies explicit alignment only", () => {
		expect(render({ children: [{ type: "paragraph", format: "center", children: [text("x")] }] })).toBe(
			'<p class="text-center">x</p>',
		);
		// "start" is Lexical's default and must not emit a class.
		expect(render({ children: [paragraph(text("x"))] })).toBe("<p>x</p>");
	});

	it("renders a quote", () => {
		expect(render({ children: [{ type: "quote", children: [paragraph(text("citát"))] }] })).toBe(
			"<blockquote><p>citát</p></blockquote>",
		);
	});
});

describe("LexicalContent — safety", () => {
	it("never emits a javascript: href — the words survive, the link does not", () => {
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { url: "javascript:alert(1)", linkType: "custom" },
					children: [text("klikni")],
				}),
			],
		});
		expect(html).toBe("<p>klikni</p>");
		expect(html).not.toContain("javascript");
		expect(html).not.toContain("href");
	});

	it("never emits a data: href", () => {
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { url: "data:text/html;base64,PHNjcmlwdD4=", linkType: "custom" },
					children: [text("x")],
				}),
			],
		});
		expect(html).not.toContain("href");
	});

	it("escapes markup in text rather than interpreting it", () => {
		// This is the structural advantage over the html-string + sanitiser path.
		const html = render({ children: [paragraph(text('<script>alert("xss")</script>'))] });
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("adds rel=noopener noreferrer when the editor asks for a new tab", () => {
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { url: "https://example.com", linkType: "custom", newTab: true },
					children: [text("x")],
				}),
			],
		});
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});
});

describe("LexicalContent — resilience", () => {
	it("renders nothing for an unknown node and logs it, instead of throwing", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const html = render({
			children: [paragraph(text("pred")), { type: "someFutureNode", children: [text("stratené")] }],
		});
		expect(html).toBe("<p>pred</p>");
		expect(spy).toHaveBeenCalledWith(
			"[cms] unsupported-lexical-node",
			JSON.stringify({ nodeType: "someFutureNode" }),
		);
		spy.mockRestore();
	});

	it("survives malformed children", () => {
		expect(render({ children: "not-an-array" })).toBe("");
		expect(render({})).toBe("");
		expect(render({ children: [null, 42, paragraph(text("ok"))] })).toBe("<p>ok</p>");
	});

	it("drops a text node with no text", () => {
		expect(render({ children: [paragraph({ type: "text" }, text("ok"))] })).toBe("<p>ok</p>");
	});

	it("renders an internal page link through next/link with the market prefix", () => {
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { linkType: "internal", doc: { relationTo: "pages", value: { slug: "kontakt" } } },
					children: [text("kontakt")],
				}),
			],
		});
		// channel is the Saleor slug; the href must carry the friendly market prefix.
		expect(html).toBe('<p><a href="/sk/kontakt">kontakt</a></p>');
	});

	it("logs an internal link to a collection with no storefront route and keeps the text", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { linkType: "internal", doc: { relationTo: "posts", value: { slug: "clanok" } } },
					children: [text("článok")],
				}),
			],
		});
		expect(html).toBe("<p>článok</p>");
		expect(spy).toHaveBeenCalledWith(
			"[cms] link-target-has-no-route",
			JSON.stringify({ collection: "posts", slug: "clanok" }),
		);
		spy.mockRestore();
	});
});
