import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOKEN_HEADER, internalLoopbackToken } from "@/lib/internal-token";

/**
 * The internal route the crawler preflight asks. It must (1) answer nobody but this process,
 * (2) call the page's own resolver with the arguments it was handed, unchanged, and (3) say only
 * the status — never product data, never Saleor's error text — and never be cached.
 */

const getProductOutcome = vi.fn();
vi.mock("@/lib/saleor/product-outcome", () => ({
	getProductOutcome: (...args: unknown[]) => getProductOutcome(...args),
}));

const { GET } = await import("./route");

const call = (query: string, token: string | null = internalLoopbackToken()) =>
	GET(
		new NextRequest(new URL(`http://127.0.0.1:3031/api/internal/product-outcome?${query}`), {
			headers: token === null ? {} : { [INTERNAL_TOKEN_HEADER]: token },
		}),
	);

beforeEach(() => {
	getProductOutcome.mockReset();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("/api/internal/product-outcome", () => {
	it("is a plain 404 without the loopback token, and asks nothing", async () => {
		const res = await call("slug=x&channel=sk-eur", null);
		expect(res.status).toBe(404);
		expect(getProductOutcome).not.toHaveBeenCalled();
	});

	it("is a plain 404 with a wrong token", async () => {
		const res = await call("slug=x&channel=sk-eur", "0".repeat(64));
		expect(res.status).toBe(404);
		expect(getProductOutcome).not.toHaveBeenCalled();
	});

	it("refuses an unknown channel or a missing slug", async () => {
		expect((await call("slug=x&channel=nope")).status).toBe(400);
		expect((await call("channel=sk-eur")).status).toBe(400);
		expect(getProductOutcome).not.toHaveBeenCalled();
	});

	it("hands the page's resolver the slug and channel exactly as given", async () => {
		getProductOutcome.mockResolvedValue({ status: "found", resource: { name: "secret-ish product data" } });
		const res = await call(`slug=${encodeURIComponent("nosic-100%-bavlna")}&channel=cz-czk`);

		expect(getProductOutcome).toHaveBeenCalledWith("nosic-100%-bavlna", "cz-czk");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "found" });
		expect(res.headers.get("cache-control")).toBe("private, no-store");
	});

	it("reports not-found as such", async () => {
		getProductOutcome.mockResolvedValue({ status: "not-found" });
		expect(await (await call("slug=x&channel=sk-eur")).json()).toEqual({ status: "not-found" });
	});

	it("reports an upstream error with its class only — Saleor's message stays in the server log", async () => {
		getProductOutcome.mockResolvedValue({
			status: "upstream-error",
			type: "http",
			retryable: true,
			message: "HTTP 500: Internal Server Error {internal detail}",
		});
		const res = await call("slug=x&channel=sk-eur");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body).toEqual({ status: "upstream-error", type: "http", retryable: true });
		expect(JSON.stringify(body)).not.toContain("internal detail");
		expect(res.headers.get("cache-control")).toBe("private, no-store");
	});
});
