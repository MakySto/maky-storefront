import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RENDERABLE_NODE_TYPES, type LexicalDocument } from "@/lib/cms/lexical";
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

	it("renders both list flavours and preserves ordered numbering", () => {
		const bulletItems = [
			{ type: "listitem", value: 1, children: [text("jedna")] },
			{ type: "listitem", value: 2, children: [text("dva")] },
		];
		expect(
			render({
				children: [{ type: "list", listType: "bullet", tag: "ul", start: 1, children: bulletItems }],
			}),
		).toBe("<ul><li>jedna</li><li>dva</li></ul>");

		const numberedItems = [
			{ type: "listitem", value: 5, children: [text("päť")] },
			{ type: "listitem", value: 7, children: [text("sedem")] },
		];
		expect(
			render({
				children: [{ type: "list", listType: "number", tag: "ol", start: 5, children: numberedItems }],
			}),
		).toBe(`<ol start="5"><li value="5">päť</li><li value="7">sedem</li></ol>`);
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

	it("keeps a root-relative URL as text and logs the degradation", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const html = render({
			children: [
				paragraph({
					type: "link",
					fields: { url: "/kontakt", linkType: "custom" },
					children: [text("Kontakt")],
				}),
			],
		});

		expect(html).toBe("<p>Kontakt</p>");
		expect(html).not.toContain("href");
		expect(spy).toHaveBeenCalledWith("[cms] link-url-rendered-as-text", JSON.stringify({ url: "/kontakt" }));
		spy.mockRestore();
	});

	it("keeps populated Page/Post targets without a route as text and logs them", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		for (const collection of ["pages", "posts"] as const) {
			const html = render({
				children: [
					paragraph({
						type: "link",
						fields: {
							linkType: "internal",
							doc: { relationTo: collection, value: { slug: "future" } },
						},
						children: [text(collection)],
					}),
				],
			});

			expect(html).toBe(`<p>${collection}</p>`);
			expect(html).not.toContain("href");
			expect(spy).toHaveBeenCalledWith(
				"[cms] link-target-has-no-route",
				JSON.stringify({ collection, slug: "future" }),
			);
		}
		spy.mockRestore();
	});
});

describe("LexicalContent — resilience", () => {
	it("renders nothing for an unknown node and logs it, instead of throwing", () => {
		// Belt and braces. `parsePagesResponse` rejects a document containing a
		// content-bearing unknown node before it ever reaches this component, so in
		// production this branch is only reachable for inert marker nodes. It stays
		// because a renderer that throws on unexpected input takes the page with it.
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

	it("has a case for every type in RENDERABLE_NODE_TYPES", () => {
		// The validator rejects documents using this set; the renderer switches on
		// node.type. If the two drift, either published content is refused for no
		// reason or an unrenderable node slips past validation. This test is what
		// keeps them honest — a comment asking two files to agree would not.
		const sample: Record<string, Record<string, unknown>> = {
			paragraph: paragraph(text("x")),
			heading: { type: "heading", tag: "h2", children: [text("x")] },
			quote: { type: "quote", children: [text("x")] },
			list: { type: "list", listType: "bullet", children: [{ type: "listitem", children: [text("x")] }] },
			listitem: { type: "listitem", children: [text("x")] },
			text: text("x"),
			linebreak: { type: "linebreak" },
			link: { type: "link", fields: { url: "https://maky.store" }, children: [text("x")] },
			autolink: { type: "autolink", fields: { url: "mailto:a@b.c" }, children: [text("x")] },
		};

		// `root` is the document wrapper, never a child, so it has no renderer case.
		const renderable = [...RENDERABLE_NODE_TYPES].filter((type) => type !== "root");
		expect(Object.keys(sample).sort()).toEqual([...renderable].sort());

		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		for (const [type, node] of Object.entries(sample)) {
			render({ children: [node] });
			expect(spy, `renderer has no case for "${type}"`).not.toHaveBeenCalledWith(
				"[cms] unsupported-lexical-node",
				expect.stringContaining(type),
			);
		}
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
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
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
