import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetVehiclePageMemo, VEHICLE_PAGE_PATH } from "./lib/catalog-content/vehicle-page-preflight";
import { INTERNAL_TOKEN_HEADER, internalLoopbackToken } from "./lib/internal-token";
import { resetRouteExistenceStateForTests } from "./lib/route-existence";
import { proxy } from "./proxy";

/**
 * A vehicle category address with no page is a 404, in every market, and one CFM merged away is a 301.
 *
 * `/sk/stresne-nosice/volkswagen/transporter` used to answer HTTP 200 with an empty not-found body (a PPR
 * route has flushed its shell before `notFound()` can set a status). The proxy now asks the app, over
 * loopback, what the page will be — and only a definite answer changes the response. A green run here is
 * about that decision; the status a real server returns is the `next start` check.
 */

const CHROME =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MODEL = "/sk/stresne-nosice/volkswagen/transporter";

const ask = (path: string, method = "GET") =>
	new NextRequest(new URL(`https://maky.store${path}`), { method, headers: { "user-agent": CHROME } });

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function loopback(reply: (url: URL) => Response | Promise<Response>) {
	const mock = vi.fn(async (input: URL | string) => {
		const url = new URL(String(input));
		if (url.hostname === "127.0.0.1" && url.pathname === VEHICLE_PAGE_PATH) return reply(url);
		throw new Error(`unexpected fetch ${url.href}`);
	});
	vi.stubGlobal("fetch", mock);
	return mock;
}

beforeEach(() => {
	__resetVehiclePageMemo();
	resetRouteExistenceStateForTests();
	vi.stubEnv("PORT", "3031");
	vi.stubEnv("ROUTE_EXISTENCE_GATE", "off");
	vi.stubEnv("MAKY_VEHICLE_PAGE_GATE", "");
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("an address that names no published page", () => {
	it("is a real 404 with noindex, never the empty 200", async () => {
		loopback(() => json({ status: "absent", reason: "no-page" }));
		const res = await proxy(ask(MODEL));

		expect(res.status).toBe(404);
		expect(res.headers.get("x-middleware-rewrite")).toContain("/_not-found");
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
		expect(res.headers.get("x-maky-vehicle-page")).toBe("absent");
	});

	it("is a 404 for a brand and for a generation as well, and for HEAD", async () => {
		loopback(() => json({ status: "absent", reason: "no-page" }));
		expect((await proxy(ask("/sk/stresne-nosice/volkswagen"))).status).toBe(404);
		expect((await proxy(ask(`${MODEL}/t7`))).status).toBe(404);
		expect((await proxy(ask(MODEL, "HEAD"))).status).toBe(404);
	});

	it("asks about the address the page will be looked up by, in the market's own channel and spelling", async () => {
		const mock = loopback(() => json({ status: "found" }));
		await proxy(ask("/cz/stresni-nosice/volkswagen/transporter"));

		const [input, init] = mock.mock.calls[0]! as unknown as [URL, RequestInit];
		const url = new URL(String(input));
		expect(url.searchParams.get("channel")).toBe("cz-czk");
		expect(url.searchParams.get("category")).toBe("stresni-nosice");
		expect(url.searchParams.get("path")).toBe("volkswagen/transporter");
		expect(new Headers(init.headers).get(INTERNAL_TOKEN_HEADER)).toBe(internalLoopbackToken());
	});

	it("is a 404 in a market with no catalogue yet, the same as in Slovakia", async () => {
		const mock = loopback(() => json({ status: "absent", reason: "no-language" }));
		const res = await proxy(ask("/de/dachtraeger/volkswagen/transporter"));
		expect(mock).toHaveBeenCalled();
		expect(res.status).toBe(404);
	});
});

describe("a page CFM merged away", () => {
	it("is a permanent redirect to the page that remained", async () => {
		loopback(() => json({ status: "redirect", href: "/sk/stresne-nosice/volkswagen/transporter/t7" }));
		const res = await proxy(ask(`${MODEL}/t6-t7`));
		expect(res.status).toBe(301);
		expect(new URL(res.headers.get("location")!).pathname).toBe(
			"/sk/stresne-nosice/volkswagen/transporter/t7",
		);
	});

	it("never follows a destination that leaves the site", async () => {
		loopback(() => json({ status: "redirect", href: "//evil.example/x" }));
		const res = await proxy(ask(MODEL));
		expect(res.status).toBe(200);
	});
});

describe("anything the proxy could not find out is the response it was before", () => {
	it("a found page is rewritten to the route as always", async () => {
		loopback(() => json({ status: "found" }));
		const res = await proxy(ask(MODEL));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-middleware-rewrite")).toContain(
			"/sk-eur/categories/stresne-nosice/volkswagen/transporter",
		);
	});

	it.each([
		["an outage of the catalogue", () => json({ status: "undetermined" })],
		["a refusal", () => json({ error: "no" }, 404)],
		["a malformed answer", () => new Response("<html>", { status: 200 })],
		["a failure of the loopback", () => Promise.reject(new TypeError("fetch failed"))],
	])("%s lets the request through", async (_name, reply) => {
		loopback(reply as () => Response);
		const res = await proxy(ask(MODEL));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/categories/stresne-nosice/");
	});

	it("the kill switch turns the check off without a deploy", async () => {
		vi.stubEnv("MAKY_VEHICLE_PAGE_GATE", "off");
		const mock = loopback(() => json({ status: "absent" }));
		const res = await proxy(ask(MODEL));
		expect(mock).not.toHaveBeenCalled();
		expect(res.status).toBe(200);
	});

	it("does not ask about a category page itself, a product or a POST", async () => {
		const mock = loopback(() => json({ status: "absent" }));
		expect((await proxy(ask("/sk/stresne-nosice"))).status).toBe(200);
		expect((await proxy(ask("/sk/stresny-nosic-nordrive-helio-black-audi-a4"))).status).toBe(200);
		expect((await proxy(ask(MODEL, "POST"))).status).toBe(200);
		expect(mock).not.toHaveBeenCalled();
	});

	it("remembers a definite answer for a moment instead of asking again on every hit", async () => {
		const mock = loopback(() => json({ status: "found" }));
		await proxy(ask(MODEL));
		await proxy(ask(MODEL));
		expect(mock).toHaveBeenCalledTimes(1);
	});
});
