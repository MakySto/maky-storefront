import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BATCH_EVENTS_PER_MINUTE,
	DETAIL_PER_WINDOW,
	STATS_WINDOW_MS,
	__resetRevalidateStats,
	detailAllowed,
	flushStats,
	flushStatsOnShutdown,
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

	it("adds the delay of signed deliveries to the line, and leaves the line as it was when there is none", () => {
		for (let n = 1; n <= 100; n++) {
			recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 5, delayMs: n * 10 });
		}
		// Not signed by Saleor (or no issuedAt): counted, but with no delay.
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 5 });
		flushStats();
		expect(lines[0]).toMatch(/over1s=0 \| delay ms n=100 p95=950 max=1000$/);

		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 5 });
		flushStats();
		expect(lines[1]).not.toContain("delay");
	});

	it("does not turn a clock skew into a negative delay", () => {
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 5, delayMs: -300 });
		flushStats();
		expect(lines[0]).toContain("delay ms n=1 p95=0 max=0");
	});

	it("writes the window in progress when the process stops", () => {
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 5 });
		expect(lines).toHaveLength(0);
		flushStatsOnShutdown();
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("total=1");
	});

	describe("a batch", () => {
		const busyMinute = async (delayMs: number) => {
			for (let n = 0; n < BATCH_EVENTS_PER_MINUTE; n++) {
				recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 1, delayMs });
			}
			await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);
		};

		it("is summed up once, with the delay over all of its requests, when a quiet minute follows", async () => {
			await busyMinute(100);
			await busyMinute(2_000);
			expect(lines.filter((line) => line.startsWith("[revalidate-batch]"))).toHaveLength(0);

			recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 1 });
			await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);

			const summary = lines.filter((line) => line.startsWith("[revalidate-batch]"));
			expect(summary).toHaveLength(1);
			expect(summary[0]).toContain("busy_minutes=2 total=200 | delay ms n=200 p95=2000 max=2000");
		});

		it("is summed up when the traffic just stops, without another request", async () => {
			await busyMinute(300);
			await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 10_000);
			expect(lines.filter((line) => line.startsWith("[revalidate-batch]"))).toHaveLength(1);
		});

		it("is summed up at shutdown, and a slow minute that is not a batch prints no summary", async () => {
			await busyMinute(50);
			flushStatsOnShutdown();
			expect(lines.filter((line) => line.startsWith("[revalidate-batch]"))).toHaveLength(1);

			lines.length = 0;
			recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 1 });
			await vi.advanceTimersByTimeAsync(STATS_WINDOW_MS + 1);
			expect(lines.filter((line) => line.startsWith("[revalidate-batch]"))).toHaveLength(0);
		});
	});
});
