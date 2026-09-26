import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
	NEXT_DRAFT_MODE_COOKIE,
	CMS_PREVIEW_COOKIE,
	hasCmsPreviewCookies,
	isCmsPreviewTokenShape,
} from "./preview-cookies";

/**
 * `resolveCmsPreview` against the provider's preview fixtures
 * (`__fixtures__/provider-v3/preview-v1.md` and `fixtures/preview/`), plus the one property the
 * published reader must keep: it never sends a Payload credential.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v3/fixtures/preview");
const fixture = (name: string) =>
	JSON.parse(readFileSync(join(PACK, name), "utf8")) as Record<string, unknown>;

const resolveResponse = () => fixture("resolve.response.json");
const errors = fixture("resolve.errors.json") as Record<string, { status: number; body: unknown }>;
/** The contract's own sample request; its token is a placeholder, not a credential. */
const REQUEST = fixture("resolve.request.json") as { token: string };

const API_KEY = "fake-preview-api-key";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(respond: () => Response | Promise<Response>) {
	const mock = vi.fn(async (_url: string | URL, _init?: RequestInit) => respond());
	vi.stubGlobal("fetch", mock);
	return mock;
}

/** Header names of a fetch call, lower-cased, so "no Authorization" cannot hide behind case. */
function headersOf(init: RequestInit | undefined): Record<string, string> {
	return Object.fromEntries(
		Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
	);
}

let logs: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test/");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "fake-access-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "fake-access-secret");
	vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", API_KEY);
	logs = [
		vi.spyOn(console, "log").mockImplementation(() => undefined),
		vi.spyOn(console, "warn").mockImplementation(() => undefined),
		vi.spyOn(console, "error").mockImplementation(() => undefined),
	];
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

const loggedText = () => JSON.stringify(logs.map((spy) => spy.mock.calls));

describe("resolveCmsPreview — the request", () => {
	it("POSTs the token to preview-resolve with Access, the preview-reader key and no cache", async () => {
		const fetchMock = stubFetch(() => json(resolveResponse()));
		const { resolveCmsPreview } = await import("./client");
		await resolveCmsPreview(REQUEST.token);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(String(url)).toBe("https://cms.example.test/api/pages/preview-resolve");
		expect(init?.method).toBe("POST");
		expect(headersOf(init)).toMatchObject({
			"cf-access-client-id": "fake-access-id",
			"cf-access-client-secret": "fake-access-secret",
			authorization: `service-accounts API-Key ${API_KEY}`,
			"content-type": "application/json",
		});
		// Exactly the contract's request body.
		expect(JSON.parse(String(init?.body))).toEqual(REQUEST);
		// Never cached, never tagged, never a followed redirect.
		expect(init?.cache).toBe("no-store");
		expect(init?.redirect).toBe("manual");
		expect(init).not.toHaveProperty("next");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("never logs the token or the key", async () => {
		for (const respond of [
			() => json(resolveResponse()),
			() => json(errors["401-invalid-token"]!.body, 401),
			() => json({ ok: true }, 200),
			() => {
				throw new Error("network down");
			},
		]) {
			stubFetch(respond);
			const { resolveCmsPreview } = await import("./client");
			await resolveCmsPreview(REQUEST.token);
		}
		expect(loggedText()).not.toContain(REQUEST.token);
		expect(loggedText()).not.toContain(API_KEY);
	});
});

describe("resolveCmsPreview — the answer", () => {
	it("parses the contract response: the target and the draft, admitted as a draft", async () => {
		stubFetch(() => json(resolveResponse()));
		const { resolveCmsPreview } = await import("./client");
		const outcome = await resolveCmsPreview(REQUEST.token);

		expect(outcome.status).toBe("resolved");
		if (outcome.status !== "resolved") return;
		expect(outcome.preview).toEqual({
			collection: "pages",
			id: "01928f3e-4b1a-7c3d-9e2f-0123456789ab",
			versionId: "01928f40-1111-7000-8000-000000000001",
			market: "CZ",
			locale: "cs",
			slug: "o-nas",
			expiresAt: "2026-09-26T08:30:00.000Z",
		});
		expect(outcome.content.kind).toBe("page");
		if (outcome.content.kind !== "page") return;
		expect(outcome.content.page.id).toBe("01928f3e-4b1a-7c3d-9e2f-0123456789ab");
		expect(outcome.content.page.updatedAt).toBe("2026-09-26T07:59:58.412Z");
		expect(JSON.stringify(outcome.content.page.layout)).toContain("Koncept, který ještě není na webu.");
	});

	it.each(Object.entries(errors))(
		"%s is a refusal carrying the CMS's status and code",
		async (_name, error) => {
			stubFetch(() => json(error.body, error.status));
			const { resolveCmsPreview } = await import("./client");
			const outcome = await resolveCmsPreview(REQUEST.token);
			const code = (error.body as { code?: string }).code ?? null;
			expect(outcome).toEqual({ status: "rejected", httpStatus: error.status, code });
		},
	);

	it("reads Cloudflare Access's 302 as an upstream fault, never as a draft", async () => {
		stubFetch(() => new Response("", { status: 302, headers: { location: "https://login.example.test" } }));
		const { resolveCmsPreview } = await import("./client");
		expect((await resolveCmsPreview(REQUEST.token)).status).toBe("error");
	});

	it("refuses an answer whose market and language disagree", async () => {
		const body = resolveResponse();
		(body.preview as Record<string, unknown>).locale = "sk";
		stubFetch(() => json(body));
		const { resolveCmsPreview } = await import("./client");
		expect((await resolveCmsPreview(REQUEST.token)).status).toBe("error");
	});

	it("refuses an answer whose document is not the one the token names", async () => {
		const body = resolveResponse();
		(body.docs as Record<string, unknown>[])[0]!.id = "01928f3e-0000-7000-8000-000000000000";
		stubFetch(() => json(body));
		const { resolveCmsPreview } = await import("./client");
		expect((await resolveCmsPreview(REQUEST.token)).status).toBe("error");
	});

	it("reports a draft whose markets exclude the token's market as not-in-market", async () => {
		const body = resolveResponse();
		(body.docs as Record<string, unknown>[])[0]!.markets = ["SK"];
		stubFetch(() => json(body));
		const { resolveCmsPreview } = await import("./client");
		const outcome = await resolveCmsPreview(REQUEST.token);
		expect(outcome.status === "resolved" && outcome.content).toEqual({ kind: "not-in-market" });
	});

	it("reports a draft that breaks the page contract as invalid content, not as an outage", async () => {
		const body = resolveResponse();
		(body.docs as Record<string, unknown>[])[0]!.layout = [{ blockType: "futureThing", markets: null }];
		stubFetch(() => json(body));
		const { resolveCmsPreview } = await import("./client");
		const outcome = await resolveCmsPreview(REQUEST.token);
		expect(outcome.status === "resolved" && outcome.content.kind).toBe("invalid");
	});

	it("is not configured, and asks nobody, without the preview key", async () => {
		vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", "");
		const fetchMock = stubFetch(() => json(resolveResponse()));
		const { resolveCmsPreview } = await import("./client");
		expect(await resolveCmsPreview(REQUEST.token)).toEqual({ status: "not-configured" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("published reads stay anonymous", () => {
	it("never send an Authorization header, even with the preview key configured", async () => {
		const fetchMock = stubFetch(() =>
			json({
				docs: [
					{
						id: "019fb008-504b-779e-ad3f-1ff353267c88",
						title: "O nás",
						slug: "o-nas",
						layout: [],
						markets: null,
						_status: "published",
					},
				],
			}),
		);
		const { fetchCmsPage } = await import("./client");
		await fetchCmsPage("o-nas", "sk", "SK");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(String(url)).toContain("/api/pages?");
		expect(Object.keys(headersOf(init))).not.toContain("authorization");
		expect(JSON.stringify(init)).not.toContain(API_KEY);
		// …and a published read still refuses a draft outright.
		expect(String(url)).toContain("where%5B_status%5D%5Bequals%5D=published");
	});
});

describe("preview cookies", () => {
	it("names Next's own Draft Mode cookie", async () => {
		const { COOKIE_NAME_PRERENDER_BYPASS } = (await import("next/dist/server/api-utils")) as {
			COOKIE_NAME_PRERENDER_BYPASS: string;
		};
		expect(NEXT_DRAFT_MODE_COOKIE).toBe(COOKIE_NAME_PRERENDER_BYPASS);
		expect(CMS_PREVIEW_COOKIE).toBe("maky-cms-preview");
	});

	it("needs both cookies, with values", () => {
		const jar = (entries: Record<string, string>) => ({
			get: (name: string) => (name in entries ? { value: entries[name]! } : undefined),
		});
		expect(hasCmsPreviewCookies(jar({ [NEXT_DRAFT_MODE_COOKIE]: "x", [CMS_PREVIEW_COOKIE]: "y" }))).toBe(
			true,
		);
		expect(hasCmsPreviewCookies(jar({ [NEXT_DRAFT_MODE_COOKIE]: "x" }))).toBe(false);
		expect(hasCmsPreviewCookies(jar({ [CMS_PREVIEW_COOKIE]: "y" }))).toBe(false);
		expect(hasCmsPreviewCookies(jar({ [NEXT_DRAFT_MODE_COOKIE]: "", [CMS_PREVIEW_COOKIE]: "y" }))).toBe(
			false,
		);
	});

	it("accepts the contract's token shape and nothing that could break a cookie or a header", () => {
		expect(isCmsPreviewTokenShape(REQUEST.token)).toBe(true);
		for (const bad of [
			undefined,
			42,
			"",
			"short",
			"has space in it ok?",
			"semi;colon-token-value",
			"x".repeat(4097),
		]) {
			expect(isCmsPreviewTokenShape(bad), String(bad).slice(0, 20)).toBe(false);
		}
	});
});
