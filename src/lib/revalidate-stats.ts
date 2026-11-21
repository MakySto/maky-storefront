/**
 * What `/api/revalidate` did in the last minute, as one log line, and how many requests may still print
 * their own line in it.
 *
 * Saleor sends one request per changed product or variant. A catalogue write from CFM is thousands of
 * them at some ten a second, and every one printed a line (the "Success" line alone is some 40 paths and
 * tags): a night of that is gigabytes in the PM2 log. So a window of a minute keeps COUNTS, by event type
 * and by what became of the request, and the DURATION of each handling (Saleor holds one of its two Celery
 * workers for as long as the answer takes and gives up after 18 s, so "under a second" is a claim that
 * wants a number: the average, the 95th percentile, the longest, and how many took more than a second).
 * The first few requests of each kind in a window still print in full, so a new shape or a refusal is
 * seen with its detail.
 *
 * The line (`[revalidate-events]`), one per window that saw a request:
 *   `window=60s total=612 | ProductUpdated=300 ProductVariantUpdated=312 | applied=612 | ms avg=8 p95=21 max=143 over1s=0`
 *
 * A delivery of Saleor's carries the time it was issued (`issuedAt`), so for those the line also says how long
 * the notice took to arrive: received minus issued, the number Saleor asked for to see whether its Celery
 * queue builds up in a batch (it is near its limit at some 1 070 a minute). Only signed deliveries of Saleor
 * count; a call of CFM's or one without `issuedAt` has no delay:
 *   `… | delay ms n=611 p95=180 max=1495`
 *
 * A run of minutes with `BATCH_EVENTS_PER_MINUTE` or more requests is a batch, and when it ends one more line
 * (`[revalidate-batch]`) gives the whole batch: its length, its requests and the delay over all of them, which
 * the per-minute p95s cannot be added up to.
 */
export const STATS_WINDOW_MS = 60_000;
/** Requests of one outcome that print their own line per window. */
export const DETAIL_PER_WINDOW = 5;
/** More event types than this in one window are counted together as `other`. */
const MAX_TYPES = 40;
/** The durations kept for the percentile; a window that sees more keeps the first of them. */
const MAX_SAMPLES = 5_000;

/** A minute with at least this many requests belongs to a batch (the same figure `revalidate-load` windows by). */
export const BATCH_EVENTS_PER_MINUTE = 100;
/** The delays one batch keeps for its percentile; a longer batch keeps the first of them. */
const MAX_BATCH_SAMPLES = 200_000;

export type Outcome = "applied" | "logged-only" | "unauthorized" | "key-unavailable" | "rejected";

interface Window {
	startedAt: number;
	total: number;
	byType: Map<string, number>;
	byOutcome: Map<Outcome, number>;
	durations: number[];
	/** Received minus issued, in ms, of the signed deliveries that said when they were issued. */
	delays: number[];
	over1s: number;
	maxMs: number;
	sumMs: number;
	delayCount: number;
	delayMax: number;
	detail: Map<string, number>;
	timer: ReturnType<typeof setTimeout> | null;
}

const KEY = Symbol.for("maky.revalidate-stats");

interface Batch {
	startedAt: number;
	minutes: number;
	total: number;
	delays: number[];
	delayCount: number;
	delayMax: number;
}

interface State {
	window: Window | null;
	batch: Batch | null;
	/** Ends the batch when no window follows the last busy one (traffic stopped altogether). */
	batchEnd: ReturnType<typeof setTimeout> | null;
}

function holder(): State {
	const g = globalThis as unknown as Record<symbol, State | undefined>;
	return (g[KEY] ??= { window: null, batch: null, batchEnd: null });
}

function current(now: number): Window {
	const state = holder();
	if (state.window) return state.window;
	const window: Window = {
		startedAt: now,
		total: 0,
		byType: new Map(),
		byOutcome: new Map(),
		durations: [],
		delays: [],
		over1s: 0,
		maxMs: 0,
		sumMs: 0,
		delayCount: 0,
		delayMax: 0,
		detail: new Map(),
		timer: null,
	};
	// A window ends on its own even when the next request is an hour away.
	window.timer = setTimeout(() => flushStats(), STATS_WINDOW_MS);
	window.timer.unref?.();
	state.window = window;
	return window;
}

/** `ProductUpdated`, `product_updated`: letters, digits and underscores only, so a header cannot forge a log line. */
const cleanType = (type: string | undefined): string =>
	type && /^[A-Za-z0-9_]{1,60}$/.test(type) ? type : "other";

/**
 * Whether this request may print its own line: the first DETAIL_PER_WINDOW of its outcome in the window.
 * The caller asks BEFORE it logs; recording comes at the end of the request.
 */
export function detailAllowed(outcome: Outcome, now: number = Date.now()): boolean {
	const window = current(now);
	const seen = window.detail.get(outcome) ?? 0;
	window.detail.set(outcome, seen + 1);
	return seen < DETAIL_PER_WINDOW;
}

export function recordRevalidateRequest(
	entry: { type?: string; outcome: Outcome; ms: number; delayMs?: number },
	now: number = Date.now(),
): void {
	const window = current(now);
	window.total++;
	const type =
		window.byType.has(cleanType(entry.type)) || window.byType.size < MAX_TYPES
			? cleanType(entry.type)
			: "other";
	window.byType.set(type, (window.byType.get(type) ?? 0) + 1);
	window.byOutcome.set(entry.outcome, (window.byOutcome.get(entry.outcome) ?? 0) + 1);
	const ms = Math.max(0, entry.ms);
	window.sumMs += ms;
	window.maxMs = Math.max(window.maxMs, ms);
	if (ms > 1_000) window.over1s++;
	if (window.durations.length < MAX_SAMPLES) window.durations.push(ms);
	if (entry.delayMs !== undefined && Number.isFinite(entry.delayMs)) {
		// Two clocks: a notice that looks issued a moment after it arrived is a skew, not a negative delay.
		const delay = Math.max(0, entry.delayMs);
		window.delayCount++;
		window.delayMax = Math.max(window.delayMax, delay);
		if (window.delays.length < MAX_SAMPLES) window.delays.push(delay);
	}
}

const sorted = (counts: Map<string, number>) =>
	[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function percentile95(values: number[]): number {
	if (values.length === 0) return 0;
	const ordered = [...values].sort((a, b) => a - b);
	return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)]!;
}

export function formatStatsLine(window: Window, windowMs: number): string {
	const p95 = percentile95(window.durations);
	const avg = window.total > 0 ? window.sumMs / window.total : 0;
	const types = sorted(window.byType)
		.map(([name, count]) => `${name}=${count}`)
		.join(" ");
	const outcomes = sorted(window.byOutcome as Map<string, number>)
		.map(([name, count]) => `${name}=${count}`)
		.join(" ");
	return (
		`[revalidate-events] window=${Math.round(windowMs / 1000)}s total=${
			window.total
		} | ${types} | ${outcomes} | ` +
		`ms avg=${Math.round(avg)} p95=${Math.round(p95)} max=${Math.round(window.maxMs)} over1s=${
			window.over1s
		}` +
		(window.delayCount > 0
			? ` | delay ms n=${window.delayCount} p95=${Math.round(percentile95(window.delays))} max=${Math.round(
					window.delayMax,
				)}`
			: "")
	);
}

function endBatch(state: State, now: number): void {
	if (state.batchEnd) clearTimeout(state.batchEnd);
	state.batchEnd = null;
	const batch = state.batch;
	state.batch = null;
	if (!batch) return;
	const delay =
		batch.delayCount > 0
			? `delay ms n=${batch.delayCount} p95=${Math.round(percentile95(batch.delays))} max=${Math.round(
					batch.delayMax,
				)}`
			: "delay ms n=0";
	console.log(
		`[revalidate-batch] ended after ${Math.max(1, Math.round((now - batch.startedAt) / 60_000))} min ` +
			`busy_minutes=${batch.minutes} total=${batch.total} | ${delay}`,
	);
}

/** Adds a closed busy minute to the batch it belongs to, starting one when there is none. */
function addToBatch(state: State, window: Window): void {
	const batch = (state.batch ??= {
		startedAt: window.startedAt,
		minutes: 0,
		total: 0,
		delays: [],
		delayCount: 0,
		delayMax: 0,
	});
	batch.minutes++;
	batch.total += window.total;
	batch.delayCount += window.delayCount;
	batch.delayMax = Math.max(batch.delayMax, window.delayMax);
	for (const delay of window.delays) {
		if (batch.delays.length >= MAX_BATCH_SAMPLES) break;
		batch.delays.push(delay);
	}
	if (state.batchEnd) clearTimeout(state.batchEnd);
	// If no window follows this one, nothing else would ever say that the batch is over.
	state.batchEnd = setTimeout(() => endBatch(holder(), Date.now()), STATS_WINDOW_MS + 5_000);
	state.batchEnd.unref?.();
}

/** Prints the window and starts the next one; with no request in it, prints nothing. */
export function flushStats(now: number = Date.now()): void {
	const state = holder();
	const window = state.window;
	if (!window) return;
	if (window.timer) clearTimeout(window.timer);
	state.window = null;
	if (window.total > 0) console.log(formatStatsLine(window, Math.max(1, now - window.startedAt)));
	if (window.total >= BATCH_EVENTS_PER_MINUTE) addToBatch(state, window);
	else endBatch(state, now);
}

/**
 * The process is stopping (SIGTERM/SIGINT, a PM2 stop at a deploy): writes the window in progress, which the
 * minute timer would otherwise take with it, and closes the batch. Between 16 and 17 November this was 81
 * requests that the log never counted.
 */
export function flushStatsOnShutdown(now: number = Date.now()): void {
	flushStats(now);
	endBatch(holder(), now);
}

/** For tests. */
export function __resetRevalidateStats(): void {
	const state = holder();
	if (state.window?.timer) clearTimeout(state.window.timer);
	if (state.batchEnd) clearTimeout(state.batchEnd);
	state.window = null;
	state.batch = null;
	state.batchEnd = null;
}
