import { afterEach, describe, expect, it, vi } from "vitest";

import { createExpiringMemo } from "./expiring-memo";

/**
 * The point of this memo is what it does NOT do: read the clock on the read path. That
 * absence cannot be asserted directly, so what is pinned here is the behaviour that
 * absence has to preserve — a TTL that still expires, and a stale entry that survives it.
 */

afterEach(() => {
	vi.useRealTimers();
});

describe("createExpiringMemo", () => {
	it("serves a fresh entry and stops serving it once the TTL passes", () => {
		vi.useFakeTimers();
		const memo = createExpiringMemo<string>();
		memo.set("sk", "slovak", 1000);

		expect(memo.get("sk")).toBe("slovak");
		vi.advanceTimersByTime(1001);
		expect(memo.get("sk")).toBeUndefined();
	});

	/**
	 * Expiry marks stale rather than deleting. Deleting would mean the first failed reload
	 * after a TTL turns a working page into an empty one — worse than prose fifteen minutes
	 * old, and the reason both callers keep a fallback at all.
	 */
	it("keeps an expired value reachable as stale", () => {
		vi.useFakeTimers();
		const memo = createExpiringMemo<string>();
		memo.set("sk", "slovak", 1000);

		vi.advanceTimersByTime(1001);
		expect(memo.get("sk"), "no longer fresh").toBeUndefined();
		expect(memo.getStale("sk"), "still the last known good").toBe("slovak");
		expect(memo.size).toBe(1);
	});

	it("keeps keys apart", () => {
		vi.useFakeTimers();
		const memo = createExpiringMemo<string>();
		memo.set("sk", "slovak", 1000);
		memo.set("de", "german", 5000);

		vi.advanceTimersByTime(1001);
		expect(memo.get("sk")).toBeUndefined();
		expect(memo.get("de")).toBe("german");
	});

	/** Re-setting reschedules rather than stacking a second timer on the old deadline. */
	it("restarts the clock on a re-set instead of expiring early", () => {
		vi.useFakeTimers();
		const memo = createExpiringMemo<string>();
		memo.set("sk", "first", 1000);

		vi.advanceTimersByTime(900);
		memo.set("sk", "second", 1000);

		// The original deadline falls here; the replacement must not go with it.
		vi.advanceTimersByTime(200);
		expect(memo.get("sk")).toBe("second");

		vi.advanceTimersByTime(900);
		expect(memo.get("sk")).toBeUndefined();
		expect(memo.getStale("sk")).toBe("second");
	});

	it("clear drops everything, stale included", () => {
		vi.useFakeTimers();
		const memo = createExpiringMemo<string>();
		memo.set("sk", "slovak", 1000);
		vi.advanceTimersByTime(1001);

		memo.clear();
		expect(memo.getStale("sk")).toBeUndefined();
		expect(memo.size).toBe(0);
	});
});
