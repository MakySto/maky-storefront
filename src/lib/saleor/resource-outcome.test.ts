import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import type { GraphQLResult } from "@/lib/graphql";

const cacheLife = vi.fn();
vi.mock("next/cache", () => ({ cacheLife: (...args: unknown[]) => cacheLife(...args) }));

import {
	cachedOutcome,
	catchUpstreamError,
	logUpstreamError,
	resourceOrNull,
	toOutcome,
	upstreamError,
	type ResourceOutcome,
} from "./resource-outcome";

beforeEach(() => {
	cacheLife.mockReset();
});

type Data = { product: { id: string } | null };

const ok = (data: Data): GraphQLResult<Data> => ({ ok: true, data });
const fail = (
	type: "network" | "http" | "graphql" | "validation",
	isRetryable: boolean,
): Extract<GraphQLResult<Data>, { ok: false }> => ({
	ok: false,
	error: { type, message: `${type} boom`, isRetryable },
});

describe("toOutcome", () => {
	it("calls a successful response with a resource `found`", () => {
		expect(toOutcome(ok({ product: { id: "p1" } }), (d) => d.product)).toEqual({
			status: "found",
			resource: { id: "p1" },
		});
	});

	it("calls a successful response with an explicit null `not-found`", () => {
		// The ONLY branch allowed to produce not-found: the authority answered.
		expect(toOutcome(ok({ product: null }), (d) => d.product)).toEqual({ status: "not-found" });
	});

	it("never calls a transport failure `not-found`", () => {
		for (const type of ["network", "http", "graphql", "validation"] as const) {
			const outcome = toOutcome<Data, { id: string }>(fail(type, true), (d) => d.product);
			expect(outcome.status, type).toBe("upstream-error");
		}
	});

	it("carries the fault classification through", () => {
		const outcome = toOutcome<Data, { id: string }>(fail("http", true), (d) => d.product);
		expect(outcome).toEqual({
			status: "upstream-error",
			type: "http",
			retryable: true,
			message: "http boom",
		});
	});

	it("treats a null payload with no errors as a fault, not an absence", () => {
		// `{"data": null}` used to return {ok:true, data:null}; callers then did
		// result.data.product and threw a TypeError.
		const outcome = toOutcome({ ok: true, data: null } as unknown as GraphQLResult<Data>, (d) => d.product);
		expect(outcome.status).toBe("upstream-error");
	});
});

const FAULT: ResourceOutcome<number> = {
	status: "upstream-error",
	type: "graphql",
	retryable: false,
	message: "bad query",
};

/**
 * The body of a `"use cache"` function that answers with an outcome. A fault is the outcome it
 * is, and the entry that holds it is kept for seconds, not for the length of a product entry;
 * it is never thrown, because a throw out of a cache function fails the prerender it happens in
 * (`@/lib/cache-fault`).
 */
describe("cachedOutcome", () => {
	it("passes both authoritative answers through untouched, and leaves the entry's life alone", async () => {
		await expect(cachedOutcome(async () => ({ status: "found", resource: 1 }) as const)).resolves.toEqual({
			status: "found",
			resource: 1,
		});
		await expect(cachedOutcome(async () => ({ status: "not-found" }) as const)).resolves.toEqual({
			status: "not-found",
		});
		expect(cacheLife).not.toHaveBeenCalled();
	});

	it("hands a fault back as the outcome it is, and shortens the entry to the fault lifetime", async () => {
		await expect(cachedOutcome(async () => FAULT)).resolves.toEqual(FAULT);
		expect(cacheLife).toHaveBeenCalledTimes(1);
		expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
	});

	it("keeps the queue-starved flag, which only the reading side acts on", async () => {
		const queued: ResourceOutcome<number> = {
			status: "upstream-error",
			type: "network",
			retryable: true,
			message: "ProductDetails: deadline exceeded before a Saleor slot came free",
			queueStarved: true,
		};
		await expect(cachedOutcome(async () => queued)).resolves.toEqual(queued);
	});

	it("takes ANY throw from the body for a fault, and never throws itself", async () => {
		for (const thrown of [new TypeError("a real bug"), "a bare string"]) {
			cacheLife.mockReset();
			const outcome = await cachedOutcome<number>(async () => {
				throw thrown;
			});
			expect(outcome).toMatchObject({ status: "upstream-error", type: "network", retryable: true });
			expect(outcome.status === "upstream-error" && outcome.message).toContain(
				thrown instanceof Error ? thrown.message : thrown,
			);
			expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
		}
	});

	it("hands Next's own control flow back to Next: it is not a fault, and the entry is not shortened", async () => {
		await expect(cachedOutcome(async () => notFound())).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
		});
		await expect(cachedOutcome(async () => redirect("/sk"))).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_REDIRECT"),
		});
		expect(cacheLife).not.toHaveBeenCalled();
	});
});

describe("catchUpstreamError", () => {
	it("passes every outcome through, a fault included", async () => {
		await expect(catchUpstreamError(async () => FAULT)).resolves.toEqual(FAULT);
		await expect(catchUpstreamError(async () => ({ status: "not-found" }) as const)).resolves.toEqual({
			status: "not-found",
		});
		await expect(
			catchUpstreamError(async () => ({ status: "found", resource: 2 }) as const),
		).resolves.toEqual({ status: "found", resource: 2 });
	});

	/**
	 * A cached resolver does not reject any more, but production hands a rejection the caller as
	 * a NEW anonymous Error (React's placeholder message, the original's digest), so whatever does
	 * arrive is read as "we could not find out" and never as an answer.
	 */
	it("treats ANY rejection from a cached resolver as a fault, never as an answer or a crash", async () => {
		for (const thrown of [
			new TypeError("a real bug"),
			Object.assign(
				new Error(
					"An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.",
				),
				{ digest: "2338785109" },
			),
			"a bare string",
		]) {
			const outcome = await catchUpstreamError(async () => {
				throw thrown;
			});
			expect(outcome.status).toBe("upstream-error");
		}
	});

	it("hands Next's own control flow back to Next untouched", async () => {
		await expect(catchUpstreamError(async () => notFound())).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
		});
		await expect(catchUpstreamError(async () => redirect("/sk"))).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_REDIRECT"),
		});
	});
});

describe("helpers", () => {
	it("resourceOrNull collapses both non-found arms", () => {
		expect(resourceOrNull({ status: "found", resource: 7 })).toBe(7);
		expect(resourceOrNull({ status: "not-found" })).toBeNull();
		expect(
			resourceOrNull({ status: "upstream-error", type: "http", retryable: true, message: "x" }),
		).toBeNull();
	});

	it("logs one structured line per fault", () => {
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		logUpstreamError("product", upstreamError(fail("network", true)), { slug: "s", channel: "sk-eur" });
		expect(err).toHaveBeenCalledTimes(1);
		const line = String(err.mock.calls[0][0]);
		expect(line).toContain("[upstream-error]");
		const payload = JSON.parse(line.replace("[upstream-error] ", "")) as Record<string, unknown>;
		expect(payload).toMatchObject({ scope: "product", type: "network", retryable: true, slug: "s" });
		err.mockRestore();
	});
});
