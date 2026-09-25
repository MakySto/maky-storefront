import { afterEach, describe, expect, it, vi } from "vitest";

import { withinDeadline } from "./within-deadline";

afterEach(() => {
	vi.useRealTimers();
});

describe("withinDeadline", () => {
	it("passes a value that arrives in time", async () => {
		await expect(withinDeadline(Promise.resolve(42), 100)).resolves.toBe(42);
	});

	it("gives up at the deadline without waiting for a slow promise", async () => {
		vi.useFakeTimers();
		const never = new Promise<number>(() => {});
		const result = withinDeadline(never, 800);
		await vi.advanceTimersByTimeAsync(800);
		await expect(result).resolves.toBeUndefined();
	});

	it("passes a rejection that arrives in time", async () => {
		await expect(withinDeadline(Promise.reject(new Error("down")), 100)).rejects.toThrow("down");
	});
});
