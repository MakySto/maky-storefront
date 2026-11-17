import { beforeEach, describe, expect, it } from "vitest";
import {
	BATCH_EVENTS_PER_MINUTE,
	BATCH_WINDOW_MS,
	__resetRevalidateLoad,
	arrivalsInLastMinute,
	inBatch,
	noteRevalidateArrival,
	revalidateWindowMs,
} from "./revalidate-load";
import { REVALIDATE_WINDOW_MS } from "./revalidate-throttle";

beforeEach(() => __resetRevalidateLoad());

describe("revalidate load", () => {
	it("counts the arrivals of the last 60 seconds and forgets older ones", () => {
		for (let n = 0; n < 10; n++) noteRevalidateArrival(1_000_000 + n * 1_000);
		expect(arrivalsInLastMinute(1_010_000)).toBe(10);
		// 30 s later the first five (seconds 0 to 4 of the run) are 60 s old or more.
		expect(arrivalsInLastMinute(1_000_000 + 64_000)).toBe(5);
		expect(arrivalsInLastMinute(1_000_000 + 200_000)).toBe(0);
	});

	it("reuses a bucket for a later minute without keeping its old count", () => {
		for (let n = 0; n < 50; n++) noteRevalidateArrival(5_000);
		noteRevalidateArrival(5_000 + 60_000);
		expect(arrivalsInLastMinute(5_000 + 60_000)).toBe(1);
	});

	it("is a batch only above the limit, and the window follows", () => {
		const t = 2_000_000;
		for (let n = 0; n < BATCH_EVENTS_PER_MINUTE; n++) noteRevalidateArrival(t);
		expect(inBatch(t)).toBe(false);
		expect(revalidateWindowMs(t)).toBe(REVALIDATE_WINDOW_MS);

		noteRevalidateArrival(t + 100);
		expect(inBatch(t + 100)).toBe(true);
		expect(revalidateWindowMs(t + 100)).toBe(BATCH_WINDOW_MS);
	});

	it("ends by itself a minute after the rate falls", () => {
		const t = 3_000_000;
		for (let n = 0; n < 300; n++) noteRevalidateArrival(t);
		expect(inBatch(t + 30_000)).toBe(true);
		expect(inBatch(t + 61_000)).toBe(false);
	});
});
