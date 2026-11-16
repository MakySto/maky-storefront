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
 */
export const STATS_WINDOW_MS = 60_000;
/** Requests of one outcome that print their own line per window. */
export const DETAIL_PER_WINDOW = 5;
/** More event types than this in one window are counted together as `other`. */
const MAX_TYPES = 40;
/** The durations kept for the percentile; a window that sees more keeps the first of them. */
const MAX_SAMPLES = 5_000;

export type Outcome = "applied" | "logged-only" | "unauthorized" | "key-unavailable" | "rejected";

interface Window {
	startedAt: number;
	total: number;
	byType: Map<string, number>;
	byOutcome: Map<Outcome, number>;
	durations: number[];
	over1s: number;
	maxMs: number;
	sumMs: number;
	detail: Map<string, number>;
	timer: ReturnType<typeof setTimeout> | null;
}

const KEY = Symbol.for("maky.revalidate-stats");

function holder(): { window: Window | null } {
	const g = globalThis as unknown as Record<symbol, { window: Window | null } | undefined>;
	return (g[KEY] ??= { window: null });
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
		over1s: 0,
		maxMs: 0,
		sumMs: 0,
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
	entry: { type?: string; outcome: Outcome; ms: number },
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
}

const sorted = (counts: Map<string, number>) =>
	[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export function formatStatsLine(window: Window, windowMs: number): string {
	const ordered = [...window.durations].sort((a, b) => a - b);
	const p95 =
		ordered.length > 0 ? ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)]! : 0;
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
		`ms avg=${Math.round(avg)} p95=${Math.round(p95)} max=${Math.round(window.maxMs)} over1s=${window.over1s}`
	);
}

/** Prints the window and starts the next one; with no request in it, prints nothing. */
export function flushStats(now: number = Date.now()): void {
	const state = holder();
	const window = state.window;
	if (!window) return;
	if (window.timer) clearTimeout(window.timer);
	state.window = null;
	if (window.total > 0) console.log(formatStatsLine(window, Math.max(1, now - window.startedAt)));
}

/** For tests. */
export function __resetRevalidateStats(): void {
	const state = holder();
	if (state.window?.timer) clearTimeout(state.window.timer);
	state.window = null;
}
