import { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * `/sk/poradna` — the second CMS route, and the fallback matrix behind it.
 *
 * The matrix is the part worth testing. Every row is a decision the pilot argued about
 * once and must not have to argue about again:
 *
 *   valid published document      render it
 *   timeout / 5xx / Access / JSON bootstrap — the CMS could not answer
 *   contract violation            bootstrap — the CMS answered something untrustworthy
 *   docs: []                      NO bootstrap — the CMS said "not here", and overriding
 *                                 an unpublish with code is the one thing it must not do
 *   market excludes SK            NO bootstrap — same reason, editorial decision
 *
 * The two halves look identical from outside and are opposite in kind, which is exactly
 * why they get separate tests rather than one "it falls back" assertion.
 */

const CHANNEL = { params: Promise.resolve({ channel: "sk-eur" }) };

function lexical(text: string) {
	return {
		root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text, format: 0 }] }] },
	};
}

function published(overrides: Record<string, unknown> = {}) {
	return {
		docs: [
			{
				id: "019fb008-504b-779e-ad3f-1ff353267c99",
				title: "Poradňa",
				slug: "poradna",
				summary: null,
				markets: ["SK"],
				meta: { title: "Poradňa", description: "Rady k výberu.", image: null },
				updatedAt: "2026-07-31T08:00:00.000Z",
				_status: "published",
				layout: [
					{
						id: "b1",
						anchorId: null,
						blockName: null,
						markets: null,
						blockType: "richText",
						content: lexical("Ako vybrať strešný nosič."),
					},
				],
				...overrides,
			},
		],
	};
}

function stub(respond: () => Promise<Response>) {
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "secret");
	vi.stubGlobal("fetch", vi.fn(respond));
}

const json =
	(body: unknown, status = 200) =>
	async () =>
		new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function routeModule() {
	return (await import("@/app/[channel]/(main)/poradna/page")) as {
		default: (props: { params: Promise<{ channel: string }> }) => Promise<ReactElement>;
		generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<{
			robots?: unknown;
			title?: unknown;
			alternates?: { canonical?: string };
		}>;
	};
}

async function render(): Promise<string> {
	const { default: Page } = await routeModule();
	return renderToStaticMarkup(await Page(CHANNEL));
}

/** Did the route 404 rather than render? `notFound()` throws a routing signal. */
async function rendersNotFound(): Promise<boolean> {
	try {
		await render();
		return false;
	} catch {
		return true;
	}
}

const BOOTSTRAP = "Obsah poradne práve nie je dostupný";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("/sk/poradna — a published document", () => {
	it("renders the CMS content, not the bootstrap", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json(published()));

		const html = await render();
		expect(html).toContain("Ako vybrať strešný nosič.");
		expect(html).not.toContain(BOOTSTRAP);
	});

	it("takes its title and canonical from the document", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json(published()));

		const metadata = await (await routeModule()).generateMetadata(CHANNEL);
		expect(metadata.robots).toBeUndefined();
		expect(metadata.alternates?.canonical).toBe("/sk/poradna");
	});
});

describe("/sk/poradna — upstream faults render the bootstrap", () => {
	it.each([
		["network failure", async () => Promise.reject(new Error("network down"))],
		["upstream 500", json({ error: "boom" }, 500)],
		["Cloudflare Access 302", async () => new Response(null, { status: 302 })],
		[
			"non-JSON response",
			async () =>
				new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } }),
		],
		[
			"contract violation — an unsupported block",
			json(published({ layout: [{ blockType: "futureThing", markets: null }] })),
		],
		[
			"contract violation — an unsupported Lexical node",
			json(
				published({
					layout: [
						{
							blockType: "richText",
							markets: null,
							content: {
								root: {
									type: "root",
									children: [{ type: "futureNode", children: [{ type: "text", text: "x" }] }],
								},
							},
						},
					],
				}),
			),
		],
		["a document answering with the wrong slug", json(published({ slug: "o-nas" }))],
	])("%s", async (_label, respond) => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(respond as () => Promise<Response>);

		const html = await render();
		expect(html).toContain(BOOTSTRAP);
	});
});

describe("/sk/poradna — an authoritative absence is NOT a fault", () => {
	it("404s on docs: [] rather than reviving the bootstrap", async () => {
		// Honouring an unpublish is the point of the CMS. Falling back here would override
		// an editorial decision with stale code.
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json({ docs: [], totalDocs: 0 }));

		expect(await rendersNotFound()).toBe(true);
	});

	it("404s when the document's markets exclude SK", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json(published({ markets: ["CZ"] })));

		expect(await rendersNotFound()).toBe(true);
	});

	it("marks both as noindex with no canonical, so the metadata agrees with the page", async () => {
		// A disagreement between these two is how a soft 404 acquires a self-canonical and
		// gets indexed. Under cacheComponents the status line cannot be trusted, so this
		// metadata is the only thing standing between a crawler and an absent page.
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		for (const body of [{ docs: [] }, published({ markets: ["CZ"] })]) {
			vi.unstubAllGlobals();
			stub(json(body));
			const metadata = await (await routeModule()).generateMetadata(CHANNEL);
			expect(metadata.robots).toEqual({ index: false, follow: false });
			expect(metadata.alternates?.canonical).toBeUndefined();
		}
	});
});

describe("/sk/poradna — the route exists at all", () => {
	it("is a real route rather than the product catch-all", async () => {
		// `/sk/poradna` was being absorbed by [productSlug] and answering 200 with
		// „Produkt nenájdený". A static segment wins over a dynamic one in Next's matcher,
		// so this folder takes it back — but the catch-all is untouched and would silently
		// reclaim the URL if this route were removed.
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json(published()));

		const html = await render();
		expect(html).not.toContain("Produkt nenájdený");
		expect(html).toContain("Poradňa");
	});

	it("does not carry the company block — those identifiers live elsewhere", async () => {
		// CLAUDE.md §9 puts them on /kontakt, /obchodne-podmienky and /reklamacie-a-vratenie.
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stub(json(published()));

		const html = await render();
		expect(html).not.toContain("IČO");
	});
});
