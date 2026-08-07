import { describe, expect, it, vi } from "vitest";
import nextPkg from "next/package.json" with { type: "json" };
import type { GraphQLResult } from "@/lib/graphql";
import {
	UpstreamUnavailableError,
	catchUpstreamError,
	logUpstreamError,
	refuseToCacheUpstreamError,
	resourceOrNull,
	toOutcome,
	upstreamError,
} from "./resource-outcome";

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

describe("refuseToCacheUpstreamError", () => {
	it("passes both authoritative answers through untouched", () => {
		expect(refuseToCacheUpstreamError({ status: "found", resource: 1 })).toEqual({
			status: "found",
			resource: 1,
		});
		expect(refuseToCacheUpstreamError({ status: "not-found" })).toEqual({ status: "not-found" });
	});

	it("throws on a fault, so the cache entry is never written", () => {
		expect(() =>
			refuseToCacheUpstreamError({
				status: "upstream-error",
				type: "network",
				retryable: true,
				message: "timeout",
			}),
		).toThrow(UpstreamUnavailableError);
	});
});

describe("catchUpstreamError", () => {
	it("round-trips the fault back into an outcome", async () => {
		const outcome = await catchUpstreamError(async () =>
			refuseToCacheUpstreamError({
				status: "upstream-error",
				type: "graphql",
				retryable: false,
				message: "bad query",
			}),
		);
		expect(outcome).toEqual({
			status: "upstream-error",
			type: "graphql",
			retryable: false,
			message: "bad query",
		});
	});

	it("does not swallow unrelated errors", async () => {
		await expect(
			catchUpstreamError(async () => {
				throw new TypeError("a real bug");
			}),
		).rejects.toThrow(TypeError);
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

/**
 * The whole "an outage must never be cached as an absence" mechanism rests on
 * one behaviour of Next's `"use cache"`: a REJECTED promise is not stored, so the
 * body re-runs on the next call, while a resolved value is stored.
 *
 * That cannot be exercised from vitest — it needs the build pipeline. It was
 * verified instead on a production build of this exact version (2026-08-06,
 * `next build` + `next start`): three identical requests ran the throwing body
 * three times and the resolving body once.
 *
 * So this pins the version. If Next is upgraded, the check has to be repeated
 * before this test is allowed to pass again — the alternative is silently
 * inheriting a cached 404 for every product during the next Saleor blip.
 */
describe("use-cache rejection behaviour is version-pinned", () => {
	const VERIFIED_AGAINST = "16.2.9";

	it(`was verified on next@${VERIFIED_AGAINST}`, () => {
		expect(
			nextPkg.version,
			`Next changed from ${VERIFIED_AGAINST} to ${nextPkg.version}. Re-verify that a rejected ` +
				`promise inside "use cache" is still not cached, on a real production build, before ` +
				`updating this constant. src/lib/saleor/resource-outcome.ts depends on it: if rejections ` +
				`start being cached, a Saleor blip becomes a cached "product does not exist".`,
		).toBe(VERIFIED_AGAINST);
	});
});
