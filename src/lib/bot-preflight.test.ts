import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_DEADLINE_MS } from "@/config/product-deadline";
import {
	PREFLIGHT_PATH,
	PREFLIGHT_TIMEOUT_MS,
	__resetSkipLog,
	describePreflight,
	isBotPreflightEnabled,
	logSkippedPreflight,
	preflightProductOutcome,
} from "./bot-preflight";
import { INTERNAL_TOKEN_HEADER, internalLoopbackToken, isInternalLoopbackToken } from "./internal-token";

/**
 * The proxy side of the crawler preflight. The one property everything else rests on: only an
 * explicit `upstream-error` from the page's resolver may become a 503. Anything this client
 * could not find out is `skipped`, and a skipped preflight changes nothing.
 */

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const stub = (reply: () => Response | Promise<Response>) =>
	vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => reply());

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("preflightProductOutcome", () => {
	it("asks the internal route over 127.0.0.1 on the given port, with the loopback token, uncached", async () => {
		const fetchImpl = stub(() => json({ status: "found" }));
		await preflightProductOutcome("nosic-100%-bavlna", "sk-eur", { port: "3031", fetchImpl });

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0]!;
		const target = new URL(String(url));
		expect(target.origin).toBe("http://127.0.0.1:3031");
		expect(target.pathname).toBe(PREFLIGHT_PATH);
		// The slug survives the query string exactly, `%` included.
		expect(target.searchParams.get("slug")).toBe("nosic-100%-bavlna");
		expect(target.searchParams.get("channel")).toBe("sk-eur");
		expect(new Headers(init?.headers).get(INTERNAL_TOKEN_HEADER)).toBe(internalLoopbackToken());
		expect(init?.cache).toBe("no-store");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		// Never follows a redirect, which would carry the token header elsewhere.
		expect(init?.redirect).toBe("manual");
	});

	it("treats a redirect as 'something else answered': skipped, not a verdict", async () => {
		const redirect = () =>
			new Response(null, { status: 308, headers: { location: "https://example.test/" } });
		const answer = await preflightProductOutcome("x", "sk-eur", { port: "3000", fetchImpl: stub(redirect) });
		expect(answer).toMatchObject({ verdict: "skipped", reason: "http-308" });
	});

	for (const status of ["found", "not-found", "upstream-error"] as const) {
		it(`passes the resolver's "${status}" through`, async () => {
			const answer = await preflightProductOutcome("x", "sk-eur", {
				port: "3000",
				fetchImpl: stub(() => json({ status })),
			});
			expect(answer.verdict).toBe(status);
		});
	}

	it("without a port it does not ask at all", async () => {
		const fetchImpl = stub(() => json({ status: "upstream-error" }));
		const answer = await preflightProductOutcome("x", "sk-eur", { port: undefined, fetchImpl });
		expect(answer).toMatchObject({ verdict: "skipped", reason: "no-port" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("refuses a port that is not a number rather than building a URL out of it", async () => {
		const fetchImpl = stub(() => json({ status: "upstream-error" }));
		const answer = await preflightProductOutcome("x", "sk-eur", { port: "3000@evil.test", fetchImpl });
		expect(answer).toMatchObject({ verdict: "skipped", reason: "no-port" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	// Every way the loopback itself can fail is "we do not know", never "Saleor is down".
	const failures: [string, () => Response | Promise<Response>, string][] = [
		["a 404 (token mismatch or route missing)", () => new Response(null, { status: 404 }), "http-404"],
		["a 500 from the route itself", () => new Response("boom", { status: 500 }), "http-500"],
		["a body that is not JSON", () => new Response("<html>", { status: 200 }), "transport"],
		["a JSON body with an unknown status", () => json({ status: "maybe" }), "malformed"],
		["a JSON body that is not an object", () => json("found"), "malformed"],
		[
			"a refused connection",
			() => {
				throw new TypeError("fetch failed");
			},
			"transport",
		],
		[
			"its own timeout",
			() => {
				throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
			},
			"timeout",
		],
	];
	for (const [what, reply, reason] of failures) {
		it(`${what} is skipped:${reason}, not a verdict`, async () => {
			const answer = await preflightProductOutcome("x", "sk-eur", { port: "3000", fetchImpl: stub(reply) });
			expect(answer).toMatchObject({ verdict: "skipped", reason });
		});
	}

	it("waits longer than the resolver's own deadline, so a slow Saleor is answered by the resolver", () => {
		expect(PREFLIGHT_TIMEOUT_MS).toBeGreaterThan(PRODUCT_DEADLINE_MS);
	});

	it("reports what it concluded, and how long it took", () => {
		expect(describePreflight({ verdict: "found", ms: 3 })).toBe("found;3ms");
		expect(describePreflight({ verdict: "skipped", reason: "timeout", ms: 9500 })).toBe(
			"skipped:timeout;9500ms",
		);
	});
});

describe("isBotPreflightEnabled", () => {
	it("is on unless explicitly turned off", () => {
		vi.stubEnv("MAKY_BOT_PREFLIGHT", "");
		expect(isBotPreflightEnabled()).toBe(true);
		vi.stubEnv("MAKY_BOT_PREFLIGHT", "on");
		expect(isBotPreflightEnabled()).toBe(true);
		vi.stubEnv("MAKY_BOT_PREFLIGHT", " OFF ");
		expect(isBotPreflightEnabled()).toBe(false);
	});
});

describe("the loopback token", () => {
	it("is one per process, shared through globalThis, and compared exactly", () => {
		const token = internalLoopbackToken();
		expect(token).toMatch(/^[0-9a-f]{64}$/);
		expect(internalLoopbackToken()).toBe(token);
		expect(isInternalLoopbackToken(token)).toBe(true);
		expect(isInternalLoopbackToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).toBe(false);
		expect(isInternalLoopbackToken(token.slice(1))).toBe(false);
		expect(isInternalLoopbackToken("")).toBe(false);
		expect(isInternalLoopbackToken(null)).toBe(false);
	});
});

describe("logSkippedPreflight", () => {
	afterEach(() => __resetSkipLog());

	it("warns once per reason per minute, and never for a verdict", () => {
		const log = vi.fn();
		const skipped = { verdict: "skipped", reason: "transport", ms: 3 } as const;
		logSkippedPreflight(skipped, { now: 0, log });
		logSkippedPreflight(skipped, { now: 59_999, log });
		logSkippedPreflight({ verdict: "skipped", reason: "timeout", ms: 9_500 }, { now: 1, log });
		logSkippedPreflight({ verdict: "found", ms: 2 }, { now: 2, log });
		logSkippedPreflight({ verdict: "upstream-error", ms: 7_000 }, { now: 3, log });
		logSkippedPreflight(skipped, { now: 60_000, log });
		expect(log.mock.calls.map(([message]) => String(message).match(/\((\w+),/)?.[1])).toEqual([
			"transport",
			"timeout",
			"transport",
		]);
	});
});
