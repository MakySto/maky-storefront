import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_MEMORY_LOG_SECONDS,
	formatMemoryLine,
	memoryLogSeconds,
	sampleMemory,
	startMemoryLog,
	stopMemoryLog,
	type MemorySample,
} from "./memory-log";

const MB = 1024 * 1024;

const SAMPLE: MemorySample = {
	uptimeSeconds: 206010.4,
	rss: 3460 * MB,
	heapUsed: 2100 * MB,
	heapTotal: 2900 * MB,
	heapLimit: 4288 * MB,
	external: 210 * MB,
	arrayBuffers: 80 * MB,
};

afterEach(() => {
	stopMemoryLog();
	vi.useRealTimers();
});

describe("the memory line", () => {
	it("is numbers in MB under fixed names, with a time of its own", () => {
		expect(formatMemoryLine(SAMPLE, new Date("2026-10-18T01:02:03.000Z"))).toBe(
			"[memory] t=2026-10-18T01:02:03.000Z up=206010s rss=3460MB heapUsed=2100MB heapTotal=2900MB" +
				" heapLimit=4288MB external=210MB arrayBuffers=80MB",
		);
	});

	it("reads the real process, and says nothing but numbers", () => {
		const line = formatMemoryLine(sampleMemory(), new Date());

		expect(line).toMatch(
			/^\[memory\] t=\S+ up=\d+s rss=[1-9]\d*MB heapUsed=[1-9]\d*MB heapTotal=[1-9]\d*MB heapLimit=[1-9]\d*MB external=\d+MB arrayBuffers=\d+MB$/,
		);
	});
});

describe("how often the line is printed", () => {
	it("is once a minute unless told otherwise", () => {
		expect(memoryLogSeconds(undefined)).toBe(DEFAULT_MEMORY_LOG_SECONDS);
		expect(memoryLogSeconds("")).toBe(60);
		expect(memoryLogSeconds("  ")).toBe(60);
		expect(memoryLogSeconds("30")).toBe(30);
	});

	it("is switched off by 0 and by nothing else", () => {
		expect(memoryLogSeconds("0")).toBe(0);
		// A typo must not silence the log, and must not make it a flood.
		for (const typo of ["off", "false", "-5", "1.5", "NaN", "60s"]) {
			expect(memoryLogSeconds(typo)).toBe(60);
		}
	});

	it("is held between ten seconds and an hour", () => {
		expect(memoryLogSeconds("1")).toBe(10);
		expect(memoryLogSeconds("999999")).toBe(3600);
	});
});

describe("the timer", () => {
	it("prints one line at once and one every interval", () => {
		vi.useFakeTimers();
		const lines: string[] = [];

		startMemoryLog(60, { log: (line) => lines.push(line), sample: () => SAMPLE });
		expect(lines).toHaveLength(1);

		vi.advanceTimersByTime(59_000);
		expect(lines).toHaveLength(1);
		vi.advanceTimersByTime(1_000);
		expect(lines).toHaveLength(2);
		vi.advanceTimersByTime(120_000);
		expect(lines).toHaveLength(4);
		expect(lines.every((line) => line.startsWith("[memory] t="))).toBe(true);
	});

	it("is one timer however often it is started", () => {
		vi.useFakeTimers();
		const lines: string[] = [];
		const log = (line: string) => lines.push(line);

		const first = startMemoryLog(60, { log, sample: () => SAMPLE });
		const second = startMemoryLog(60, { log, sample: () => SAMPLE });
		vi.advanceTimersByTime(60_000);

		expect(second).toBe(first);
		expect(lines).toHaveLength(2);
	});

	it("stops when told to, and can be started again", () => {
		vi.useFakeTimers();
		const lines: string[] = [];
		const log = (line: string) => lines.push(line);

		startMemoryLog(60, { log, sample: () => SAMPLE })();
		vi.advanceTimersByTime(600_000);
		expect(lines).toHaveLength(1);

		startMemoryLog(60, { log, sample: () => SAMPLE });
		expect(lines).toHaveLength(2);
	});

	it("never keeps the process alive", () => {
		vi.useFakeTimers();
		const setInterval = vi.spyOn(globalThis, "setInterval");

		startMemoryLog(60, { log: () => {}, sample: () => SAMPLE });

		const handle = setInterval.mock.results[0]?.value as { hasRef: () => boolean };
		expect(handle.hasRef()).toBe(false);
	});

	it("swallows a sample that fails, and keeps going", () => {
		vi.useFakeTimers();
		const lines: string[] = [];
		let calls = 0;
		const sample = (): MemorySample => {
			calls += 1;
			if (calls === 1) throw new Error("no memory to read");
			return SAMPLE;
		};

		expect(() => startMemoryLog(60, { log: (line) => lines.push(line), sample })).not.toThrow();
		expect(lines).toHaveLength(0);

		vi.advanceTimersByTime(60_000);
		expect(lines).toHaveLength(1);
	});
});
