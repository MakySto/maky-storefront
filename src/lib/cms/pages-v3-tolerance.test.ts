import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { namespace: string }) => {
		const namespace = typeof arg === "string" ? arg : arg.namespace;
		const file = join(dirname(fileURLToPath(import.meta.url)), "../../i18n/messages/sk-SK.json");
		const messages = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>;
		return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
	},
}));

import { parsePagesResponse } from "./page-schema";

/**
 * Pages contract v3 §1 (`__fixtures__/provider-v3/pages-content.md`): a block the storefront
 * cannot render is skipped on an editorial page and refuses a legal one — and the checks
 * that decide "cannot render" are exactly as strict as before.
 */

const SECRET_WORDS = "OBSAH-BLOKU-KTORY-SA-NESMIE-LOGOVAT";

const paragraph = (text: string) => ({
	root: {
		type: "root",
		format: "",
		indent: 0,
		version: 1,
		children: [
			{
				type: "paragraph",
				format: "",
				indent: 0,
				version: 1,
				children: [{ type: "text", text, format: 0, detail: 0, mode: "normal", style: "", version: 1 }],
			},
		],
	},
});

const media = (overrides: Record<string, unknown> = {}) => ({
	id: "018f1000-0000-7000-8000-000000000103",
	alt: "Detail strešného nosiča",
	url: "https://cms-media.maky.store/media/provider-v3/rack.webp",
	mimeType: "image/webp",
	width: 2400,
	height: 1600,
	...overrides,
});

const richText = (text: string, extra: Record<string, unknown> = {}) => ({
	blockType: "richText",
	markets: null,
	content: paragraph(text),
	...extra,
});

const image = { blockType: "image", markets: null, media: media(), caption: null };

function page(layout: unknown[], overrides: Record<string, unknown> = {}) {
	return {
		docs: [
			{
				id: "019fb008-504b-779e-ad3f-1ff353267c88",
				title: "Poradňa",
				slug: "poradna",
				summary: null,
				layout,
				markets: null,
				meta: null,
				updatedAt: "2026-09-26T07:59:58.412Z",
				_status: "published",
				...overrides,
			},
		],
	};
}

const legal = { legalMetadata: { documentType: "legal", legalVersion: "1.0", effectiveFrom: null } };

/** Every way a block can fail validation that pages-content.md §1 names, one each. */
const BROKEN_BLOCKS: [string, unknown, { blockType: string | null; nodeType: string | null }][] = [
	[
		"an unsupported blockType",
		{ blockType: "bannerGrid", markets: null },
		{ blockType: "bannerGrid", nodeType: null },
	],
	[
		"an unknown Lexical node",
		{
			blockType: "richText",
			markets: null,
			content: {
				root: {
					type: "root",
					children: [
						{ type: "futureDisclosure", children: [{ type: "text", text: SECRET_WORDS, format: 0 }] },
					],
				},
			},
		},
		{ blockType: "richText", nodeType: "futureDisclosure" },
	],
	[
		"a disallowed link URL",
		{
			blockType: "cta",
			markets: null,
			heading: SECRET_WORDS,
			links: [{ type: "custom", label: "Klik", url: "javascript:alert(1)" }],
		},
		{ blockType: "cta", nodeType: null },
	],
	[
		"a missing required field",
		{ blockType: "hero", markets: null, heading: null },
		{ blockType: "hero", nodeType: null },
	],
	[
		"media without alt text",
		{ blockType: "image", markets: null, media: media({ alt: "" }), caption: SECRET_WORDS },
		{ blockType: "image", nodeType: null },
	],
	[
		"media from outside the approved origin",
		{ blockType: "image", markets: null, media: media({ url: "https://images.example.com/media/a.webp" }) },
		{ blockType: "image", nodeType: null },
	],
	[
		"an unknown market",
		{ ...richText(SECRET_WORDS), markets: ["XX"] },
		{ blockType: "richText", nodeType: null },
	],
	["a block that is not an object", "richText", { blockType: null, nodeType: null }],
];

describe("pages v3 — an editorial page skips a broken block and renders the rest", () => {
	it.each(BROKEN_BLOCKS)("skips %s, reporting it without its content", (_label, broken, expected) => {
		const result = parsePagesResponse(page([richText("Prvý odsek"), broken, richText("Druhý odsek")]), "SK");
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.layout).toHaveLength(2);

		const skipped = result.warnings.filter((warning) => warning.code === "block-skipped");
		expect(skipped).toEqual([
			{ code: "block-skipped", index: 1, ...expected, reason: expect.stringContaining("layout[1]") },
		]);
		// The diagnostic names the block; it never carries what the block says.
		expect(JSON.stringify(result.warnings)).not.toContain(SECRET_WORDS);
	});

	it.each(BROKEN_BLOCKS)("refuses a legal page with %s", (_label, broken) => {
		const result = parsePagesResponse(page([richText("Prvý odsek"), broken], legal), "SK");
		expect(result.status).toBe("invalid");
	});

	it("never renders a skipped block's content", () => {
		for (const [label, broken] of BROKEN_BLOCKS) {
			const result = parsePagesResponse(page([richText("Prvý odsek"), broken]), "SK");
			if (result.status !== "ok") throw new Error(label);
			expect(JSON.stringify(result.page), label).not.toContain(SECRET_WORDS);
		}
	});

	it("is invalid, never an empty success, when every visible block was skipped", () => {
		const result = parsePagesResponse(
			page([{ blockType: "bannerGrid", markets: null }, BROKEN_BLOCKS[1]![1]]),
		);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		// The first skip identifies the violation, so the error log can still be acted on.
		expect(result.violation.blockType).toBe("bannerGrid");
		expect(result.violation.reason).toContain("2 block(s) skipped");
	});

	it("does not count a block hidden from this market as skipped", () => {
		const result = parsePagesResponse(
			page([richText("Spoločný"), { blockType: "bannerGrid", markets: ["CZ"] }]),
			"SK",
		);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.warnings).toEqual([]);
	});

	it("keeps an authoritative empty layout an ordinary ok — only skipping can make emptiness invalid", () => {
		expect(parsePagesResponse(page([]), "SK").status).toBe("ok");
	});

	it("does not let a skipped body turn o-nas into an authoritative absence", () => {
		// `o-nas` requires a rich-text body (content-readiness). If skipping takes it away and
		// an image survives, "found but not ready" would 404 the About page; v3's safe fallback
		// makes it invalid instead, so the route serves its bootstrap.
		const broken = BROKEN_BLOCKS[1]![1];
		const aboutPage = parsePagesResponse(page([broken, image], { slug: "o-nas", title: "O nás" }), "SK");
		expect(aboutPage.status).toBe("invalid");

		// A page without a body contract keeps what survived.
		const advice = parsePagesResponse(page([broken, image]), "SK");
		expect(advice.status).toBe("ok");
	});
});

describe("pages v3 — drafts are admitted only where the caller asks for them", () => {
	it("refuses a draft by default", () => {
		expect(parsePagesResponse(page([richText("x")], { _status: "draft" })).status).toBe("invalid");
	});

	it("admits a draft for the preview path", () => {
		const result = parsePagesResponse(page([richText("x")], { _status: "draft" }), "SK", {
			allowDraft: true,
		});
		expect(result.status).toBe("ok");
	});

	it("still refuses anything that is neither published nor draft", () => {
		for (const status of ["changed", undefined, "archived"]) {
			const result = parsePagesResponse(page([richText("x")], { _status: status }), "SK", {
				allowDraft: true,
			});
			expect(result.status, String(status)).toBe("invalid");
		}
	});
});

describe("pages v3 — the storefront logs a skip as `[cms] block-skipped`", () => {
	const json = (body: unknown) => async () =>
		new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test");
		vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "fake-access-id");
		vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "fake-access-secret");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("one structured line per skipped block, with ids and reasons, never content", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.stubGlobal("fetch", vi.fn(json(page([richText("Zostáva"), BROKEN_BLOCKS[1]![1]]))));

		const { fetchCmsPage } = await import("./client");
		const outcome = await fetchCmsPage("poradna", "sk", "SK");
		expect(outcome.status).toBe("found");

		const lines = warn.mock.calls.filter(([event]) => event === "[cms] block-skipped");
		expect(lines).toHaveLength(1);
		expect(JSON.parse(String(lines[0]![1]))).toEqual({
			documentId: "019fb008-504b-779e-ad3f-1ff353267c88",
			slug: "poradna",
			locale: "sk",
			index: 1,
			blockType: "richText",
			nodeType: "futureDisclosure",
			reason: expect.stringContaining("futureDisclosure"),
		});
		expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET_WORDS);
	});

	it("renders the surviving blocks on the route, not the bootstrap", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.stubGlobal(
			"fetch",
			vi.fn(
				json(page([richText("CMS-ODSEK-ZOSTAVA"), BROKEN_BLOCKS[1]![1]], { slug: "o-nas", title: "O nás" })),
			),
		);

		const { default: Page } = (await import("@/app/[channel]/(main)/o-nas/page")) as {
			default: (props: { params: Promise<{ channel: string }> }) => Promise<React.ReactElement>;
		};
		const stream = await renderToReadableStream(
			await Page({ params: Promise.resolve({ channel: "sk-eur" }) }),
		);
		await stream.allReady;
		const html = await new Response(stream).text();

		expect(html).toContain("CMS-ODSEK-ZOSTAVA");
		expect(html).not.toContain(SECRET_WORDS);
		// Not the fallback: no contract violation was logged.
		expect(error.mock.calls.map(([event]) => event)).not.toContain("[cms] contract-violation");
	});
});
