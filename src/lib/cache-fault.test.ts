import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import nextPkg from "next/package.json" with { type: "json" };
import { MIN_PRERENDERABLE_EXPIRE, MIN_SHELL_STALE } from "next/dist/server/use-cache/constants";

const cacheLife = vi.fn();
vi.mock("next/cache", () => ({ cacheLife: (...args: unknown[]) => cacheLife(...args) }));

import { FAULT_CACHE_LIFE, answered, faulted, rememberBriefly, settle, valueOrThrow } from "./cache-fault";

beforeEach(() => {
	cacheLife.mockReset();
});

describe("answered", () => {
	it("carries the value and leaves the entry's lifetime alone", () => {
		expect(answered({ a: 1 })).toEqual({ ok: true, value: { a: 1 } });
		expect(answered(null)).toEqual({ ok: true, value: null });
		expect(cacheLife).not.toHaveBeenCalled();
	});
});

describe("rememberBriefly", () => {
	it("shortens the entry being filled to the fault lifetime", () => {
		rememberBriefly();
		expect(cacheLife).toHaveBeenCalledTimes(1);
		expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
	});
});

describe("FAULT_CACHE_LIFE", () => {
	it("is fresh for seconds", () => {
		expect(FAULT_CACHE_LIFE.revalidate).toBeGreaterThan(0);
		expect(FAULT_CACHE_LIFE.revalidate).toBeLessThanOrEqual(10);
	});

	// Below Next's floors the entry is left out of the static shell and becomes a dynamic hole, and a
	// hole outside <Suspense> fails the prerender exactly as a throw does: the brevity of the fault
	// is `revalidate`'s job and nothing else's. Read from Next itself, so a raised floor fails here.
	it("keeps the floors an entry needs to sit in a static shell", () => {
		expect(FAULT_CACHE_LIFE.stale).toBeGreaterThanOrEqual(MIN_SHELL_STALE);
		expect(FAULT_CACHE_LIFE.expire).toBeGreaterThanOrEqual(MIN_PRERENDERABLE_EXPIRE);
		expect(FAULT_CACHE_LIFE.revalidate).toBeLessThanOrEqual(FAULT_CACHE_LIFE.expire);
	});
});

describe("faulted", () => {
	it("carries the message and shortens the entry to the fault lifetime", () => {
		expect(faulted("[Thing] unavailable: HTTP 503")).toEqual({
			ok: false,
			message: "[Thing] unavailable: HTTP 503",
		});
		expect(cacheLife).toHaveBeenCalledTimes(1);
		expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
	});
});

describe("valueOrThrow", () => {
	it("hands the value to the caller", () => {
		expect(valueOrThrow(answered([1, 2]))).toEqual([1, 2]);
		expect(valueOrThrow(answered(null))).toBeNull();
	});

	it("throws the fault with the message the reader used to throw", () => {
		expect(() => valueOrThrow(faulted("[Thing] unavailable: HTTP 503"))).toThrow(
			"[Thing] unavailable: HTTP 503",
		);
	});
});

describe("settle", () => {
	it("answers with what the body returned", async () => {
		await expect(settle(async () => 42)).resolves.toEqual({ ok: true, value: 42 });
		expect(cacheLife).not.toHaveBeenCalled();
	});

	it("takes what the body threw as a fault, kept for seconds, and never throws itself", async () => {
		const read = await settle(async () => {
			throw new Error("[Listing] prices unavailable for stresne-nosice: deadline exceeded");
		});
		expect(read).toEqual({
			ok: false,
			message: "[Listing] prices unavailable for stresne-nosice: deadline exceeded",
		});
		expect(cacheLife).toHaveBeenCalledWith(FAULT_CACHE_LIFE);
	});

	it("takes a thrown non-Error as a fault too", async () => {
		await expect(
			settle(async () => {
				throw "a bare string";
			}),
		).resolves.toEqual({ ok: false, message: "a bare string" });
	});

	it("hands Next's own control flow back to Next: it is not a fault", async () => {
		await expect(settle(async () => notFound())).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
		});
		await expect(settle(async () => redirect("/sk"))).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_REDIRECT"),
		});
		expect(cacheLife).not.toHaveBeenCalled();
	});
});

/**
 * What this whole module rests on, and what vitest cannot show — it needs the build pipeline.
 * Established on production builds (`next build` + `next start`) of this exact version on
 * 2026-10-06, with a fake Saleor and a fake CMS that were made to fail one operation at a time:
 *
 *  1. An error thrown out of a `"use cache"` function fails the static prerender it happens in,
 *     whether or not the caller catches it: the build's own `Error:` line, then a 500 for the
 *     visitor whose request was being prerendered (no stored shell yet, a shell past `expire`, a
 *     tag expired by `/api/revalidate`). One optional reader was enough.
 *  2. The same reader handing the fault out as a value does not: the page renders without that
 *     part and answers 200.
 *  3. `cacheLife(FAULT_CACHE_LIFE)` called after the awaits, in the fault branch, shortens an entry
 *     that asked for `hours`: the next prerender after a few seconds asks again, and the shell it
 *     makes shows the part again. Shorter `stale` or `expire` is a dynamic hole and a failed render.
 *  4. An error caught INSIDE the cache function (`settle`) is never reported.
 *
 * So this pins the version. If Next is upgraded, repeat the failure matrix on a production build
 * before the constant is changed; if a newer Next stops failing the prerender on (1), this module
 * is harmless but no longer needed, and the guard test can go with it.
 */
describe("the cache-fault pattern is version-pinned", () => {
	const VERIFIED_AGAINST = "16.3.6";

	it(`was verified on next@${VERIFIED_AGAINST}`, () => {
		expect(
			nextPkg.version,
			`Next changed from ${VERIFIED_AGAINST} to ${nextPkg.version}. Re-verify on a production build ` +
				`that (1) an error thrown out of "use cache" still fails the prerender, (2) a fault handed out as a ` +
				`value does not, (3) cacheLife(FAULT_CACHE_LIFE) in the fault branch still shortens the entry, before ` +
				`updating this constant. See src/lib/cache-fault.ts.`,
		).toBe(VERIFIED_AGAINST);
	});
});
