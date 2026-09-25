import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** Next's request-scoped Draft Mode, observed rather than faked into a real cookie. */
const draft = vi.hoisted(() => ({ isEnabled: false, enable: vi.fn(), disable: vi.fn() }));
vi.mock("next/headers", () => ({
	draftMode: async () => draft,
	cookies: async () => ({ get: () => undefined }),
}));

const { POST } = await import("./route");

/**
 * `POST /api/cms/preview` (`__fixtures__/provider-v3/preview-v1.md`, step 3): a valid token
 * turns on Draft Mode, stores the token in `maky-cms-preview` for the rest of its life and
 * answers 303 to the page in its market; anything else is a small Slovak page with no cookie,
 * no redirect and no trace of the token.
 */

const PACK = join(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../../../lib/cms/__fixtures__/provider-v3/fixtures/preview",
);
const fixture = (name: string) =>
	JSON.parse(readFileSync(join(PACK, name), "utf8")) as Record<string, unknown>;
const errors = fixture("resolve.errors.json") as Record<string, { status: number; body: unknown }>;

const TOKEN = "fake-preview-token.FAKE-SIGNATURE-0123456789";
const ENDPOINT = "https://storefront.example.test/api/cms/preview";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubResolve(respond: () => Response) {
	const mock = vi.fn(async (_url: string | URL, _init?: RequestInit) => respond());
	vi.stubGlobal("fetch", mock);
	return mock;
}

const form = (body: string, contentType = "application/x-www-form-urlencoded") =>
	POST(new NextRequest(ENDPOINT, { method: "POST", headers: { "content-type": contentType }, body }));

const previewCookie = (response: Response) =>
	response.headers.getSetCookie().find((cookie) => cookie.startsWith("maky-cms-preview="));

let logs: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "fake-access-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "fake-access-secret");
	vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", "fake-preview-api-key");
	// The fixture's token expires at 08:30; it is 08:00, so thirty minutes are left.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-09-26T08:00:00.000Z"));
	draft.enable.mockClear();
	logs = [
		vi.spyOn(console, "log").mockImplementation(() => undefined),
		vi.spyOn(console, "warn").mockImplementation(() => undefined),
		vi.spyOn(console, "error").mockImplementation(() => undefined),
	];
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function expectFailurePage(response: Response, message: string) {
	expect(response.status).toBeGreaterThanOrEqual(400);
	expect(response.headers.get("location")).toBeNull();
	expect(response.headers.get("content-type")).toContain("text/html");
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
	expect(previewCookie(response)).toBeUndefined();
	expect(draft.enable).not.toHaveBeenCalled();
	const html = await response.text();
	expect(html).toContain(message);
	expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
	expect(html).not.toContain(TOKEN);
}

describe("POST /api/cms/preview — a valid token", () => {
	it("turns on Draft Mode, sets the preview cookie and 303s to the page in its market", async () => {
		stubResolve(() => json(fixture("resolve.response.json")));
		const response = await form(`token=${encodeURIComponent(TOKEN)}`);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/cz/o-nas");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(draft.enable).toHaveBeenCalledTimes(1);

		const cookie = previewCookie(response);
		expect(cookie).toBeDefined();
		const attributes = cookie!.split(";").map((part) => part.trim().toLowerCase());
		expect(cookie!.split(";")[0]).toBe(`maky-cms-preview=${TOKEN}`);
		expect(attributes).toEqual(
			expect.arrayContaining(["httponly", "secure", "samesite=lax", "path=/", "max-age=1800"]),
		);
	});

	it("accepts the same token as JSON", async () => {
		stubResolve(() => json(fixture("resolve.response.json")));
		const response = await form(JSON.stringify({ token: TOKEN }), "application/json");
		expect(response.status).toBe(303);
		expect(previewCookie(response)).toContain(TOKEN);
	});

	it("keeps the cookie no longer than the token lives", async () => {
		vi.setSystemTime(new Date("2026-09-26T08:29:00.000Z"));
		stubResolve(() => json(fixture("resolve.response.json")));
		const response = await form(`token=${TOKEN}`);
		expect(previewCookie(response)?.toLowerCase()).toContain("max-age=60");
	});

	it("resolves through the CMS with Access, the preview-reader key and no cache", async () => {
		const fetchMock = stubResolve(() => json(fixture("resolve.response.json")));
		await form(`token=${TOKEN}`);
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(String(url)).toBe("https://cms.example.test/api/pages/preview-resolve");
		const headers = init?.headers as Record<string, string>;
		expect(headers["CF-Access-Client-Id"]).toBe("fake-access-id");
		expect(headers["CF-Access-Client-Secret"]).toBe("fake-access-secret");
		expect(headers.authorization).toBe("service-accounts API-Key fake-preview-api-key");
		expect(init?.cache).toBe("no-store");
		expect(JSON.parse(String(init?.body))).toEqual({ token: TOKEN });
	});
});

describe("POST /api/cms/preview — every failure is a page, never a preview", () => {
	it.each([
		["401-invalid-token", "Náhľad nie je platný alebo vypršal."],
		["401-expired-token", "Náhľad nie je platný alebo vypršal."],
		["404-document-unavailable", "Náhľad nie je platný alebo vypršal."],
		["404-version-unavailable", "Náhľad nie je platný alebo vypršal."],
		// A refused IDENTITY is configuration, not the editor's token.
		["401-no-identity", "Náhľad nie je nastavený."],
		["403-not-preview-reader", "Náhľad nie je nastavený."],
		["503-not-configured", "Náhľad nie je nastavený."],
	])("%s", async (name, message) => {
		const error = errors[name]!;
		stubResolve(() => json(error.body, error.status));
		await expectFailurePage(await form(`token=${TOKEN}`), message);
	});

	it("is not configured without PAYLOAD_PREVIEW_API_KEY, and asks the CMS nothing", async () => {
		vi.stubEnv("PAYLOAD_PREVIEW_API_KEY", "");
		const fetchMock = stubResolve(() => json(fixture("resolve.response.json")));
		await expectFailurePage(await form(`token=${TOKEN}`), "Náhľad nie je nastavený.");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a missing, forged-looking or oversized token without asking the CMS", async () => {
		const fetchMock = stubResolve(() => json(fixture("resolve.response.json")));
		for (const body of [
			"",
			"token=",
			"token=short",
			"token=has%20spaces%20in%20it%20!!",
			"nothing=here",
			`token=${"a".repeat(5000)}`,
		]) {
			await expectFailurePage(await form(body), "Náhľad nie je platný alebo vypršal.");
		}
		await expectFailurePage(await form(TOKEN, "text/plain"), "Náhľad nie je platný alebo vypršal.");
		await expectFailurePage(
			await form("{not json", "application/json"),
			"Náhľad nie je platný alebo vypršal.",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a token the CMS resolved but that has already run out", async () => {
		vi.setSystemTime(new Date("2026-09-26T08:30:01.000Z"));
		stubResolve(() => json(fixture("resolve.response.json")));
		await expectFailurePage(await form(`token=${TOKEN}`), "Náhľad nie je platný alebo vypršal.");
	});

	it("refuses when the CMS cannot be reached", async () => {
		stubResolve(() => {
			throw new Error("network down");
		});
		await expectFailurePage(await form(`token=${TOKEN}`), "Náhľad nie je platný alebo vypršal.");
	});
});

describe("POST /api/cms/preview — the token stays secret", () => {
	it("never appears in a log line, whatever happens", async () => {
		for (const respond of [
			() => json(fixture("resolve.response.json")),
			() => json(errors["401-expired-token"]!.body, 401),
			() => {
				throw new Error("network down");
			},
		]) {
			stubResolve(respond);
			await form(`token=${TOKEN}`);
		}
		expect(JSON.stringify(logs.map((spy) => spy.mock.calls))).not.toContain(TOKEN);
	});

	it("exports only POST, so every other method is a 405 from Next itself", async () => {
		expect(Object.keys(await import("./route"))).toEqual(["POST"]);
	});
});
