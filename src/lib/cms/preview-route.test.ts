import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { locale?: string; namespace: string }) => {
		const namespace = typeof arg === "string" ? arg : arg.namespace;
		const file = join(dirname(fileURLToPath(import.meta.url)), "../../i18n/messages/sk-SK.json");
		const messages = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>;
		return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
	},
}));

/** A request inside a preview session: Draft Mode and the cookie, both controllable. */
const session = vi.hoisted(() => ({ draftMode: true, token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
	draftMode: async () => ({
		isEnabled: session.draftMode,
		enable: () => undefined,
		disable: () => undefined,
	}),
	cookies: async () => ({
		get: (name: string) =>
			name === "maky-cms-preview" && session.token ? { name, value: session.token } : undefined,
	}),
}));

/**
 * `cmsPageRoute` inside a CMS preview (`__fixtures__/provider-v3/preview-v1.md`, step 4): the
 * draft comes from `preview-resolve`, never from the published REST; it renders with the same
 * components under the banner, noindex, with the draft's revision marker — and in a market
 * the public route does not reach (CZ), which is the point of previewing future markets.
 */

const PACK = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__/provider-v3/fixtures/preview");
const resolveResponse = () =>
	JSON.parse(readFileSync(join(PACK, "resolve.response.json"), "utf8")) as Record<string, unknown>;

const TOKEN = "fake-preview-token.FAKE-SIGNATURE-0123456789";
const DRAFT_TEXT = "Koncept, který ještě není na webu.";
const PUBLISHED_TEXT = "PUBLIKOVANY-OBSAH-PORADNE";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const publishedPoradna = {
	docs: [
		{
			id: "01928f3e-aaaa-7000-8000-000000000001",
			title: "Poradňa",
			slug: "poradna",
			layout: [
				{
					blockType: "richText",
					markets: null,
					content: {
						root: {
							type: "root",
							children: [
								{ type: "paragraph", children: [{ type: "text", text: PUBLISHED_TEXT, format: 0 }] },
							],
						},
					},
				},
			],
			markets: null,
			updatedAt: "2026-09-20T10:00:00.000Z",
			_status: "published",
		},
	],
};

/** Routes the CMS by URL: preview-resolve answers `resolve`, the published REST answers `published`. */
function stubCms(resolve: () => Response, published: () => Response = () => json({ docs: [] })) {
	const mock = vi.fn(async (url: string | URL) =>
		String(url).includes("/api/pages/preview-resolve") ? resolve() : published(),
	);
	vi.stubGlobal("fetch", mock);
	return {
		resolveCalls: () => mock.mock.calls.filter(([url]) => String(url).includes("preview-resolve")).length,
		publishedCalls: () => mock.mock.calls.filter(([url]) => !String(url).includes("preview-resolve")).length,
	};
}

type Route = {
	default: (props: { params: Promise<{ channel: string }> }) => Promise<React.ReactElement>;
	generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<{
		robots?: unknown;
		other?: Record<string, string>;
		title?: unknown;
		alternates?: { canonical?: string };
	}>;
};

const route = async (slug: "o-nas" | "poradna") =>
	(slug === "o-nas"
		? await import("@/app/[channel]/(main)/o-nas/page")
		: await import("@/app/[channel]/(main)/poradna/page")) as Route;

async function render(slug: "o-nas" | "poradna", channel: string): Promise<string> {
	const { default: Page } = await route(slug);
	let element: React.ReactElement;
	try {
		element = await Page({ params: Promise.resolve({ channel }) });
	} catch (error) {
		if ((error as { digest?: string })?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK;404"))
			return "NOT_FOUND";
		throw error;
	}
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return new Response(stream).text();
}

const metadata = async (slug: "o-nas" | "poradna", channel: string) =>
	(await route(slug)).generateMetadata({ params: Promise.resolve({ channel }) });

const NOINDEX = { index: false, follow: false, googleBot: { index: false, follow: false } };

beforeEach(() => {
	vi.resetModules();
	session.draftMode = true;
	session.token = TOKEN;
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "fake-access-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "fake-access-secret");
	vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", "fake-preview-api-key");
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("preview — the draft renders in its market, even one the public route does not reach", () => {
	it("renders the CZ draft of o-nas from preview-resolve, under the banner", async () => {
		const cms = stubCms(() => json(resolveResponse()));
		const html = await render("o-nas", "cz-czk");

		expect(html).not.toBe("NOT_FOUND");
		expect(html).toContain(DRAFT_TEXT);
		expect(html).toContain("Náhľad konceptu — nie je verejný");
		expect(html).toContain("Ukončiť náhľad");
		expect(html).toContain('href="/api/cms/preview/exit?path=%2Fcz%2Fo-nas"');
		// The same components as a published page — the company block of o-nas included.
		expect(html).toContain("Internetový obchod prevádzkuje:");

		expect(cms.resolveCalls()).toBe(1);
		expect(cms.publishedCalls()).toBe(0);
	});

	it("is noindex, carries the draft's revision marker and no canonical", async () => {
		stubCms(() => json(resolveResponse()));
		const meta = await metadata("o-nas", "cz-czk");
		expect(meta.robots).toEqual(NOINDEX);
		expect(meta.other).toEqual({
			"maky-cms-revision": "pages:01928f3e-4b1a-7c3d-9e2f-0123456789ab@2026-09-26T07:59:58.412Z",
		});
		expect(meta.alternates?.canonical).toBeUndefined();
	});

	it("never leaks the token into the markup", async () => {
		stubCms(() => json(resolveResponse()));
		expect(await render("o-nas", "cz-czk")).not.toContain(TOKEN);
	});
});

describe("preview — a token answers only for its own page and market", () => {
	it("shows the invalid-preview page when the token's market is not the route's", async () => {
		stubCms(() => json(resolveResponse()));
		const html = await render("o-nas", "sk-eur");
		expect(html).toContain("Náhľad nie je platný alebo vypršal.");
		expect(html).not.toContain(DRAFT_TEXT);
		expect((await metadata("o-nas", "sk-eur")).robots).toEqual(NOINDEX);
	});

	it("leaves another page to its published path", async () => {
		const cms = stubCms(
			() => json(resolveResponse()),
			() => json(publishedPoradna),
		);
		const html = await render("poradna", "sk-eur");
		expect(html).toContain(PUBLISHED_TEXT);
		expect(html).not.toContain(DRAFT_TEXT);
		expect(html).not.toContain("Náhľad konceptu");
		expect(cms.publishedCalls()).toBeGreaterThan(0);
	});

	it("and that published path still 404s where the route policy says so", async () => {
		stubCms(() => json(resolveResponse()));
		expect(await render("poradna", "cz-czk")).toBe("NOT_FOUND");
	});
});

describe("preview — what the editor sees when the draft cannot be shown", () => {
	it.each([
		[
			"an expired token",
			() => json({ ok: false, code: "PREVIEW_TOKEN_EXPIRED" }, 401),
			"Náhľad nie je platný alebo vypršal.",
		],
		[
			"an invalid token",
			() => json({ ok: false, code: "PREVIEW_TOKEN_INVALID" }, 401),
			"Náhľad nie je platný alebo vypršal.",
		],
		[
			"a deleted document",
			() => json({ ok: false, code: "PREVIEW_DOCUMENT_UNAVAILABLE" }, 404),
			"Náhľad nie je platný alebo vypršal.",
		],
		[
			"a refused machine identity",
			() => json({ ok: false, error: "Forbidden", data: null }, 403),
			"Náhľad nie je nastavený.",
		],
		[
			"preview off in the CMS",
			() => json({ ok: false, code: "PREVIEW_NOT_CONFIGURED" }, 503),
			"Náhľad nie je nastavený.",
		],
		[
			"an unreachable CMS",
			() => {
				throw new Error("network down");
			},
			"Náhľad sa teraz nedá načítať.",
		],
	])("%s: a noindex status page with the way out", async (_label, resolve, message) => {
		stubCms(resolve);
		const html = await render("o-nas", "cz-czk");
		expect(html).toContain(message);
		expect(html).toContain("Ukončiť náhľad");
		expect(html).not.toContain(DRAFT_TEXT);
		const meta = await metadata("o-nas", "cz-czk");
		expect(meta.robots).toEqual(NOINDEX);
		expect(meta.other).toBeUndefined();
	});

	it("the storefront's own missing key: not configured", async () => {
		vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", "");
		const cms = stubCms(() => json(resolveResponse()));
		expect(await render("o-nas", "cz-czk")).toContain("Náhľad nie je nastavený.");
		expect(cms.resolveCalls()).toBe(0);
	});

	it("a draft the document's markets exclude says so instead of rendering", async () => {
		const body = resolveResponse();
		(body.docs as Record<string, unknown>[])[0]!.markets = ["SK"];
		stubCms(() => json(body));
		expect(await render("o-nas", "cz-czk")).toContain("Tento koncept sa v tomto trhu nezobrazí");
	});

	it("a draft with no body for the market says so, as the public 404 would", async () => {
		const body = resolveResponse();
		(body.docs as Record<string, unknown>[])[0]!.layout = [];
		stubCms(() => json(body));
		expect(await render("o-nas", "cz-czk")).toContain("Tento koncept nemá pre tento trh žiadny obsah");
	});
});

describe("no preview session, no preview", () => {
	it("Draft Mode off: the published path, and the CMS is never asked to resolve", async () => {
		session.draftMode = false;
		const cms = stubCms(() => json(resolveResponse()));
		expect(await render("o-nas", "cz-czk")).toBe("NOT_FOUND");
		expect(cms.resolveCalls()).toBe(0);
	});

	it("Draft Mode on but no preview cookie: the published path", async () => {
		session.token = undefined;
		const cms = stubCms(
			() => json(resolveResponse()),
			() => json(publishedPoradna),
		);
		expect(await render("poradna", "sk-eur")).toContain(PUBLISHED_TEXT);
		expect(cms.resolveCalls()).toBe(0);
	});
});
