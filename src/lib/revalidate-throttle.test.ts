import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	REVALIDATE_WINDOW_MS,
	__resetRevalidateThrottle,
	abandonFlush,
	flushThrottled,
	submitThrottled,
} from "./revalidate-throttle";

beforeEach(() => __resetRevalidateThrottle());

describe("revalidate throttle", () => {
	it("runs the first submission at once", () => {
		const work = vi.fn();
		expect(submitThrottled("k", work, 1_000)).toEqual({ outcome: "ran" });
		expect(work).toHaveBeenCalledTimes(1);
	});

	it("holds the rest of the window and asks for exactly one flush at its end", () => {
		const first = vi.fn();
		submitThrottled("k", first, 1_000);

		const second = vi.fn();
		const third = vi.fn();
		expect(submitThrottled("k", second, 11_000)).toEqual({
			outcome: "deferred",
			flushInMs: REVALIDATE_WINDOW_MS - 10_000,
		});
		expect(submitThrottled("k", third, 12_000)).toEqual({ outcome: "deferred", flushInMs: null });
		expect(second).not.toHaveBeenCalled();
		expect(third).not.toHaveBeenCalled();

		expect(flushThrottled("k", 1_000 + REVALIDATE_WINDOW_MS)).toBe(true);
		// Only the newest closure runs: all work under one key expires the same things.
		expect(second).not.toHaveBeenCalled();
		expect(third).toHaveBeenCalledTimes(1);
	});

	it("starts a new window at the flush", () => {
		submitThrottled("k", vi.fn(), 0);
		submitThrottled("k", vi.fn(), 5_000);
		flushThrottled("k", REVALIDATE_WINDOW_MS);

		const during = vi.fn();
		expect(submitThrottled("k", during, REVALIDATE_WINDOW_MS + 1_000)).toMatchObject({
			outcome: "deferred",
			flushInMs: REVALIDATE_WINDOW_MS - 1_000,
		});
		expect(during).not.toHaveBeenCalled();
	});

	it("flushes nothing when nothing is owed", () => {
		submitThrottled("k", vi.fn(), 0);
		expect(flushThrottled("k", REVALIDATE_WINDOW_MS)).toBe(false);
		expect(flushThrottled("unknown")).toBe(false);
	});

	it("lets the first event past the window carry what an unflushed window still owed", () => {
		submitThrottled("k", vi.fn(), 0);
		const owed = vi.fn();
		submitThrottled("k", owed, 1_000);

		const late = vi.fn();
		expect(submitThrottled("k", late, REVALIDATE_WINDOW_MS + 1)).toEqual({ outcome: "ran" });
		expect(late).toHaveBeenCalledTimes(1);
		// What it owed is replaced by the work that just ran, which expires the same things.
		expect(flushThrottled("k", REVALIDATE_WINDOW_MS + 2)).toBe(false);
		expect(owed).not.toHaveBeenCalled();
	});

	it("schedules the flush again after one was abandoned", () => {
		submitThrottled("k", vi.fn(), 0);
		expect(submitThrottled("k", vi.fn(), 1_000)).toMatchObject({ flushInMs: expect.any(Number) });
		abandonFlush("k");
		expect(submitThrottled("k", vi.fn(), 2_000)).toMatchObject({ flushInMs: expect.any(Number) });
	});

	it("keeps keys apart", () => {
		const a = vi.fn();
		const b = vi.fn();
		submitThrottled("a", a, 0);
		submitThrottled("b", b, 1);
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});
});
