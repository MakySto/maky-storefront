import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DETAIL_PER_WINDOW,
	STATS_WINDOW_MS,
	__resetRevalidateStats,
	detailAllowed,
	flushStats,
	recordRevalidateRequest,
} from "./revalidate-stats";

let lines: string[];

beforeEach(() => {
	vi.useFakeTimers();
	__resetRevalidateStats();
	lines = [];
	vi.spyOn(console, "log").mockImplementation((line: string) => {
		lines.push(line);
	});
});

afterEach(() => {
	__resetRevalidateStats();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("revalidate stats", () => {
	it("prints one line for a minute of requests, with counts, outcomes and durations", async () => {
		for (let n = 0; n < 100; n++) {
			recordRevalidateRequest({
				type: n % 4 === 0 ? "ProductVariantUpdated" : "ProductUpdated",
				outcome: "applied",
				ms: n,
			});
		}
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "unauthorized", ms: 3 });
		expect(lines).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toBe(
			"[revalidate-events] window=60s total=101 | ProductUpdated=76 ProductVariantUpdated=25 | applied=100 unauthorized=1 | ms avg=49 p95=94 max=99 over1s=0",
		);
	});

	it("counts the requests that took more than a second", () => {
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 1_200 });
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 40 });
		flushStats();
		expect(lines[0]).toContain("max=1200 over1s=1");
	});

	it("prints nothing for a minute with no request, and starts a new window for the next", async () => {
		detailAllowed("applied");
		await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);
		expect(lines).toHaveLength(0);

		recordRevalidateRequest({ type: "CategoryCreated", outcome: "logged-only", ms: 5 });
		await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("CategoryCreated=1 | logged-only=1");
	});

	it("lets the first few requests of each outcome print in full, and no more in the window", () => {
		const allowed = Array.from({ length: 20 }, () => detailAllowed("applied")).filter(Boolean);
		expect(allowed).toHaveLength(DETAIL_PER_WINDOW);
		// Another outcome has its own allowance: a refusal is not hidden behind a thousand good requests.
		expect(detailAllowed("unauthorized")).toBe(true);
	});

	it("gives the allowance back in the next window", async () => {
		for (let n = 0; n < 20; n++) detailAllowed("applied");
		recordRevalidateRequest({ type: "x", outcome: "applied", ms: 1 });
		await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);
		expect(detailAllowed("applied")).toBe(true);
	});

	it("cannot be made to forge a line or grow without bound through the event type", () => {
		recordRevalidateRequest({ type: "Evil\n[Revalidate] Success", outcome: "applied", ms: 1 });
		for (let n = 0; n < 200; n++) recordRevalidateRequest({ type: `Type${n}`, outcome: "applied", ms: 1 });
		flushStats();

		expect(lines).toHaveLength(1);
		expect(lines[0]).not.toContain("\n");
		expect(lines[0]!.split(" | ")[1]!.split(" ").length).toBeLessThanOrEqual(41);
		expect(lines[0]).toContain("other=");
	});
});
