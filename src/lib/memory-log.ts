import { getHeapStatistics } from "node:v8";

/**
 * What the server process is made of, one line a minute, in the PM2 out log.
 *
 * It exists because of 2026-10-16 and 2026-10-17: `next-server` went from 2.8 and 3.7 GB to 4.6 to
 * 5.0 GB within a minute or two of a robot surge, held there for 91 minutes and for 6 hours, and fell
 * by 2.1 and 1.6 GB within one minute. `atop` sees the process from outside, so it says how big the
 * process was and never what it was made of, and V8's heap cannot be read from there (CLAUDE.md
 * §13.3.1). Against `rss`, the other fields tell three causes apart: garbage held until the next
 * major collection (`heapUsed` follows `rss` and falls in the same minute), live data (`heapUsed`
 * stays high after `rss` has fallen) and native memory (`rss` stays well above `heapTotal` plus
 * `external`, which is where the image optimiser's buffers are). `arrayBuffers` is a part of
 * `external`, not an addition to it.
 *
 * `key=value` in MB, so a line reads with `grep` and `awk`; the PM2 log carries no time of its own,
 * so each line carries one. Numbers only: nothing here reads a request, a setting or a cache entry.
 */

const MB = 1024 * 1024;

export const DEFAULT_MEMORY_LOG_SECONDS = 60;
const MIN_MEMORY_LOG_SECONDS = 10;
const MAX_MEMORY_LOG_SECONDS = 3600;

export interface MemorySample {
	readonly uptimeSeconds: number;
	readonly rss: number;
	readonly heapUsed: number;
	readonly heapTotal: number;
	readonly heapLimit: number;
	readonly external: number;
	readonly arrayBuffers: number;
}

/**
 * Seconds between two lines, from `MAKY_MEMORY_LOG_SECONDS`. Unset or unreadable is the default
 * (a typo must not switch the log off, and must not make it a flood); `0` is the one way to turn
 * it off; anything else is held between 10 and 3 600.
 */
export function memoryLogSeconds(raw: string | undefined): number {
	if (raw === undefined || raw.trim() === "") return DEFAULT_MEMORY_LOG_SECONDS;
	const seconds = Number(raw);
	if (!Number.isInteger(seconds) || seconds < 0) return DEFAULT_MEMORY_LOG_SECONDS;
	if (seconds === 0) return 0;
	return Math.min(MAX_MEMORY_LOG_SECONDS, Math.max(MIN_MEMORY_LOG_SECONDS, seconds));
}

export function sampleMemory(): MemorySample {
	const usage = process.memoryUsage();
	return {
		uptimeSeconds: process.uptime(),
		rss: usage.rss,
		heapUsed: usage.heapUsed,
		heapTotal: usage.heapTotal,
		heapLimit: getHeapStatistics().heap_size_limit,
		external: usage.external,
		arrayBuffers: usage.arrayBuffers,
	};
}

export function formatMemoryLine(sample: MemorySample, at: Date): string {
	const mb = (bytes: number): string => `${Math.round(bytes / MB)}MB`;
	return (
		`[memory] t=${at.toISOString()} up=${Math.round(sample.uptimeSeconds)}s rss=${mb(sample.rss)}` +
		` heapUsed=${mb(sample.heapUsed)} heapTotal=${mb(sample.heapTotal)} heapLimit=${mb(sample.heapLimit)}` +
		` external=${mb(sample.external)} arrayBuffers=${mb(sample.arrayBuffers)}`
	);
}

interface MemoryLogHooks {
	readonly sample?: () => MemorySample;
	readonly log?: (line: string) => void;
	readonly now?: () => Date;
}

let stopRunning: (() => void) | undefined;

/**
 * Prints one line now and one every `seconds`, and returns the function that stops it. Started
 * twice, it is still one timer: `register` is the only caller, but a second start must never mean a
 * second line a minute. The timer is unref'ed, so it never keeps the process alive, and a failing
 * sample is swallowed, because a log that can take the process down is worse than no log.
 */
export function startMemoryLog(seconds: number, hooks: MemoryLogHooks = {}): () => void {
	if (stopRunning) return stopRunning;

	const sample = hooks.sample ?? sampleMemory;
	const log = hooks.log ?? ((line: string) => console.log(line));
	const now = hooks.now ?? (() => new Date());

	const emit = (): void => {
		try {
			log(formatMemoryLine(sample(), now()));
		} catch {
			// Nothing to do about it here, and nothing it may break.
		}
	};

	emit();
	const timer = setInterval(emit, seconds * 1000);
	timer.unref();

	stopRunning = () => {
		clearInterval(timer);
		stopRunning = undefined;
	};
	return stopRunning;
}

/** For tests: whatever is running stops, so the next test starts from nothing. */
export function stopMemoryLog(): void {
	stopRunning?.();
}
