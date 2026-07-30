import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CmsBlocks } from "@/ui/components/cms/cms-blocks";
import { type LexicalDocument } from "./lexical";
import { isVisibleInMarket, marketForChannel, payloadLocaleForChannel } from "./markets";
import { parsePagesResponse } from "./page-schema";
import { parseCmsRevalidateEvent, tagsForCmsEvent } from "./revalidate-event";

/**
 * Conformance against the CMS provider's official contract pack.
 *
 * The fixtures under `__fixtures__/provider-v1/` are authored by `MakySto/maky-cms`
 * at commit `704381d` and vendored verbatim — see the PROVENANCE.md beside them. The
 * point of testing against them rather than against hand-written objects is that a
 * hand-written object records what this repository BELIEVES the CMS sends, and the
 * belief is exactly the thing that goes wrong.
 *
 * No network and no second checkout: the pack lives in the repository.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v1");

const manifest = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as {
	id: string;
	version: number;
	depth: number;
	locale: string;
	market: string;
	route: string;
	supportedBlocks: string[];
	previewSupported: boolean;
	fixtures: Record<string, string>;
};

function fixture(relativePath: string): unknown {
	return JSON.parse(readFileSync(join(PACK, relativePath), "utf8"));
}

describe("provider pack — integrity", () => {
	it("carries the contract identity the storefront was built against", () => {
		expect(manifest.id).toBe("storefront-cms-o-nas");
		expect(manifest.version).toBe(1);
		expect(manifest.depth).toBe(1);
		expect(manifest.locale).toBe("sk");
		expect(manifest.market).toBe("SK");
		expect(manifest.route).toBe("/sk/o-nas");
		expect(manifest.supportedBlocks).toEqual(["richText"]);
		expect(manifest.previewSupported).toBe(false);
	});

	it("lists thirteen fixtures", () => {
		expect(Object.keys(manifest.fixtures)).toHaveLength(13);
	});

	// The transfer from the provider VPS was checksum-verified once. This guards the
	// other failure: someone later edits a vendored fixture to make a test pass, and
	// the storefront quietly stops testing what the CMS actually sends.
	it.each(Object.entries(manifest.fixtures))("%s matches its recorded digest", (relativePath, expected) => {
		const digest = createHash("sha256")
			.update(readFileSync(join(PACK, relativePath)))
			.digest("hex");
		expect(`sha256:${digest}`).toBe(expected);
	});
});

describe("provider pack — the published document", () => {
	const response = fixture("fixtures/rest/page-o-nas.sk.published.depth-1.json");

	it("parses the real production response", () => {
		const result = parsePagesResponse(response);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.slug).toBe("o-nas");
		expect(result.page.layout.every((block) => block.blockType === "richText")).toBe(true);
	});

	it("renders to HTML with no unsupported-node fallout", () => {
		const result = parsePagesResponse(response);
		if (result.status !== "ok") throw new Error("fixture must parse");

		const html = renderToStaticMarkup(
			createElement(CmsBlocks, { blocks: result.page.layout, channel: "sk-eur", market: "SK" }),
		);
		expect(html).toContain("<p>");
		expect(html).not.toContain("undefined");
	});

	it("is visible in the SK market the pilot serves", () => {
		const result = parsePagesResponse(response);
		if (result.status !== "ok") throw new Error("fixture must parse");
		expect(isVisibleInMarket(result.page.markets, "SK")).toBe(true);
	});
});

describe("provider pack — authoritative absence", () => {
	it("reads docs:[] as empty, never as an error", () => {
		// `empty` is what makes the route 404 instead of reviving the bootstrap copy.
		expect(parsePagesResponse(fixture("fixtures/rest/page-empty.sk.json"))).toEqual({ status: "empty" });
	});

	it("keeps a CZ-only document out of the SK market", () => {
		const result = parsePagesResponse(fixture("fixtures/rest/page-market-excluded.sk.json"));
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		// The document is valid; it is the market rule that makes it absent here, and
		// the route turns that into a 404 rather than a fallback.
		expect(isVisibleInMarket(result.page.markets, "SK")).toBe(false);
		expect(isVisibleInMarket(result.page.markets, "CZ")).toBe(true);
	});
});

describe("provider pack — anonymous access stays published-only", () => {
	const observed = fixture("fixtures/rest/page-anonymous-draft-request.sk.json") as {
		request: { draft: boolean; payloadAuthorization: boolean };
		response: { docs: { _status: string }[] };
	};

	it("was recorded with draft=true forced on and no Payload Authorization", () => {
		expect(observed.request.draft).toBe(true);
		expect(observed.request.payloadAuthorization).toBe(false);
	});

	it("still returned only a published document", () => {
		// The Cloudflare Access service token opens the network boundary; it does not
		// grant Payload permissions. This fixture is the evidence.
		expect(observed.response.docs.every((doc) => doc._status === "published")).toBe(true);
	});
});

describe("provider pack — an unsupported block rejects the document", () => {
	it("refuses the whole candidate rather than rendering the richText around it", () => {
		// The pack's own prose describes the V1 behaviour as "skip and log". That is the
		// behaviour this hardening pass removed: the fixture's page would have rendered
		// its richText block and dropped `futureBlock` in silence. The fixture is kept
		// byte-identical because it IS the contract; the divergence is recorded in
		// PROVENANCE.md and is owned by the provider repository.
		const result = parsePagesResponse(fixture("fixtures/rest/page-unsupported-block.sk.json"));
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.blockType).toBe("futureBlock");
		expect(result.violation.slug).toBe("o-nas");
		expect(result.violation.documentId).toBe("fixture-unsupported-block");
	});
});

describe("provider pack — Lexical fixtures", () => {
	function render(document: LexicalDocument): string {
		const parsed = parsePagesResponse({
			docs: [
				{
					id: "fixture",
					title: "O nás",
					slug: "o-nas",
					layout: [{ blockType: "richText", markets: null, content: document }],
					markets: null,
					_status: "published",
				},
			],
		});
		if (parsed.status !== "ok") throw new Error(`fixture rejected: ${parsed.status}`);
		return renderToStaticMarkup(
			createElement(CmsBlocks, { blocks: parsed.page.layout, channel: "sk-eur", market: "SK" }),
		);
	}

	it("renders the observed production content", () => {
		const html = render(fixture("fixtures/lexical/o-nas.observed.json") as LexicalDocument);
		expect(html).toContain("<p>");
		expect(html).not.toContain("<script");
	});

	it("renders every node type the provider marks as supported", () => {
		const html = render(fixture("fixtures/lexical/supported-nodes.synthetic.json") as LexicalDocument);
		expect(html.length).toBeGreaterThan(0);
		expect(html).not.toContain("<script");
	});

	it("rejects the document containing the unsupported node, rather than dropping it", () => {
		const result = parsePagesResponse({
			docs: [
				{
					id: "fixture-unsupported-node",
					title: "O nás",
					slug: "o-nas",
					layout: [
						{
							blockType: "richText",
							markets: null,
							content: fixture("fixtures/lexical/unsupported-node.synthetic.json"),
						},
					],
					markets: null,
					_status: "published",
				},
			],
		});
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("someFutureNode");
	});
});

describe("provider pack — all five revalidation events", () => {
	const events = [
		["page-publish", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-update", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-unpublish", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-delete", ["cms:collection:pages", "cms:page:o-nas"]],
		// One request carries both slugs, so the old URL stops serving too.
		["page-slug-change", ["cms:collection:pages", "cms:page:o-spolocnosti", "cms:page:o-nas"]],
	] as const;

	it.each(events)("%s parses and derives the expected tags", (name, expectedTags) => {
		const parsed = parseCmsRevalidateEvent(fixture(`fixtures/revalidation/${name}.json`));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(tagsForCmsEvent(parsed.event)).toEqual(expectedTags);
	});

	it("covers every event name the pack ships — a new one must not pass unnoticed", () => {
		const names = events.map(([name]) => name);
		const packed = Object.keys(manifest.fixtures)
			.filter((path) => path.startsWith("fixtures/revalidation/"))
			.map((path) => path.replace("fixtures/revalidation/", "").replace(".json", ""));
		expect(new Set(packed)).toEqual(new Set(names));
	});
});

describe("provider pack — market and locale mapping", () => {
	it("maps the pilot route's channel to the manifest's market and locale", () => {
		expect(marketForChannel("sk-eur")).toBe(manifest.market);
		expect(payloadLocaleForChannel("sk-eur")).toBe(manifest.locale);
	});
});
