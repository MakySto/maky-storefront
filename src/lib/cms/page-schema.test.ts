import { describe, expect, it } from "vitest";

import { parsePagesResponse } from "./page-schema";

/** A minimal valid Lexical document, shaped like the production content. */
const lexical = {
	root: {
		type: "root",
		format: "",
		indent: 0,
		version: 1,
		direction: null,
		children: [
			{
				type: "paragraph",
				format: "start",
				version: 1,
				children: [{ type: "text", text: "Ahoj", format: 0, version: 1 }],
			},
		],
	},
};

function published(overrides: Record<string, unknown> = {}) {
	return {
		docs: [
			{
				id: "019fb008-504b-779e-ad3f-1ff353267c88",
				title: "O nás",
				slug: "o-nas",
				summary: null,
				layout: [{ blockType: "richText", id: "6a6a80dd", markets: ["SK"], content: lexical }],
				markets: ["SK"],
				meta: { title: "O nás", description: "MAKY.STORE je slovenský…", image: null },
				updatedAt: "2026-07-29T22:46:10.035Z",
				_status: "published",
				...overrides,
			},
		],
		totalDocs: 1,
	};
}

describe("parsePagesResponse — the three outcomes", () => {
	it("accepts the real production response shape", () => {
		const result = parsePagesResponse(published());
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.slug).toBe("o-nas");
		expect(result.page.title).toBe("O nás");
		expect(result.page.markets).toEqual(["SK"]);
		expect(result.page.meta.title).toBe("O nás");
		expect(result.page.layout).toHaveLength(1);
		expect(result.page.layout[0]?.blockType).toBe("richText");
	});

	it("reports an empty result set as authoritative, not as an error", () => {
		// This distinction is the whole point: `empty` must never revive a stale fallback.
		expect(parsePagesResponse({ docs: [], totalDocs: 0 })).toEqual({ status: "empty" });
	});

	it("reports a broken envelope as invalid", () => {
		expect(parsePagesResponse(null).status).toBe("invalid");
		expect(parsePagesResponse("nope").status).toBe("invalid");
		expect(parsePagesResponse({}).status).toBe("invalid");
		expect(parsePagesResponse({ docs: "not-an-array" }).status).toBe("invalid");
		expect(parsePagesResponse({ docs: [null] }).status).toBe("invalid");
	});
});

describe("parsePagesResponse — draft refusal", () => {
	it("refuses a draft even though the query filters for published", () => {
		const result = parsePagesResponse(published({ _status: "draft" }));
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.reason).toContain("not published");
	});

	it("refuses a document with no status at all", () => {
		expect(parsePagesResponse(published({ _status: undefined })).status).toBe("invalid");
	});
});

describe("parsePagesResponse — required fields", () => {
	it.each(["id", "title", "slug"])("refuses a document missing %s", (field) => {
		expect(parsePagesResponse(published({ [field]: undefined })).status).toBe("invalid");
	});

	it("refuses a non-array layout", () => {
		expect(parsePagesResponse(published({ layout: {} })).status).toBe("invalid");
	});

	it("accepts an empty layout — a published page may legitimately have no blocks", () => {
		const result = parsePagesResponse(published({ layout: [] }));
		expect(result.status).toBe("ok");
	});

	it("accepts markets as null, meaning all markets", () => {
		const result = parsePagesResponse(published({ markets: null }));
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.markets).toBeNull();
	});

	it("refuses markets that are neither null nor string[]", () => {
		expect(parsePagesResponse(published({ markets: [1, 2] })).status).toBe("invalid");
		expect(parsePagesResponse(published({ markets: "SK" })).status).toBe("invalid");
	});
});

describe("parsePagesResponse — an unsupported block rejects the whole document", () => {
	it("refuses the document rather than rendering the supported blocks around the gap", () => {
		// The behaviour this replaces returned status "ok" with the bannerGrid marked
		// unsupported, and the renderer dropped it. The page looked complete, the
		// publish reported success, and nobody found out.
		const result = parsePagesResponse(
			published({
				layout: [
					{ blockType: "richText", content: lexical, markets: null },
					{ blockType: "bannerGrid", markets: null },
				],
			}),
		);
		expect(result.status).toBe("invalid");
	});

	it("names the document and the offending block type, so the log can be acted on", () => {
		const result = parsePagesResponse(published({ layout: [{ blockType: "bannerGrid", markets: null }] }));
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.blockType).toBe("bannerGrid");
		expect(result.violation.documentId).toBe("019fb008-504b-779e-ad3f-1ff353267c88");
		expect(result.violation.slug).toBe("o-nas");
		expect(result.violation.nodeType).toBeNull();
	});

	it("treats a KNOWN block with a malformed payload as a contract break too", () => {
		// Dropping this quietly would mean rendering a page we claim supports richText
		// while omitting its only paragraph.
		const result = parsePagesResponse(
			published({ layout: [{ blockType: "richText", content: { notRoot: true } }] }),
		);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.reason).toContain("richText");
		// Not an unsupported block type — the type was fine, the payload was not.
		expect(result.violation.blockType).toBeNull();
	});

	it("refuses a block with no blockType", () => {
		expect(parsePagesResponse(published({ layout: [{ content: lexical }] })).status).toBe("invalid");
	});

	it("refuses a block whose markets field is malformed", () => {
		expect(
			parsePagesResponse(published({ layout: [{ blockType: "richText", content: lexical, markets: 7 }] }))
				.status,
		).toBe("invalid");
	});
});

describe("parsePagesResponse — an unrenderable Lexical node rejects the document", () => {
	/** A richText block whose paragraph contains `node`. */
	function withNode(node: Record<string, unknown>) {
		return published({
			layout: [
				{
					blockType: "richText",
					markets: null,
					content: {
						root: {
							type: "root",
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", text: "Pred", format: 0 }, node],
								},
							],
						},
					},
				},
			],
		});
	}

	it("refuses a node that carries text, naming the node type", () => {
		const result = parsePagesResponse(
			withNode({ type: "someFutureNode", children: [{ type: "text", text: "Stratený odsek", format: 0 }] }),
		);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("someFutureNode");
		expect(result.violation.slug).toBe("o-nas");
		expect(result.violation.blockType).toBeNull();
	});

	it("refuses an upload node, which carries an image and no text at all", () => {
		// The reason the rule is "content-bearing" and not "text-bearing": a published
		// photograph has no text to detect, and would otherwise vanish in silence.
		const result = parsePagesResponse(
			withNode({ type: "upload", relationTo: "media", value: { url: "https://x/a.png" } }),
		);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("upload");
	});

	it("accepts an inert marker node — skipping a separator loses no content", () => {
		const result = parsePagesResponse(withNode({ type: "horizontalrule", version: 1 }));
		expect(result.status).toBe("ok");
	});

	it("accepts the node types the renderer handles", () => {
		const result = parsePagesResponse(
			withNode({ type: "link", fields: { url: "https://maky.store" }, children: [] }),
		);
		expect(result.status).toBe("ok");
	});
});

describe("parsePagesResponse — meta", () => {
	it("tolerates a missing meta object", () => {
		const result = parsePagesResponse(published({ meta: undefined }));
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.meta).toEqual({ title: null, description: null, image: null });
	});

	it("reads a populated absolute image url", () => {
		const result = parsePagesResponse(
			published({ meta: { title: "T", image: { url: "https://cms-media.maky.store/a.png" } } }),
		);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.meta.image).toBe("https://cms-media.maky.store/a.png");
	});

	it("ignores an unpopulated image relationship", () => {
		const result = parsePagesResponse(published({ meta: { image: "019fb008" } }));
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.meta.image).toBeNull();
	});
});
