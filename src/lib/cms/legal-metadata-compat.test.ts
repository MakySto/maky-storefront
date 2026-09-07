import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `client.ts` and `env.ts` import "server-only", which throws outside a react-server
// graph. Same stub as `to-typed-document.test.ts`.
vi.mock("server-only", () => ({}));

import { CmsBlocks } from "@/ui/components/cms/cms-blocks";
import { isVisibleInMarket, marketForChannel, payloadLocaleForChannel } from "./markets";
import { parsePagesResponse, type CmsPageParse } from "./page-schema";
import { parseCmsRevalidateEvent, tagsForCmsEvent } from "./revalidate-event";

/**
 * Compatibility gate: the additive `legalMetadata` group must not trip the fail-closed rule.
 *
 * The Payload Forms migration adds an optional group to every Page document:
 *
 *     "legalMetadata": { "documentType": "editorial", "legalVersion": null, "effectiveFrom": null }
 *
 * It is inert — the pilot serves editorial content and reads `richText` blocks only. But
 * the storefront rejects an ENTIRE candidate document on anything it cannot render
 * faithfully (`page-schema.ts`), and an over-eager version of that rule would take
 * `/sk/o-nas` back to its bootstrap copy the moment the CMS migration lands. Payload has
 * no way to find that out; this file is where the storefront proves it will not happen.
 *
 * The tolerance is deliberately NARROW. Nothing here relaxes validation: the last
 * describe block re-runs the fail-closed rules with the group present and shows they
 * still bite. The group is accepted the same way `createdAt` and `hasNextPage` already
 * are — by being read past, not by a new exemption and not by a blanket "ignore unknown
 * fields" — and the parsed `CmsPage` still has exactly its eight fields, so nothing
 * arbitrary is passed through to the renderer.
 *
 * Everything is measured against the fixture pair, so none of it rests on a hand-written
 * guess at what Payload sends:
 *
 *   provider-v1/…/page-o-nas.sk.published.depth-1.json   vendored provider recording
 *   forward-compat/…legal-metadata.json                  the same document + the group
 *
 * "Provider recording", not "the live page": the base fixture has four paragraphs and no
 * company block, while commit `1e62961` found five and an `info@maky.store` autolink in
 * the live document. See the README beside the augmented fixture. It makes no difference
 * to this gate — the question here is what the PARSER does with an added field, and both
 * fixtures go through the same parser — but the distinction should not be blurred.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));

const VENDORED_PATH = "__fixtures__/provider-v1/fixtures/rest/page-o-nas.sk.published.depth-1.json";
const AUGMENTED_PATH = "__fixtures__/forward-compat/page-o-nas.sk.published.legal-metadata.json";

/** The group exactly as the Payload Forms migration emits it for an editorial page. */
const LEGAL_METADATA_GROUP = {
	documentType: "editorial",
	legalVersion: null,
	effectiveFrom: null,
} as const;

/** Every field of `CmsPage`. If this list changes, something started passing through. */
const CMS_PAGE_FIELDS = ["id", "layout", "markets", "meta", "slug", "summary", "title", "updatedAt"];

/**
 * Phrases that tell the two bodies apart.
 *
 * `client.ts` warns that the CMS copy and the bootstrap copy become byte-identical once
 * the duplicate company paragraph is cleaned out of Payload, which would make any
 * HTML-level discriminator useless. Against the vendored response that is not the case
 * today — three of its four paragraphs are shortened rewrites of the JSX — and it cannot
 * become the case here either, because these assertions run against a FROZEN fixture. What
 * an editor does in Payload cannot change them. The durable discriminator in production is
 * still the `[cms] served` log line, which is asserted separately and does not depend on
 * the two bodies differing at all.
 */
const CMS_ONLY_PHRASE = "kompatibilitu a zrozumiteľné informácie";
const BOOTSTRAP_ONLY_PHRASE = "obyčajnému dobrému víkendu";

interface WirePage {
	docs: Record<string, unknown>[];
	[key: string]: unknown;
}

function read(relativePath: string): WirePage {
	return JSON.parse(readFileSync(join(HERE, relativePath), "utf8")) as WirePage;
}

const vendored = () => read(VENDORED_PATH);
const augmented = () => read(AUGMENTED_PATH);

function renderBlocks(parsed: CmsPageParse): string {
	if (parsed.status !== "ok") throw new Error(`expected a valid candidate, got ${parsed.status}`);
	return renderToStaticMarkup(
		createElement(CmsBlocks, { blocks: parsed.page.layout, channel: "sk-eur", market: "SK" }),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("legalMetadata — the fixture is the vendored document plus exactly one group", () => {
	// Without this, the gate could pass against a document nobody has ever received, and
	// would prove nothing about the CMS. The derivation is enforced, not asserted in prose.
	it("adds the group the Payload Forms migration will send", () => {
		expect(augmented().docs[0]?.legalMetadata).toEqual(LEGAL_METADATA_GROUP);
	});

	it("changes nothing else about the vendored production response", () => {
		const stripped = augmented();
		delete stripped.docs[0]!.legalMetadata;
		expect(stripped).toEqual(vendored());
	});

	it("tests something new — the vendored response does not already carry the group", () => {
		expect(vendored().docs[0]).not.toHaveProperty("legalMetadata");
	});
});

describe("legalMetadata — the candidate stays valid", () => {
	it("parses as ok rather than as a contract violation", () => {
		const result = parsePagesResponse(augmented());
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.page.slug).toBe("o-nas");
		expect(result.page.layout).toHaveLength(1);
	});

	it("produces a CmsPage indistinguishable from the one parsed without the group", () => {
		// The strongest available statement of "ignored": not merely tolerated, but absent
		// from the output. Nothing downstream can behave differently because of the group,
		// because nothing downstream can see it.
		expect(parsePagesResponse(augmented())).toEqual(parsePagesResponse(vendored()));
	});

	it("keeps the group out of the domain object entirely", () => {
		const result = parsePagesResponse(augmented());
		if (result.status !== "ok") throw new Error("fixture must parse");
		expect(Object.keys(result.page).sort()).toEqual(CMS_PAGE_FIELDS);
		expect(result.page).not.toHaveProperty("legalMetadata");
		const serialized = JSON.stringify(result.page);
		expect(serialized).not.toContain("legalMetadata");
		expect(serialized).not.toContain("editorial");
	});

	it("is not a new exemption — unread wire fields were always read past", () => {
		// `createdAt`, `hasNextPage`, `totalDocs` and the rest have been arriving and being
		// ignored since the pilot shipped. `legalMetadata` joins them; the parser gained no
		// special case, and none was needed.
		expect(vendored().docs[0]).toHaveProperty("createdAt");
		const result = parsePagesResponse(vendored());
		if (result.status !== "ok") throw new Error("fixture must parse");
		expect(result.page).not.toHaveProperty("createdAt");
	});

	it("passes nothing arbitrary through — an unrelated unknown field is dropped too", () => {
		// Guards the other direction: acceptance must not become a passthrough. A junk
		// top-level key changes the parsed page not at all.
		const junk = augmented();
		junk.docs[0]!.somethingNobodyDeclared = { nested: ["values"] };
		const result = parsePagesResponse(junk);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(Object.keys(result.page).sort()).toEqual(CMS_PAGE_FIELDS);
		expect(JSON.stringify(result.page)).not.toContain("somethingNobodyDeclared");
	});
});

/**
 * What is tolerated is the FIELD, not the one literal the fixture happens to carry.
 *
 * `/sk/o-nas` is editorial, so its group is `editorial / null / null`. A legal page —
 * `/obchodne-podmienky` and the rest, which M.2 brings into the CMS — sends a populated
 * one. Pinning only the editorial literal would leave the gate green on the day the first
 * populated group arrives and prove nothing about it, which is the failure this whole file
 * exists to prevent, one level up.
 */
describe("legalMetadata — the field is tolerated, not one value of it", () => {
	function withGroup(value: unknown) {
		const doc = vendored();
		doc.docs[0]!.legalMetadata = value;
		return parsePagesResponse(doc);
	}

	const variants: [string, unknown][] = [
		["a populated legal group", { documentType: "legal", legalVersion: "1.2", effectiveFrom: "2026-08-04" }],
		["an explicit null", null],
		["an empty group", {}],
		// Not expected shapes — the point is that a malformed group cannot become a
		// rejection vector either. A field nobody reads cannot be malformed.
		["a string where a group was expected", "editorial"],
		["an array where a group was expected", ["editorial"]],
	];

	it.each(variants)("accepts %s and parses to the same page", (_name, value) => {
		const result = withGroup(value);
		expect(result.status).toBe("ok");
		expect(result).toEqual(parsePagesResponse(vendored()));
	});

	it("keeps a populated legal group out of the rendered markup", () => {
		const result = withGroup({
			documentType: "legal",
			legalVersion: "1.2",
			effectiveFrom: "2026-08-04",
		});
		const html = renderBlocks(result);
		expect(html).toBe(renderBlocks(parsePagesResponse(vendored())));
		for (const leak of ["legalMetadata", "legalVersion", "effectiveFrom", "2026-08-04", "1.2"]) {
			expect(html).not.toContain(leak);
		}
	});
});

/**
 * The one place the "rebuilt from named parts" summary is not the whole truth.
 *
 * `content` is passed through whole — a Lexical tree is not something this layer can
 * usefully rebuild — so a key sitting inside a rich-text value really does reach the block
 * object, unlike every other unnamed field. It is never read and never emitted, because
 * the renderer switches on `node.type` and reads named props, and the walk that rejects
 * things descends only through `children` arrays of objects with a string `type`. That is
 * a claim about two files agreeing, which is exactly the kind that rots, so it is pinned.
 */
describe("legalMetadata — even inside a rich-text value it stays invisible", () => {
	const populated = { documentType: "legal", legalVersion: "1.2", effectiveFrom: "2026-08-04" };

	function renderWith(mutate: (block: Record<string, unknown>) => void): string {
		const doc = vendored();
		mutate((doc.docs[0]!.layout as Record<string, unknown>[])[0]!);
		const parsed = parsePagesResponse(doc);
		expect(parsed.status).toBe("ok");
		return renderBlocks(parsed);
	}

	const placements: [string, (block: Record<string, unknown>) => void][] = [
		[
			"as a sibling of root inside the rich-text value",
			(block) => {
				(block.content as Record<string, unknown>).legalMetadata = populated;
			},
		],
		[
			"as a property of the root Lexical node",
			(block) => {
				((block.content as Record<string, unknown>).root as Record<string, unknown>).legalMetadata =
					populated;
			},
		],
		[
			"as a property of the first paragraph node",
			(block) => {
				const root = (block.content as Record<string, unknown>).root as { children: unknown[] };
				(root.children[0] as Record<string, unknown>).legalMetadata = populated;
			},
		],
	];

	it("REFUSES the document if the group ever arrives as a Lexical node", () => {
		// This case used to pass as a no-op: v1 judged a node with no known text field
		// inert and let it through. The v2 contract removed that judgement, so the same
		// placement now rejects the whole candidate — and that is the better answer. A
		// group field on the document is inert and must be ignored; the same name appearing
		// as a NODE inside published content is something the storefront does not know how
		// to render, and rendering the page without it would be a silent omission.
		//
		// The provider announced a group field on the Page, not a Lexical node, so this is
		// a guard against a shape nobody has proposed rather than a live concern.
		const doc = vendored();
		const block = (doc.docs[0]!.layout as Record<string, unknown>[])[0]!;
		const root = (block.content as Record<string, unknown>).root as { children: unknown[] };
		root.children.push({ type: "legalMetadata", ...populated });

		const result = parsePagesResponse(doc);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("legalMetadata");
	});

	it.each(placements)("renders identically with the group %s", (_name, mutate) => {
		const html = renderWith(mutate);
		expect(html).toBe(renderBlocks(parsePagesResponse(vendored())));
		for (const leak of ["legalMetadata", "legalVersion", "effectiveFrom", "2026-08-04", "1.2"]) {
			expect(html).not.toContain(leak);
		}
	});
});

describe("legalMetadata — editorial rendering ignores it", () => {
	it("renders HTML byte-identical to the vendored production response", () => {
		expect(renderBlocks(parsePagesResponse(augmented()))).toBe(renderBlocks(parsePagesResponse(vendored())));
	});

	it("leaks neither the group's name nor its values into the markup", () => {
		const html = renderBlocks(parsePagesResponse(augmented()));
		expect(html).toContain("<p>");
		expect(html).not.toContain("legalMetadata");
		expect(html).not.toContain("editorial");
		expect(html).not.toContain("documentType");
	});

	it("stays visible in the SK market, so the route has no reason to 404", () => {
		const result = parsePagesResponse(augmented());
		if (result.status !== "ok") throw new Error("fixture must parse");
		expect(isVisibleInMarket(result.page.markets, marketForChannel("sk-eur"))).toBe(true);
		expect(payloadLocaleForChannel("sk-eur")).toBe("sk");
	});
});

/**
 * Route-level proof. The parser being happy is necessary but not sufficient — what
 * matters is which of the two branches in `o-nas/page.tsx` the request takes.
 */
describe("legalMetadata — the route serves the CMS document, not the bootstrap", () => {
	function stubCms(respond: () => Promise<Response>) {
		vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.test");
		vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "test-id");
		vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "test-secret");
		const fetchMock = vi.fn(respond);
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	const jsonResponse = (body: unknown) => async () =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "content-type": "application/json" },
		});

	async function routeModule() {
		return (await import("@/app/[channel]/(main)/o-nas/page")) as {
			default: (props: { params: Promise<{ channel: string }> }) => Promise<ReactElement>;
			generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<{
				robots?: unknown;
				description?: string | null;
				alternates?: { canonical?: string };
			}>;
		};
	}

	async function renderRoute(): Promise<string> {
		const { default: Page } = await routeModule();
		return renderToStaticMarkup(await Page({ params: Promise.resolve({ channel: "sk-eur" }) }));
	}

	it("reaches the CMS and reports found, with no contract violation logged", async () => {
		const fetchMock = stubCms(jsonResponse(augmented()));
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

		const { fetchCmsPage } = await import("./client");
		const outcome = await fetchCmsPage("o-nas", "sk");

		// The fetch really happened. A stub that is never called would make every other
		// assertion here vacuous.
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(outcome.status).toBe("found");

		// `contract-violation` is the log line the fail-closed rule emits. Its absence is
		// the acceptance criterion; `console.error` not being called at all is stronger.
		expect(consoleError).not.toHaveBeenCalled();

		// The positive signal that distinguishes a real CMS render from a silent fallback
		// in production — the one thing that survives the CMS copy and the bootstrap copy
		// becoming byte-identical. See the note in `client.ts`.
		expect(consoleLog).toHaveBeenCalledWith("[cms] served", expect.stringContaining('"outcome":"found"'));
		expect(consoleLog).toHaveBeenCalledWith(
			"[cms] served",
			expect.stringContaining('"documentId":"019fb008-504b-779e-ad3f-1ff353267c88"'),
		);
	});

	it("renders the CMS content, and identically to the response without the group", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		stubCms(jsonResponse(augmented()));
		const withGroup = await renderRoute();

		vi.unstubAllGlobals();
		stubCms(jsonResponse(vendored()));
		const withoutGroup = await renderRoute();

		expect(withGroup).toBe(withoutGroup);

		// Both bodies open with the same first paragraph, so a prefix match proves nothing.
		// These two phrases are the CMS document's own wording; the bootstrap says
		// "kompatibilitu. Pri produktoch…" and "výberom, môže nás kontaktovať…" instead.
		expect(withGroup).toContain(CMS_ONLY_PHRASE);
		expect(withGroup).not.toContain(BOOTSTRAP_ONLY_PHRASE);
	});

	it("does not fall back to the hand-written bootstrap copy", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		stubCms(jsonResponse(augmented()));
		const cmsHtml = await renderRoute();

		// The same route with the CMS unreachable — this IS the bootstrap branch, and it is
		// here as a negative control. Comparing against a branch that was never exercised
		// would let an empty CMS render pass: `LegalPage` and `CompanyDetails` emit markup
		// on both paths, so inequality alone is not evidence.
		vi.unstubAllGlobals();
		stubCms(async () => {
			throw new Error("cms unreachable");
		});
		const bootstrapHtml = await renderRoute();

		expect(consoleError).toHaveBeenCalled(); // the fallback path logs; the CMS path did not
		expect(bootstrapHtml).not.toBe(cmsHtml);

		// Each body carries the other's absent phrase. Both directions are asserted, so
		// neither an empty render nor a swapped branch can pass.
		expect(bootstrapHtml).toContain(BOOTSTRAP_ONLY_PHRASE);
		expect(bootstrapHtml).not.toContain(CMS_ONLY_PHRASE);
		expect(cmsHtml).toContain(CMS_ONLY_PHRASE);
		expect(cmsHtml).not.toContain(BOOTSTRAP_ONLY_PHRASE);
	});

	it("builds metadata from the CMS document, not from the static fallback copy", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stubCms(jsonResponse(augmented()));

		const { generateMetadata } = await routeModule();
		const metadata = await generateMetadata({ params: Promise.resolve({ channel: "sk-eur" }) });

		// `absentPageMetadata()` returns `{ robots: { index: false, follow: false } }` and no
		// canonical. Getting a canonical back proves the route considers the page present.
		expect(metadata.robots).toBeUndefined();
		expect(metadata.alternates?.canonical).toBe("/sk/o-nas");

		// The discriminating assertion. The two branches above both yield a canonical, so
		// robots alone cannot tell a CMS render from a fallback — `generateMetadata` falls
		// back to STATIC_DESCRIPTION when the page is null. This description exists only in
		// the CMS document's `meta`, so reading it back proves the CMS branch was taken.
		// (Verified: an unparseable candidate makes the two assertions above pass anyway.)
		expect(metadata.description).toBe(
			"MAKY.STORE je slovenský internetový obchod s praktickým auto-moto príslušenstvom.",
		);
		expect(metadata.description).not.toContain("strešné nosiče");
	});
});

/**
 * The half of the gate that is easy to forget: proving the field did not buy leniency.
 * Every rule below is re-run with `legalMetadata` present on the document.
 */
describe("legalMetadata — validation is not weakened", () => {
	it("still rejects the whole document for an unsupported blockType", () => {
		const doc = augmented();
		doc.docs[0]!.layout = [
			...(doc.docs[0]!.layout as unknown[]),
			{ blockType: "futureBlock", markets: null },
		];
		const result = parsePagesResponse(doc);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.blockType).toBe("futureBlock");
		expect(result.violation.slug).toBe("o-nas");
	});

	it("still rejects the whole document for a content-bearing unknown Lexical node", () => {
		const doc = augmented();
		const block = (doc.docs[0]!.layout as Record<string, unknown>[])[0]!;
		const content = block.content as { root: { children: unknown[] } };
		content.root.children.push({
			type: "someFutureNode",
			children: [{ type: "text", text: "Stratený odsek", format: 0 }],
		});
		const result = parsePagesResponse(doc);
		expect(result.status).toBe("invalid");
		if (result.status !== "invalid") return;
		expect(result.violation.nodeType).toBe("someFutureNode");
	});

	it("still refuses a draft", () => {
		const doc = augmented();
		doc.docs[0]!._status = "draft";
		expect(parsePagesResponse(doc).status).toBe("invalid");
	});

	it("still refuses a document missing a required field", () => {
		const doc = augmented();
		delete doc.docs[0]!.slug;
		expect(parsePagesResponse(doc).status).toBe("invalid");
	});

	it("still refuses malformed markets", () => {
		const doc = augmented();
		doc.docs[0]!.markets = [1, 2];
		expect(parsePagesResponse(doc).status).toBe("invalid");
	});

	it("still reads an empty result set as authoritative absence", () => {
		// `legalMetadata` must not turn "no such page" into something a fallback could revive.
		const doc = augmented();
		doc.docs = [];
		expect(parsePagesResponse(doc)).toEqual({ status: "empty" });
	});
});

/**
 * The other door into the storefront, which the acceptance criteria do not name.
 *
 * `/api/revalidate/payload` takes a body from Payload describing what changed. Payload's
 * `afterChange` hook echoing document fields into that body is a plausible next move, and
 * `legalMetadata` would be among them. The webhook parser is the same allow-list shape as
 * the page parser, so the answer is the same — but "the same shape, so presumably the same
 * answer" is how the three contract mismatches on the withdrawal branch happened, and the
 * tags this derives are what purge the cache.
 */
describe("legalMetadata — the revalidation webhook is unaffected", () => {
	function event(): Record<string, unknown> {
		return JSON.parse(
			readFileSync(join(HERE, "__fixtures__/provider-v1/fixtures/revalidation/page-publish.json"), "utf8"),
		) as Record<string, unknown>;
	}

	it("parses a body carrying the group and derives the unchanged tags", () => {
		const body = event();
		body.legalMetadata = { documentType: "legal", legalVersion: "1.2", effectiveFrom: "2026-08-04" };

		const parsed = parseCmsRevalidateEvent(body);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;

		// Rebuilt from named fields, like the page parser — the group does not survive.
		expect(parsed.event).not.toHaveProperty("legalMetadata");
		expect(JSON.stringify(parsed.event)).not.toContain("legalMetadata");

		// The tags are what actually purge the cache. Same before and after.
		expect(tagsForCmsEvent(parsed.event)).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
		const clean = parseCmsRevalidateEvent(event());
		if (!clean.ok) throw new Error("vendored event must parse");
		expect(parsed.event).toEqual(clean.event);
	});

	it("still rejects a body whose source or event name is wrong, group or no group", () => {
		// The webhook's own fail-closed rules are value gates, and the group does not soften
		// them any more than it softens the page parser's.
		const forged = event();
		forged.legalMetadata = { documentType: "editorial", legalVersion: null, effectiveFrom: null };
		forged.source = "not-maky-cms";
		expect(parseCmsRevalidateEvent(forged).ok).toBe(false);

		const badEvent = event();
		badEvent.legalMetadata = { documentType: "editorial", legalVersion: null, effectiveFrom: null };
		badEvent.event = "obliterate";
		expect(parseCmsRevalidateEvent(badEvent).ok).toBe(false);
	});
});
