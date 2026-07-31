import { describe, expect, it } from "vitest";

import {
	alignmentClass,
	classifyLinkUrl,
	findUnrenderableNode,
	headingTag,
	listTag,
	readLink,
	RENDERABLE_NODE_TYPES,
	safeLinkUrl,
	textFormats,
	validateLexicalDocument,
	type LexicalDocument,
} from "./lexical";

describe("safeLinkUrl", () => {
	it("allows the three protocols the content actually uses", () => {
		expect(safeLinkUrl("https://maky.store")).toBe("https://maky.store");
		expect(safeLinkUrl("http://example.com/a?b=c")).toBe("http://example.com/a?b=c");
		// The production o-nas content contains exactly this autolink.
		expect(safeLinkUrl("mailto:info@maky.store")).toBe("mailto:info@maky.store");
	});

	it("does not emit relative and same-page URLs as hrefs", () => {
		expect(safeLinkUrl("#kontakt")).toBeNull();
		expect(safeLinkUrl("/sk/obchodne-podmienky")).toBeNull();
	});

	it("distinguishes harmless local references from unsafe destinations", () => {
		expect(classifyLinkUrl("/kontakt")).toEqual({ kind: "inert-relative", url: "/kontakt" });
		expect(classifyLinkUrl("kontakt")).toEqual({ kind: "inert-relative", url: "kontakt" });
		expect(classifyLinkUrl("./kontakt")).toEqual({ kind: "inert-relative", url: "./kontakt" });
		expect(classifyLinkUrl("?tab=kontakt")).toEqual({ kind: "inert-relative", url: "?tab=kontakt" });
		expect(classifyLinkUrl("#sekcia")).toEqual({ kind: "inert-relative", url: "#sekcia" });
		expect(classifyLinkUrl("javascript:alert(1)")).toEqual({ kind: "invalid" });
		expect(classifyLinkUrl("//evil.example")).toEqual({ kind: "invalid" });
		expect(classifyLinkUrl("/\\evil.example")).toEqual({ kind: "invalid" });
	});

	it("rejects script-bearing schemes", () => {
		expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
		expect(safeLinkUrl("JavaScript:alert(1)")).toBeNull();
		expect(safeLinkUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
		expect(safeLinkUrl("vbscript:msgbox(1)")).toBeNull();
		expect(safeLinkUrl("file:///etc/passwd")).toBeNull();
	});

	it("rejects schemes obfuscated with whitespace and control characters", () => {
		// URL parsing strips these before reading the scheme, so the guard sees through them.
		expect(safeLinkUrl("  javascript:alert(1)")).toBeNull();
		expect(safeLinkUrl("java\tscript:alert(1)")).toBeNull();
		expect(safeLinkUrl("java\nscript:alert(1)")).toBeNull();
		// A NUL byte, written as an escape so this file stays text in git rather than
		// becoming an undiffable binary blob.
		expect(safeLinkUrl("\u0000javascript:alert(1)")).toBeNull();
		expect(safeLinkUrl(" javascript:alert(1)")).toBeNull();
	});

	it("rejects protocol-relative URLs rather than guessing a scheme", () => {
		expect(safeLinkUrl("//evil.example")).toBeNull();
		// The WHATWG parser treats a backslash like a slash after a leading `/` for special
		// schemes, so `/\evil.example` resolves to https://evil.example/ — an off-site link
		// that reads as an internal path. Only the `//` spelling used to be caught.
		expect(safeLinkUrl("/\\evil.example")).toBeNull();
		expect(safeLinkUrl("/\\/evil.example")).toBeNull();
	});

	it("does not treat internal routes as custom URLs", () => {
		expect(safeLinkUrl("/kontakt")).toBeNull();
		expect(safeLinkUrl("/sk/poradna")).toBeNull();
		expect(safeLinkUrl("#sekcia")).toBeNull();
	});

	it("rejects non-strings and blanks", () => {
		expect(safeLinkUrl(undefined)).toBeNull();
		expect(safeLinkUrl(null)).toBeNull();
		expect(safeLinkUrl(42)).toBeNull();
		expect(safeLinkUrl("")).toBeNull();
		expect(safeLinkUrl("   ")).toBeNull();
	});
});

describe("textFormats", () => {
	it("reads the bitmask values present in production content", () => {
		expect(textFormats({ type: "text", format: 0 })).toMatchObject({ bold: false, italic: false });
		// "MAKY.STORE s. r. o." in the live o-nas document carries format 1.
		expect(textFormats({ type: "text", format: 1 })).toMatchObject({ bold: true, italic: false });
	});

	it("decodes combined formats", () => {
		expect(textFormats({ type: "text", format: 1 | 2 | 16 })).toMatchObject({
			bold: true,
			italic: true,
			strikethrough: false,
			underline: false,
			code: true,
		});
	});

	it("ignores unknown bits instead of failing", () => {
		// Bit 32 is subscript, which this renderer does not style.
		expect(textFormats({ type: "text", format: 32 | 1 })).toMatchObject({ bold: true });
	});

	it("treats a missing or non-numeric format as unformatted", () => {
		expect(textFormats({ type: "text" })).toMatchObject({ bold: false });
		expect(textFormats({ type: "text", format: "bold" })).toMatchObject({ bold: false });
	});
});

describe("headingTag", () => {
	it("maps the levels the editor allows", () => {
		expect(headingTag({ type: "heading", tag: "h2" })).toBe("h2");
		expect(headingTag({ type: "heading", tag: "h3" })).toBe("h3");
		expect(headingTag({ type: "heading", tag: "h4" })).toBe("h4");
	});

	it("never emits a second h1 on the page", () => {
		expect(headingTag({ type: "heading", tag: "h1" })).toBe("h2");
	});

	it("clamps deeper levels and missing tags", () => {
		expect(headingTag({ type: "heading", tag: "h6" })).toBe("h4");
		expect(headingTag({ type: "heading" })).toBe("h2");
	});
});

describe("listTag", () => {
	it("distinguishes ordered from unordered", () => {
		expect(listTag({ type: "list", listType: "number" })).toBe("ol");
		expect(listTag({ type: "list", listType: "bullet" })).toBe("ul");
		expect(listTag({ type: "list" })).toBe("ul");
	});
});

describe("alignmentClass", () => {
	it("treats Lexical's default formats as no class", () => {
		// Every paragraph in the live document has format "start".
		expect(alignmentClass({ type: "paragraph", format: "start" })).toBeUndefined();
		expect(alignmentClass({ type: "paragraph", format: "" })).toBeUndefined();
		expect(alignmentClass({ type: "paragraph", format: "left" })).toBeUndefined();
	});

	it("maps explicit alignment", () => {
		expect(alignmentClass({ type: "paragraph", format: "center" })).toBe("text-center");
		expect(alignmentClass({ type: "paragraph", format: "right" })).toBe("text-right");
		expect(alignmentClass({ type: "paragraph", format: "justify" })).toBe("text-justify");
	});
});

describe("readLink", () => {
	it("reads the autolink shape found in production", () => {
		expect(
			readLink({
				type: "autolink",
				fields: { url: "mailto:info@maky.store", linkType: "custom" },
			}),
		).toEqual({ url: "mailto:info@maky.store", internal: null, newTab: false });
	});

	it("refuses an unsafe custom url", () => {
		expect(readLink({ type: "link", fields: { url: "javascript:alert(1)", linkType: "custom" } })).toEqual({
			url: null,
			internal: null,
			newTab: false,
		});
	});

	it("resolves an internal link populated at depth>=1", () => {
		expect(
			readLink({
				type: "link",
				fields: {
					linkType: "internal",
					newTab: true,
					doc: { relationTo: "pages", value: { slug: "kontakt" } },
				},
			}),
		).toEqual({ url: null, internal: { collection: "pages", slug: "kontakt" }, newTab: true });
	});

	it("does not repair whitespace in a populated relationship slug", () => {
		for (const slug of ["   ", " kontakt "]) {
			expect(
				readLink({
					type: "link",
					fields: { linkType: "internal", doc: { relationTo: "pages", value: { slug } } },
				}),
			).toEqual({ url: null, internal: null, newTab: false });
		}
	});

	it("gives up on an unpopulated relationship rather than emitting a broken href", () => {
		expect(readLink({ type: "link", fields: { linkType: "internal", doc: "019fb008-504b-779e" } })).toEqual({
			url: null,
			internal: null,
			newTab: false,
		});
	});

	it("ignores a relationship to a collection with no public route", () => {
		expect(
			readLink({
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: "private-files", value: { slug: "x" } } },
			}),
		).toEqual({ url: null, internal: null, newTab: false });
	});

	it("survives a missing fields object", () => {
		expect(readLink({ type: "autolink" })).toEqual({ url: null, internal: null, newTab: false });
	});
});

describe("validateLexicalDocument", () => {
	function documentWith(...children: unknown[]): LexicalDocument {
		return { root: { type: "root", format: "", children } } as unknown as LexicalDocument;
	}

	const text = { type: "text", text: "Obsah", format: 0 };

	it("accepts a complete canonical tree and a registered internal Page target", () => {
		const result = validateLexicalDocument(
			documentWith({
				type: "paragraph",
				format: "start",
				children: [
					text,
					{
						type: "link",
						fields: {
							linkType: "internal",
							doc: { relationTo: "pages", value: { slug: "kontakt" } },
						},
						children: [text],
					},
				],
			}),
		);

		expect(result).toEqual({ ok: true });
	});

	it("rejects malformed children, nested roots and missing required fields", () => {
		const cases: Array<[string, LexicalDocument]> = [
			["non-node child", documentWith({})],
			["nested root", documentWith({ type: "root", children: [] })],
			["element without children", documentWith({ type: "paragraph" })],
			["text without text", documentWith({ type: "text", format: 0 })],
			[
				"text carrying hidden children",
				documentWith({
					type: "text",
					text: "Viditeľné",
					format: 0,
					children: [{ type: "futureDisclosure", children: [] }],
				}),
			],
		];

		for (const [label, candidate] of cases) {
			expect(validateLexicalDocument(candidate).ok, label).toBe(false);
		}
	});

	it("rejects heading, list and alignment enum coercions", () => {
		for (const candidate of [
			{ type: "heading", tag: "h1", children: [text] },
			{ type: "heading", tag: "h5", children: [text] },
			{ type: "heading", children: [text] },
			{ type: "list", listType: "ordered", tag: "ol", start: 1, children: [] },
			{ type: "list", listType: "number", tag: "ul", start: 1, children: [] },
			{ type: "paragraph", format: "future", children: [text] },
		]) {
			expect(validateLexicalDocument(documentWith(candidate)).ok).toBe(false);
		}
	});

	it("validates list numbering and direct listitem structure", () => {
		const valid = documentWith({
			type: "list",
			listType: "number",
			tag: "ol",
			start: 5,
			children: [
				{ type: "listitem", value: 5, checked: null, children: [text] },
				{ type: "listitem", value: 7, checked: null, children: [text] },
			],
		});
		expect(validateLexicalDocument(valid)).toEqual({ ok: true });

		const invalid = [
			documentWith({ type: "list", listType: "number", tag: "ol", children: [] }),
			documentWith({ type: "list", listType: "number", tag: "ol", start: 0, children: [] }),
			documentWith({ type: "list", listType: "number", tag: "ol", start: 1.5, children: [] }),
			documentWith({ type: "list", listType: "number", tag: "ol", start: 1, children: [text] }),
			documentWith({ type: "listitem", value: 1, children: [text] }),
			documentWith({
				type: "list",
				listType: "bullet",
				tag: "ul",
				start: 1,
				children: [{ type: "listitem", children: [text] }],
			}),
			documentWith({
				type: "list",
				listType: "bullet",
				tag: "ul",
				start: 1,
				children: [{ type: "listitem", value: 0, children: [text] }],
			}),
			documentWith({
				type: "list",
				listType: "bullet",
				tag: "ul",
				start: 1,
				children: [{ type: "listitem", value: 1.5, children: [text] }],
			}),
			documentWith({
				type: "list",
				listType: "bullet",
				tag: "ul",
				start: 1,
				children: [{ type: "listitem", value: 1, checked: true, children: [text] }],
			}),
		];

		for (const candidate of invalid) {
			expect(validateLexicalDocument(candidate).ok).toBe(false);
		}
	});

	it("requires an integer non-negative text format using only known bits", () => {
		for (const format of ["bold", 1.5, Number.POSITIVE_INFINITY, -1, 32, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
			const result = validateLexicalDocument(documentWith({ type: "text", text: "Obsah", format }));
			expect(result.ok, String(format)).toBe(false);
		}
	});

	it("rejects malformed and unsafe links", () => {
		const cases = [
			{ type: "link", fields: { linkType: "custom", url: "javascript:alert(1)" }, children: [text] },
			{ type: "link", fields: { linkType: "custom", url: "//evil.example" }, children: [text] },
			{ type: "link", fields: { linkType: "internal", doc: "id" }, children: [text] },
			{
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: 42, value: { slug: "kontakt" } } },
				children: [text],
			},
			{
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: "pages", value: { slug: "   " } } },
				children: [text],
			},
			{
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: "pages", value: { slug: " kontakt " } } },
				children: [text],
			},
		];

		for (const candidate of cases) {
			expect(validateLexicalDocument(documentWith(candidate)).ok).toBe(false);
		}
	});

	it("keeps supported unroutable targets and harmless local URLs valid for text degradation", () => {
		const candidates = [
			{
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: "pages", value: { slug: "future" } } },
				children: [text],
			},
			{
				type: "link",
				fields: { linkType: "internal", doc: { relationTo: "posts", value: { slug: "article" } } },
				children: [text],
			},
			{ type: "link", fields: { linkType: "custom", url: "/kontakt" }, children: [text] },
			{ type: "link", fields: { linkType: "custom", url: "#sekcia" }, children: [text] },
			{ type: "link", fields: { linkType: "custom", url: "../kontakt" }, children: [text] },
		];

		for (const candidate of candidates) {
			expect(validateLexicalDocument(documentWith(candidate))).toEqual({ ok: true });
		}
	});

	it("also allows a null or missing supported relationship target to degrade", () => {
		for (const doc of [undefined, null, { relationTo: "pages", value: null }]) {
			const result = validateLexicalDocument(
				documentWith({ type: "link", fields: { linkType: "internal", doc }, children: [text] }),
			);
			expect(result).toEqual({ ok: true });
		}
	});
});

describe("findUnrenderableNode", () => {
	/** Wrap `children` in a document, the way a richText block carries one. */
	function doc(...children: Record<string, unknown>[]): LexicalDocument {
		return { root: { type: "root", children } } as unknown as LexicalDocument;
	}

	it("passes a tree made only of renderable nodes", () => {
		expect(
			findUnrenderableNode(
				doc(
					{ type: "heading", tag: "h2", children: [{ type: "text", text: "Nadpis" }] },
					{
						type: "paragraph",
						children: [
							{ type: "text", text: "Text" },
							{ type: "linebreak" },
							{ type: "autolink", fields: { url: "mailto:a@b.c" }, children: [] },
						],
					},
					{
						type: "list",
						listType: "bullet",
						children: [{ type: "listitem", children: [{ type: "text", text: "položka" }] }],
					},
				),
			),
		).toBeNull();
	});

	it("finds an unknown node that carries text", () => {
		expect(
			findUnrenderableNode(
				doc({ type: "someFutureNode", children: [{ type: "text", text: "Publikovaný odsek" }] }),
			),
		).toBe("someFutureNode");
	});

	it("finds an unknown node nested deep inside renderable ones", () => {
		expect(
			findUnrenderableNode(
				doc({
					type: "list",
					children: [
						{
							type: "listitem",
							children: [{ type: "table", children: [{ type: "text", text: "bunka" }] }],
						},
					],
				}),
			),
		).toBe("table");
	});

	it("finds an upload node, which has no text but is still published content", () => {
		expect(
			findUnrenderableNode(doc({ type: "upload", relationTo: "media", value: { url: "https://x/a.png" } })),
		).toBe("upload");
	});

	it("finds a block node carrying a fields payload", () => {
		expect(findUnrenderableNode(doc({ type: "block", fields: { blockType: "cta" } }))).toBe("block");
	});

	it("refuses a bare marker node too — v2 removed the inert exception", () => {
		// This used to pass. The old rule asked whether a node LOOKED like it carried
		// content and let a separator through; the v2 contract forbids that judgement
		// outright: „Neznámy node sa nesmie automaticky považovať za inertný len preto, že
		// nemá známe textové pole." `horizontalrule` is itself outside the v2 allowlist now.
		expect(findUnrenderableNode(doc({ type: "horizontalrule", version: 1 }))).toBe("horizontalrule");
		expect(findUnrenderableNode(doc({ type: "tab", version: 1 }))).toBe("tab");
	});

	it("refuses an unknown node whose only text is whitespace", () => {
		// The old rule read this as an indentation artefact and let it through. The type is
		// what decides now, not a guess about where the content might be hiding — the
		// failure that guess protects against is a page taken down by a stray node, and the
		// failure it causes is published content rendered as if it were not there.
		expect(findUnrenderableNode(doc({ type: "someFutureNode", text: "   " }))).toBe("someFutureNode");
	});

	it("still accepts every node on the contract's allowlist", () => {
		// The tightening must not have narrowed the allowlist itself.
		for (const type of ["paragraph", "heading", "quote", "list", "listitem", "link", "autolink"]) {
			expect(findUnrenderableNode(doc({ type, children: [{ type: "text", text: "x" }] })), type).toBeNull();
		}
		expect(findUnrenderableNode(doc({ type: "linebreak" }))).toBeNull();
	});

	it("reports the FIRST offender, so the log names one thing to fix", () => {
		expect(
			findUnrenderableNode(
				doc(
					{ type: "upload", value: { url: "x" } },
					{ type: "table", children: [{ type: "text", text: "y" }] },
				),
			),
		).toBe("upload");
	});

	it("accepts an empty document", () => {
		expect(findUnrenderableNode(doc())).toBeNull();
	});

	it("keeps `root` in the renderable set, or every document would be rejected", () => {
		expect(RENDERABLE_NODE_TYPES.has("root")).toBe(true);
	});
});
