import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CmsBlocks } from "@/ui/components/cms/cms-blocks";
import { SUPPORTED_BLOCK_TYPES } from "./blocks";
import { isVisibleInMarket } from "./markets";
import { parsePagesResponse } from "./page-schema";

/**
 * The seven v2 blocks, against the provider's own fixtures.
 *
 * Three failure classes matter here and only two of them announce themselves:
 *
 *   1. an unsupported block or Lexical node    — rejects, loudly, and is tested below
 *   2. missing required content                — rejects, loudly, and is tested below
 *   3. a supported OPTIONAL text field the renderer never emits
 *
 * The third is invisible. `hero.subheading`, `cta.text`, `image.caption`,
 * `gallery.items[].caption` and `faq` answers are all optional, so a renderer that simply
 * forgets one produces a page that looks finished, passes every parser test, and quietly
 * drops something an editor wrote. That is the same shape as the bug this whole pilot was
 * built to prevent, one layer further in.
 *
 * So the central test here does not check structure. It collects every literal string the
 * fixture carries and asserts each one reaches the HTML.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v2");

const manifest = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as {
	supportedBlocks: string[];
	scenarios: Record<string, string>;
	expectations: {
		marketSKVisibleBlockIds: string[];
		marketSKExcludedBlockIds: string[];
	};
};

function fixture(relativePath: string): unknown {
	return JSON.parse(readFileSync(join(PACK, relativePath), "utf8"));
}

function scenario(name: string): unknown {
	const path = manifest.scenarios[name];
	if (!path) throw new Error(`no scenario named ${name}`);
	return fixture(path);
}

function render(response: unknown, market: "SK" | "CZ" = "SK"): string {
	const parsed = parsePagesResponse(response);
	if (parsed.status !== "ok") throw new Error(`expected ok, got ${parsed.status}`);
	return renderToStaticMarkup(
		createElement(CmsBlocks, { blocks: parsed.page.layout, channel: "sk-eur", market }),
	);
}

/**
 * The text a reader actually sees — tags and attributes removed.
 *
 * Matching against raw markup is not good enough, and this is not hypothetical: the
 * gallery fixture's caption "Strešný box" is a substring of its own image's alt text
 * "Strešný box na vozidle", so a renderer that dropped every caption still satisfied a
 * `toContain` on the HTML. A mutation found it. Attributes are not visible content, so
 * they do not count towards showing that content was rendered.
 */
function visibleText(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&#x27;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, " ");
}

/**
 * Every literal string a block carries that a reader is meant to see.
 *
 * Walks the raw fixture rather than the parsed block on purpose: the parsed shape is what
 * the implementation believes, and the point is to check that belief against what arrived.
 */
function visibleStrings(node: unknown, out: string[] = []): string[] {
	if (Array.isArray(node)) {
		for (const entry of node) visibleStrings(entry, out);
		return out;
	}
	if (typeof node !== "object" || node === null) return out;

	const record = node as Record<string, unknown>;
	for (const key of ["heading", "subheading", "caption", "text", "question", "label"]) {
		const value = record[key];
		// `text` on a Lexical node is the node's own content; both are reader-visible.
		if (typeof value === "string" && value.length > 0) out.push(value);
	}
	for (const value of Object.values(record)) visibleStrings(value, out);
	return out;
}

/**
 * The `alt` of every media object the page's own blocks carry.
 *
 * Stops at `reference`: a linked document's layout is somebody else's page, and its
 * pictures are not supposed to render here.
 */
function mediaAlts(response: unknown): string[] {
	const out: string[] = [];
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (typeof node !== "object" || node === null) return;
		const record = node as Record<string, unknown>;
		if (typeof record.mimeType === "string" && typeof record.alt === "string") out.push(record.alt);
		for (const [key, value] of Object.entries(record)) {
			if (key === "reference") continue;
			walk(value);
		}
	};
	walk((response as { docs?: [{ layout?: unknown }] }).docs?.[0]?.layout);
	return out;
}

/** Strings that belong to the asset library rather than the page. */
function isMediaOwnCaption(response: unknown, text: string): boolean {
	const seen: string[] = [];
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (typeof node !== "object" || node === null) return;
		const record = node as Record<string, unknown>;
		if (typeof record.mimeType === "string" && typeof record.caption === "string") {
			seen.push(record.caption);
		}
		Object.values(record).forEach(walk);
	};
	walk(response);
	return seen.includes(text);
}

describe("v2 blocks — the parser and the renderer agree on which types exist", () => {
	it("supports exactly the block types the manifest declares", () => {
		expect([...SUPPORTED_BLOCK_TYPES]).toEqual(manifest.supportedBlocks);
	});

	it("renders something for every one of them", () => {
		// The renderer's switch is exhaustive at compile time; this is the runtime half —
		// a case that returns nothing would compile and produce an empty section.
		for (const block of manifest.supportedBlocks) {
			const html = render(scenario(block));
			expect(html.length, `${block} rendered nothing`).toBeGreaterThan(0);
			expect(html, block).not.toContain("undefined");
		}
	});
});

describe("v2 blocks — every scenario parses, and nothing an editor wrote is dropped", () => {
	it.each(manifest.supportedBlocks)("%s parses as a valid candidate", (block) => {
		expect(parsePagesResponse(scenario(block)).status).toBe("ok");
	});

	it.each(manifest.supportedBlocks)("%s renders every visible string it carries", (block) => {
		const response = scenario(block);
		const html = render(response);

		const text = visibleText(html);
		for (const expected of visibleStrings(response)) {
			// The media object's own caption is deliberately not surfaced: it belongs to the
			// asset, would repeat on every page reusing the picture, and the block carries
			// its own editorial caption.
			if (isMediaOwnCaption(response, expected)) continue;
			expect(text, `${block} dropped: ${expected}`).toContain(expected);
		}
	});

	it.each(["hero", "image", "gallery", "mediaText"])("%s renders one image per media object", (block) => {
		// Derived from the fixture, not from the output. The earlier version of this test
		// iterated over the alts it FOUND in the html, so a renderer that emitted no images
		// at all iterated zero times and passed. Counting against the fixture is the only
		// version that fails when a picture disappears — which is the failure hero used to
		// have, because it was the one media path that dropped an unusable object silently.
		const response = scenario(block);
		const expectedAlts = mediaAlts(response);
		expect(expectedAlts.length, `${block} fixture carries no media`).toBeGreaterThan(0);

		const html = render(response);
		const alts = [...html.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]);
		expect(alts.length, `${block} rendered ${alts.length} images for ${expectedAlts.length} media`).toBe(
			expectedAlts.length,
		);
		for (const alt of expectedAlts) {
			expect(alts, `${block} lost the image with alt: ${alt}`).toContain(alt);
			expect(alt, `${block} has an empty alt`).not.toBe("");
		}
	});

	it("rejects the candidate when a hero image arrives unusable, rather than dropping it", () => {
		// The other three media blocks already rejected; hero assigned the reader's `null`
		// straight through, so an image with no alt vanished from a page that still looked
		// finished. `blocks.ts` logs nothing, so there was not even a line to grep for.
		const response = scenario("hero") as { docs: [{ layout: [Record<string, unknown>] }] };
		const media = response.docs[0].layout[0].media as Record<string, unknown>;
		response.docs[0].layout[0].media = { ...media, alt: "" };

		const result = parsePagesResponse(response);
		expect(result.status).toBe("invalid");
	});

	it("still accepts a hero with no media relationship at all", () => {
		// The distinction that makes the rejection above safe: at depth=0 the relationship
		// arrives as a bare id string, and "not expanded" is not "broken".
		const response = scenario("hero") as { docs: [{ layout: [Record<string, unknown>] }] };
		response.docs[0].layout[0].media = "018f1000-0000-7000-8000-000000000101";

		expect(parsePagesResponse(response).status).toBe("ok");
	});
});

describe("v2 blocks — the fail-closed rule still covers everything", () => {
	it("rejects a document with an unsupported block, naming the type", () => {
		// The fixture puts `futureEditorial` BETWEEN two supported blocks, one of which is a
		// cta the renderer now handles. Asserting only `invalid` would stop testing the
		// right thing the moment every other block in the fixture became renderable.
		const result = parsePagesResponse(
			fixture("fixtures/rest/page-unsupported-block-between-supported.sk.json"),
		);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.blockType).toBe("futureEditorial");
	});

	it("rejects a document with an unsupported Lexical node", () => {
		const result = parsePagesResponse(fixture("fixtures/rest/page-unsupported-lexical-node.sk.json"));
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("futureDisclosure");
	});

	it("validates the Lexical inside faq answers and mediaText, not only richText", () => {
		// Three blocks carry Lexical now. A parser that only checked `richText.content`
		// would leave an FAQ answer free to contain anything, and a truncated answer is
		// exactly the silent partial render the rule exists to stop.
		for (const [block, mutate] of [
			[
				"faq",
				(doc: Record<string, unknown>) => {
					const items = doc.items as Record<string, unknown>[];
					const answer = items[0]!.answer as { root: { children: unknown[] } };
					answer.root.children.push({ type: "futureThing", children: [{ type: "text", text: "x" }] });
				},
			],
			[
				"mediaText",
				(doc: Record<string, unknown>) => {
					const content = doc.content as { root: { children: unknown[] } };
					content.root.children.push({ type: "futureThing", children: [{ type: "text", text: "x" }] });
				},
			],
		] as const) {
			const response = JSON.parse(JSON.stringify(scenario(block))) as {
				docs: { layout: Record<string, unknown>[] }[];
			};
			const target = response.docs[0]!.layout.find((b) => b.blockType === block);
			mutate(target!);
			const result = parsePagesResponse(response);
			expect(result.status, block).toBe("invalid");
			if (result.status !== "invalid") continue;
			expect(result.violation.nodeType, block).toBe("futureThing");
		}
	});
});

describe("v2 blocks — market filtering, exactly as the manifest expects", () => {
	const response = fixture("fixtures/rest/page-block-markets.sk.published.depth-1.json");

	it("keeps the blocks the manifest says an SK visitor sees", () => {
		const parsed = parsePagesResponse(response);
		expect(parsed.status).toBe("ok");
		if (parsed.status !== "ok") return;

		const visible = parsed.page.layout
			.filter((block) => isVisibleInMarket(block.markets, "SK"))
			.map((block) => block.id);
		expect(visible).toEqual(manifest.expectations.marketSKVisibleBlockIds);
	});

	it("hides the one it says is excluded", () => {
		const parsed = parsePagesResponse(response);
		if (parsed.status !== "ok") throw new Error("fixture must parse");
		for (const excluded of manifest.expectations.marketSKExcludedBlockIds) {
			const block = parsed.page.layout.find((b) => b.id === excluded);
			expect(block, excluded).toBeTruthy();
			expect(isVisibleInMarket(block!.markets, "SK"), excluded).toBe(false);
		}
	});

	it("actually withholds the hidden block from the html, in both directions", () => {
		// The two tests above assert the manifest against `isVisibleInMarket`, a pure
		// function. Neither of them touches the line in `CmsBlocks` that calls it: deleting
		// that filter left the whole suite green while every market-hidden block started
		// rendering to visitors of the wrong market. This is the test that fails.
		// The link labels, not the headings: „Viditeľné pre SK" is a substring of
		// „Viditeľné pre SK aj CZ", so the heading cannot tell the SK-only block from the
		// one both markets keep, and the test would pass for the wrong reason.
		const skOnly = "SK kontakt";
		const czOnly = "CZ-only otázka";

		const sk = visibleText(render(response, "SK"));
		expect(sk).toContain(skOnly);
		expect(sk).not.toContain(czOnly);

		const cz = visibleText(render(response, "CZ"));
		expect(cz).toContain(czOnly);
		expect(cz).not.toContain(skOnly);

		// Both markets keep the blocks that name neither of them.
		for (const html of [sk, cz]) expect(html).toContain("Spoločný obsah");
	});

	it("validates hidden blocks too — stricter than the contract requires, deliberately", () => {
		// The contract says the consumer validates the market-filtered candidate. This
		// validates everything, so a block only CZ visitors see still has to be renderable.
		// Kept because a document that is broken for another market is broken, and finding
		// out when that market opens is worse than finding out now.
		const parsed = parsePagesResponse(response);
		expect(parsed.status).toBe("ok");
	});
});

describe("v2 blocks — a link with nowhere to go", () => {
	const response = fixture("fixtures/rest/page-null-relationships.sk.published.depth-1.json");

	it("parses rather than rejecting", () => {
		// `missingOrNullRelationship: do-not-derive-route` — a degrade, not a rejection.
		expect(parsePagesResponse(response).status).toBe("ok");
	});

	it("renders the label but never invents an href", () => {
		const html = render(response);
		const parsed = parsePagesResponse(response);
		if (parsed.status !== "ok") throw new Error("fixture must parse");

		const labels = parsed.page.layout.flatMap((block) =>
			"links" in block ? block.links.filter((l) => l.target.kind === "none").map((l) => l.label) : [],
		);
		expect(labels.length).toBeGreaterThan(0);

		for (const label of labels) {
			expect(html).toContain(label);
			// The label is present, and not inside an anchor.
			expect(html).not.toMatch(
				new RegExp(`<a[^>]*>[^<]*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`),
			);
		}
	});

	it("treats a null reference and an absent one the same way", () => {
		// The fixture carries both: one link has `"reference": null`, the next has no
		// `reference` key at all. Two shapes, one meaning.
		const parsed = parsePagesResponse(response);
		if (parsed.status !== "ok") throw new Error("fixture must parse");
		const targets = parsed.page.layout.flatMap((block) =>
			"links" in block ? block.links.map((l) => l.target.kind) : [],
		);
		expect(targets.filter((k) => k === "none").length).toBeGreaterThanOrEqual(2);
	});
});

describe("v2 blocks — internal links get a market prefix", () => {
	const response = fixture("fixtures/rest/page-links.sk.published.depth-1.json");

	it("derives a route for a populated pages reference", () => {
		const html = render(response);
		// `marketHref` puts the channel's market segment in front; the parser never does.
		expect(html).toMatch(/href="\/sk\/[a-z0-9-]+"/);
	});

	it("renders a posts reference as text, because posts have no storefront route", () => {
		// This link used to emit `/sk/poradna/ako-vybrat-stresny-nosic`, which matches no
		// route — a hard 404 from a link the contract's own fixture ships.
		const html = render(response);
		expect(visibleText(html)).toContain("Článok v poradni");
		expect(html).not.toContain("ako-vybrat-stresny-nosic");
	});

	it("emits no href with two segments after the market prefix", () => {
		const hrefs = [...render(response).matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
		for (const href of hrefs) {
			if (!href.startsWith("/sk/")) continue;
			expect(href.slice("/sk/".length).split("/"), href).toHaveLength(1);
		}
	});

	it("rejects the candidate when a link points at a collection outside the contract", () => {
		// `brands` is the contract's named example: the Payload editor offers it, this
		// consumer contract does not. Degrading it to inert text would hide a link an
		// editor believed they had made — and the contract calls it a violation, not a
		// degrade, which is a different fact from a target that is simply gone.
		const broken = fixture("fixtures/rest/page-links.sk.published.depth-1.json") as {
			docs: [{ layout: [{ links: [{ reference: { relationTo: string } }] }] }];
		};
		broken.docs[0].layout[0].links[0].reference.relationTo = "brands";

		expect(parsePagesResponse(broken).status).toBe("invalid");
	});

	it("rejects a rich-text link whose relationship target is outside the contract", () => {
		const doc = {
			docs: [
				{
					id: "018f2000-0000-7000-8000-000000000999",
					title: "T",
					slug: "o-nas",
					markets: ["SK"],
					meta: { title: null, description: null, image: null },
					updatedAt: "2026-07-31T08:00:00.000Z",
					_status: "published",
					layout: [
						{
							id: "b1",
							blockType: "richText",
							markets: null,
							content: {
								root: {
									type: "root",
									children: [
										{
											type: "paragraph",
											children: [
												{
													type: "link",
													fields: {
														linkType: "internal",
														doc: { relationTo: "brands", value: { slug: "thule" } },
													},
													children: [{ type: "text", text: "Thule", format: 0 }],
												},
											],
										},
									],
								},
							},
						},
					],
				},
			],
		};

		expect(parsePagesResponse(doc).status).toBe("invalid");
	});
});
