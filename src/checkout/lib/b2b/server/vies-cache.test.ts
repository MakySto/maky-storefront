import { afterEach, describe, expect, it, vi } from "vitest";

import {
	cachedViesCheck,
	resetViesGate,
	VIES_MAX_CHECKS_PER_CHECKOUT,
	VIES_MAX_CONCURRENT,
	VIES_NEGATIVE_TTL_MS,
	VIES_POSITIVE_TTL_MS,
	VIES_UNAVAILABLE_BACKOFF_MS,
} from "./vies-cache";
import type { ViesResult } from "./vies-client";

/** MOCKS: `check` stands in for the VIES client; no network. */

const T0 = Date.parse("2026-11-02T12:00:00.000Z");

const result = (status: ViesResult["status"], vatId = "DE123456789", at = T0): ViesResult => ({
	status,
	vatId,
	checkedAt: new Date(at).toISOString(),
	requestIdentifier: status === "VALID" ? "WAPI1" : null,
	name: null,
	address: null,
	detail: status.toLowerCase(),
});

afterEach(() => resetViesGate());

describe("cachedViesCheck", () => {
	it("a VALID answer is reused unchanged (original checkedAt) until just before 24 h", async () => {
		const check = vi.fn(async () => result("VALID"));
		const first = await cachedViesCheck({ vatId: "DE123456789", checkoutId: "co-1", check, now: () => T0 });
		expect(first.source).toBe("vies");

		const later = await cachedViesCheck({
			vatId: "DE123456789",
			checkoutId: "co-2",
			check,
			now: () => T0 + VIES_POSITIVE_TTL_MS - 1,
		});
		expect(later).toEqual({ result: first.result, source: "cache" });
		expect(later.result.checkedAt).toBe(new Date(T0).toISOString());

		const expired = await cachedViesCheck({
			vatId: "DE123456789",
			checkoutId: "co-2",
			check,
			now: () => T0 + VIES_POSITIVE_TTL_MS,
		});
		expect(expired.source).toBe("vies");
		expect(check).toHaveBeenCalledTimes(2);
		expect(VIES_POSITIVE_TTL_MS).toBeLessThan(24 * 60 * 60 * 1000);
	});

	it("INVALID is held briefly; UNAVAILABLE is a short backoff, never 24 h", async () => {
		const invalid = vi.fn(async () => result("INVALID", "DE111111111"));
		await cachedViesCheck({ vatId: "DE111111111", checkoutId: "co", check: invalid, now: () => T0 });
		expect(
			(
				await cachedViesCheck({
					vatId: "DE111111111",
					checkoutId: "co",
					check: invalid,
					now: () => T0 + VIES_NEGATIVE_TTL_MS - 1,
				})
			).source,
		).toBe("cache");
		expect(
			(
				await cachedViesCheck({
					vatId: "DE111111111",
					checkoutId: "co",
					check: invalid,
					now: () => T0 + VIES_NEGATIVE_TTL_MS,
				})
			).source,
		).toBe("vies");

		const down = vi.fn(async () => result("UNAVAILABLE", "DE222222222"));
		await cachedViesCheck({ vatId: "DE222222222", checkoutId: "co", check: down, now: () => T0 });
		expect(
			(
				await cachedViesCheck({
					vatId: "DE222222222",
					checkoutId: "co",
					check: down,
					now: () => T0 + VIES_UNAVAILABLE_BACKOFF_MS,
				})
			).source,
		).toBe("vies");
		expect(VIES_UNAVAILABLE_BACKOFF_MS).toBeLessThanOrEqual(60_000);
	});

	it("identical concurrent questions share one request (single-flight)", async () => {
		let release: (value: ViesResult) => void = () => {};
		const check = vi.fn(() => new Promise<ViesResult>((resolve) => (release = resolve)));
		const a = cachedViesCheck({ vatId: "DE123456789", checkoutId: "co-a", check, now: () => T0 });
		const b = cachedViesCheck({ vatId: "DE123456789", checkoutId: "co-b", check, now: () => T0 });
		await Promise.resolve();
		await Promise.resolve();
		release(result("VALID"));
		const [ra, rb] = await Promise.all([a, b]);
		expect(check).toHaveBeenCalledTimes(1);
		expect(ra.source).toBe("vies");
		expect(rb.source).toBe("shared");
		expect(rb.result).toBe(ra.result);
	});

	it("bounds the checks per checkout and the concurrent requests of the process", async () => {
		const check = vi.fn(async () => result("UNAVAILABLE"));
		for (let i = 0; i < VIES_MAX_CHECKS_PER_CHECKOUT; i++) {
			const outcome = await cachedViesCheck({
				vatId: `DE${100000000 + i}`,
				checkoutId: "busy",
				check,
				now: () => T0,
			});
			expect(outcome.source).toBe("vies");
		}
		const over = await cachedViesCheck({ vatId: "DE199999999", checkoutId: "busy", check, now: () => T0 });
		expect(over).toMatchObject({
			source: "limited",
			result: { status: "UNAVAILABLE", detail: "local-checkout-limit" },
		});

		resetViesGate();
		const never = vi.fn(() => new Promise<ViesResult>(() => {}));
		for (let i = 0; i < VIES_MAX_CONCURRENT; i++) {
			void cachedViesCheck({ vatId: `DE${300000000 + i}`, checkoutId: `c${i}`, check: never, now: () => T0 });
		}
		const queued = await cachedViesCheck({
			vatId: "DE399999999",
			checkoutId: "x",
			check: never,
			now: () => T0,
		});
		expect(queued).toMatchObject({ source: "limited", result: { detail: "local-concurrency-limit" } });
	});

	it("a check that throws is UNAVAILABLE and not cached", async () => {
		const boom = vi.fn(async () => {
			throw new Error("boom");
		});
		const outcome = await cachedViesCheck({
			vatId: "DE123456789",
			checkoutId: "co",
			check: boom,
			now: () => T0,
		});
		expect(outcome.result).toMatchObject({ status: "UNAVAILABLE", detail: "check-threw" });
		const again = await cachedViesCheck({
			vatId: "DE123456789",
			checkoutId: "co",
			check: async () => result("VALID"),
			now: () => T0,
		});
		expect(again.source).toBe("vies");
	});
});
