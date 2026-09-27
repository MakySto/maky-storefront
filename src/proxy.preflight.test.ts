import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFLIGHT_PATH } from "./lib/bot-preflight";
import { INTERNAL_TOKEN_HEADER, internalLoopbackToken } from "./lib/internal-token";
import { resetRouteExistenceStateForTests } from "./lib/route-existence";
import { proxy } from "./proxy";

/**
 * The crawler preflight inside the proxy: a crawler that is served the finished page gets 503
 * + Retry-After when — and only when — the page's own product resolver reports an upstream
 * error. Everything else is exactly the response it got before.
 *
 * `fetch` is stubbed once and answers both parties: the existence gate's Saleor query (to an
 * unroutable endpoint) and the preflight's loopback (to 127.0.0.1). The tests tell them apart by
 * URL and assert on both, so "the loopback was never made" is proven rather than assumed.
 *
 * As with the other proxy tests, a green run here is not evidence about the status a real
 * server returns — the harness run against `next build` + `next start` is.
 */

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const CHROME =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const SALEOR = "https://saleor.invalid/graphql/";
const PRODUCT = "/sk/stresny-nosic-nordrive-helio-black-audi-a4";

const ask = (path: string, ua: string, method = "GET") =>
	new NextRequest(new URL(`https://maky.store${path}`), { method, headers: { "user-agent": ua } });

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Reply = (url: URL) => Response | Promise<Response>;

/** One stub for both parties; each reply is chosen by where the request went. */
function network({ saleor, loopback }: { saleor?: Reply; loopback?: Reply }) {
	const mock = vi.fn(async (input: URL | string, _init?: RequestInit) => {
		const url = new URL(String(input));
		if (url.href.startsWith(SALEOR)) {
			if (!saleor) throw new Error("unexpected Saleor call");
			return saleor(url);
		}
		if (url.hostname === "127.0.0.1" && url.pathname === PREFLIGHT_PATH) {
			if (!loopback) throw new Error("unexpected loopback call");
			return loopback(url);
		}
		throw new Error(`unexpected fetch ${url.href}`);
	});
	vi.stubGlobal("fetch", mock);
	const loopbackCalls = () =>
		mock.mock.calls.filter(([input]) => new URL(String(input)).pathname === PREFLIGHT_PATH);
	const saleorCalls = () => mock.mock.calls.filter(([input]) => String(input).startsWith(SALEOR));
	return { mock, loopbackCalls, saleorCalls };
}

const resolver = (status: string) => () => json({ status });

beforeEach(() => {
	resetRouteExistenceStateForTests();
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", SALEOR);
	vi.stubEnv("PORT", "3031");
	vi.stubEnv("ROUTE_EXISTENCE_GATE", "off");
	vi.stubEnv("MAKY_BOT_PREFLIGHT", "");
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("a crawler on a product page, the page's own read failing", () => {
	it("gets 503, Retry-After and no-store — never the page", async () => {
		const net = network({ loopback: resolver("upstream-error") });
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));

		expect(res.status).toBe(503);
		expect(res.headers.get("retry-after")).toBe("120");
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(res.headers.get("x-maky-preflight")).toMatch(/^upstream-error;\d+ms$/);
		// Not a rewrite: nothing is rendered for it.
		expect(res.headers.get("x-middleware-rewrite")).toBeNull();
		expect(net.loopbackCalls()).toHaveLength(1);
	});

	it("asks about the slug and channel the page will be rendered with, carrying the loopback token", async () => {
		const net = network({ loopback: resolver("found") });
		await proxy(ask(PRODUCT, GOOGLEBOT));

		const [input, init] = net.loopbackCalls()[0]!;
		const url = new URL(String(input));
		expect(url.origin).toBe("http://127.0.0.1:3031");
		expect(url.searchParams.get("slug")).toBe("stresny-nosic-nordrive-helio-black-audi-a4");
		expect(url.searchParams.get("channel")).toBe("sk-eur");
		expect(new Headers(init?.headers).get(INTERNAL_TOKEN_HEADER)).toBe(internalLoopbackToken());
	});

	it("asks with the DECODED slug, which is what Next hands the page as params.productSlug", async () => {
		const net = network({ loopback: resolver("found") });
		await proxy(ask("/sk/nosic-100%25-bavlna", GOOGLEBOT));
		expect(new URL(String(net.loopbackCalls()[0]![0])).searchParams.get("slug")).toBe("nosic-100%-bavlna");
	});

	it("uses the market's Saleor channel abroad", async () => {
		const net = network({ loopback: resolver("found") });
		await proxy(ask("/cz/stresni-nosic-nordrive-helio", GOOGLEBOT));
		expect(new URL(String(net.loopbackCalls()[0]![0])).searchParams.get("channel")).toBe("cz-czk");
	});

	it("covers every crawler served the finished page, not only Googlebot", async () => {
		network({ loopback: resolver("upstream-error") });
		expect((await proxy(ask(PRODUCT, BINGBOT))).status).toBe(503);
	});

	it("answers HEAD the same way", async () => {
		network({ loopback: resolver("upstream-error") });
		expect((await proxy(ask(PRODUCT, GOOGLEBOT, "HEAD"))).status).toBe(503);
	});
});

describe("anything else is the response it was before", () => {
	it("a found product is rewritten to the page as always, and says what the preflight saw", async () => {
		network({ loopback: resolver("found") });
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));

		expect(res.status).toBe(200);
		expect(res.headers.get("x-channel")).toBe("sk-eur");
		expect(res.headers.get("x-middleware-rewrite")).toContain(
			"/sk-eur/stresny-nosic-nordrive-helio-black-audi-a4",
		);
		expect(res.headers.get("x-maky-preflight")).toMatch(/^found;\d+ms$/);
	});

	it("a not-found product is left to the page and the gate, as before", async () => {
		network({ loopback: resolver("not-found") });
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/");
	});

	const broken: [string, Reply][] = [
		["refused", () => Promise.reject(new TypeError("fetch failed"))],
		["404 (token mismatch)", () => new Response(null, { status: 404 })],
		["500 from the route", () => new Response("x", { status: 500 })],
		["malformed", () => json({ nope: true })],
	];
	for (const [what, reply] of broken) {
		it(`a loopback that is ${what} fails OPEN: the crawler gets the page`, async () => {
			network({ loopback: reply });
			const res = await proxy(ask(PRODUCT, GOOGLEBOT));
			expect(res.status).toBe(200);
			expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/");
			expect(res.headers.get("x-maky-preflight")).toMatch(/^skipped:/);
		});
	}

	it("without a known port it never asks", async () => {
		vi.stubEnv("PORT", "");
		const net = network({});
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(200);
		expect(net.mock).not.toHaveBeenCalled();
		expect(res.headers.get("x-maky-preflight")).toMatch(/^skipped:no-port/);
	});

	it("a visitor is never preflighted", async () => {
		const net = network({});
		const res = await proxy(ask(PRODUCT, CHROME));
		expect(res.status).toBe(200);
		expect(net.mock).not.toHaveBeenCalled();
		expect(res.headers.get("x-maky-preflight")).toBeNull();
	});

	it("MAKY_BOT_PREFLIGHT=off turns it off", async () => {
		vi.stubEnv("MAKY_BOT_PREFLIGHT", "off");
		const net = network({});
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(200);
		expect(net.mock).not.toHaveBeenCalled();
	});

	it("a POST is never preflighted", async () => {
		const net = network({});
		await proxy(ask(PRODUCT, GOOGLEBOT, "POST"));
		expect(net.mock).not.toHaveBeenCalled();
	});

	// A category root, a static route, the market home: not products, never asked about.
	for (const path of [
		"/sk/stresne-nosice",
		"/sk/kontakt",
		"/sk/poradna",
		"/sk",
		"/sk/categories/stresne-boxy",
	]) {
		it(`${path} is not a product and is never preflighted`, async () => {
			const net = network({});
			await proxy(ask(path, GOOGLEBOT));
			expect(net.loopbackCalls()).toHaveLength(0);
		});
	}
});

describe("with the existence gate armed", () => {
	beforeEach(() => {
		vi.stubEnv("ROUTE_EXISTENCE_GATE", "on");
		vi.stubEnv("ROUTE_EXISTENCE_MARKETS", "sk");
		vi.stubEnv("ROUTE_EXISTENCE_FAMILIES", "product");
	});

	it("a product the gate proves absent is a 404 before any preflight", async () => {
		const net = network({ saleor: () => json({ data: { product: null } }), loopback: resolver("found") });
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(404);
		expect(net.loopbackCalls()).toHaveLength(0);
	});

	it("the gate says it exists, the page's read fails: 503, and both verdicts are reported", async () => {
		const net = network({
			saleor: () => json({ data: { product: { id: "p1", slug: "x" } } }),
			loopback: resolver("upstream-error"),
		});
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(503);
		expect(res.headers.get("x-maky-gate")).toBe("product:exists");
		expect(res.headers.get("x-maky-preflight")).toMatch(/^upstream-error/);
		expect(net.saleorCalls()).toHaveLength(1);
		expect(net.loopbackCalls()).toHaveLength(1);
	});

	it("the gate could not ask (one fault, breaker closed) and the page's read fails too: 503", async () => {
		network({
			saleor: () => Promise.reject(new TypeError("ECONNRESET")),
			loopback: resolver("upstream-error"),
		});
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(503);
		expect(res.headers.get("x-maky-gate")).toBe("product:unknown");
	});

	it("the gate could not ask but the page's resolver can (warm cache): the crawler gets the page", async () => {
		network({ saleor: () => Promise.reject(new TypeError("ECONNRESET")), loopback: resolver("found") });
		const res = await proxy(ask(PRODUCT, GOOGLEBOT));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/");
	});
});
