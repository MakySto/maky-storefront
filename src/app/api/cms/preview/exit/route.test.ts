import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const draft = vi.hoisted(() => ({ isEnabled: true, enable: vi.fn(), disable: vi.fn() }));
vi.mock("next/headers", () => ({
	draftMode: async () => draft,
	cookies: async () => ({ get: () => undefined }),
}));

/** Outside Next there is no request to wait for; record that the handler asked. */
const connection = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	connection,
}));

const { GET } = await import("./route");

/**
 * `GET /api/cms/preview/exit` (`preview-v1.md`, step 5): Draft Mode off, the preview cookie
 * gone, and back to the same page — or to `/`, when `path` is anything but a path on this
 * site.
 */

const exit = (query: string) =>
	GET(new NextRequest(`https://storefront.example.test/api/cms/preview/exit${query}`));

beforeEach(() => {
	draft.disable.mockClear();
	connection.mockClear();
});

describe("GET /api/cms/preview/exit", () => {
	it("turns Draft Mode off, deletes the cookie and returns to the page", async () => {
		const response = await exit(`?path=${encodeURIComponent("/cz/o-nas")}`);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/cz/o-nas");
		expect(draft.disable).toHaveBeenCalledTimes(1);

		const cookie = response.headers.getSetCookie().find((entry) => entry.startsWith("maky-cms-preview="));
		expect(cookie).toBeDefined();
		const attributes = cookie!.split(";").map((part) => part.trim().toLowerCase());
		expect(attributes[0]).toBe("maky-cms-preview=");
		expect(attributes).toEqual(expect.arrayContaining(["max-age=0", "path=/", "httponly", "secure"]));

		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
	});

	it("is request-time only: it waits for the connection before touching Draft Mode", async () => {
		// Under Cache Components a GET handler would otherwise be prerendered at build time,
		// where `draftMode().disable()` is an error.
		await exit("?path=%2F");
		expect(connection).toHaveBeenCalledTimes(1);
		expect(connection.mock.invocationCallOrder[0]).toBeLessThan(draft.disable.mock.invocationCallOrder[0]!);
	});

	it("keeps a query on the returned path", async () => {
		const response = await exit(`?path=${encodeURIComponent("/sk/poradna?tab=2")}`);
		expect(response.headers.get("location")).toBe("/sk/poradna?tab=2");
	});

	it.each([
		["no path", ""],
		["an empty path", "?path="],
		["an absolute URL", `?path=${encodeURIComponent("https://evil.example/")}`],
		["a protocol-relative URL", `?path=${encodeURIComponent("//evil.example/x")}`],
		["a backslash host", `?path=${encodeURIComponent("/\\evil.example")}`],
		["a scheme", `?path=${encodeURIComponent("javascript:alert(1)")}`],
		["a relative path", `?path=${encodeURIComponent("cz/o-nas")}`],
		["a control character", `?path=${encodeURIComponent("/cz/o-nas\r\nSet-Cookie: x=y")}`],
	])("goes to / for %s, and still ends the preview", async (_label, query) => {
		const response = await exit(query);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/");
		expect(draft.disable).toHaveBeenCalledTimes(1);
	});

	it("exports only GET", async () => {
		expect(Object.keys(await import("./route"))).toEqual(["GET"]);
	});
});
