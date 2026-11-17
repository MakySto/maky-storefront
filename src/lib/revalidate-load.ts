import { REVALIDATE_WINDOW_MS } from "@/lib/revalidate-throttle";

/**
 * How busy `/api/revalidate` is, and so how long the market-wide work of an event may be held.
 *
 * A CFM run is not a trickle of edits but a batch: on 2026-11-16 and 17 Saleor sent 39 589 notices in 18.5
 * hours, with a peak of 1 145 a minute. At one flush per key every 30 s (`REVALIDATE_WINDOW_MS`) the lists
 * of twelve markets, their categories, the offers, the homepage and the sitemap data were rebuilt twice a
 * minute for as long as the batch lasted, each rebuild paid for by Saleor's two CPUs. Saleor asked for it to
 * be once in five minutes while a batch lasts, and the product page, which is one record, to stay immediate.
 *
 * "In a batch" means more than `BATCH_EVENTS_PER_MINUTE` accepted requests in the last 60 seconds. It is
 * read per request, so it ends by itself a minute after the rate falls and a single edit outside a batch
 * keeps the 30 s window.
 */
export const BATCH_EVENTS_PER_MINUTE = 100;
export const BATCH_WINDOW_MS = 5 * 60_000;

const BUCKETS = 60;
const STATE = Symbol.for("maky.revalidate-load");

interface Load {
	/** The second each bucket last counted, and what it counted. */
	seconds: Float64Array;
	counts: Float64Array;
}

function load(): Load {
	const holder = globalThis as unknown as Record<symbol, Load | undefined>;
	return (holder[STATE] ??= {
		seconds: new Float64Array(BUCKETS).fill(-1),
		counts: new Float64Array(BUCKETS),
	});
}

/**
 * Counts one request that passed authentication. A refused request is not counted: whoever can send a
 * bad signature must not be able to stretch the window of the real ones.
 */
export function noteRevalidateArrival(now: number = Date.now()): void {
	const state = load();
	const second = Math.floor(now / 1000);
	const bucket = second % BUCKETS;
	if (state.seconds[bucket] !== second) {
		state.seconds[bucket] = second;
		state.counts[bucket] = 0;
	}
	state.counts[bucket]!++;
}

/** Requests counted in the 60 seconds up to `now`. */
export function arrivalsInLastMinute(now: number = Date.now()): number {
	const state = load();
	const second = Math.floor(now / 1000);
	let total = 0;
	for (let bucket = 0; bucket < BUCKETS; bucket++) {
		const age = second - state.seconds[bucket]!;
		if (age >= 0 && age < BUCKETS) total += state.counts[bucket]!;
	}
	return total;
}

export const inBatch = (now: number = Date.now()): boolean =>
	arrivalsInLastMinute(now) > BATCH_EVENTS_PER_MINUTE;

/** How long the throttle holds market-wide work for a request that arrives now. */
export const revalidateWindowMs = (now: number = Date.now()): number =>
	inBatch(now) ? BATCH_WINDOW_MS : REVALIDATE_WINDOW_MS;

/** For tests. */
export function __resetRevalidateLoad(): void {
	const state = load();
	state.seconds.fill(-1);
	state.counts.fill(0);
}
