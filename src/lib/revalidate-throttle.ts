/**
 * Coalesces the work a burst of Saleor events asks for.
 *
 * A product event carries no channel, so each one expires the category, the offers, the product
 * list path, the homepage and the sitemap tag of all twelve markets. One event is cheap; a catalogue
 * write is not: CFM changes hundreds to tens of thousands of products in a run, and every expiry
 * is paid for by the next visit, a robot included, with the heavy reads (`COUNT(*)` over a
 * category) the listing is built from. 500 events in a minute would have made 500 recomputes of
 * the same entries, which is the load on Saleor this is meant to take away.
 *
 * So the work is grouped under a KEY (what it expires: one market's shared entries, one category in
 * one market) and runs at most once per window:
 *
 * - the first event after a quiet window runs it at once (a single edit is as fast as before);
 * - events inside the window only remember that the work is due, and ONE flush is scheduled for the
 *   end of the window (`flushInMs`), which then runs it once for all of them.
 *
 * The flush has to run inside a request: `revalidateTag` and `revalidatePath` need the request's
 * store and do nothing useful from a bare timer. The route hands it to `after()`, which keeps that
 * store. If the flush cannot be scheduled or never runs, the next event carries the pending work
 * (the first one past the window runs the latest closure), and the entries' own lifetime is the end
 * of the line.
 *
 * What is NOT coalesced: the one product page the event names (a single record), and any event
 * about a category itself (rare, and a rename must show at once). Those are the route's call.
 */
export const REVALIDATE_WINDOW_MS = 30_000;

interface Slot {
	lastRunAt: number;
	pending: (() => void) | null;
	flushScheduled: boolean;
}

const SLOTS = Symbol.for("maky.revalidate-throttle.slots");

function slots(): Map<string, Slot> {
	const holder = globalThis as unknown as Record<symbol, Map<string, Slot> | undefined>;
	return (holder[SLOTS] ??= new Map());
}

export type Submitted =
	| { outcome: "ran" }
	/** `flushInMs` is set for the one submission that has to schedule the flush; null for the others. */
	| { outcome: "deferred"; flushInMs: number | null };

/**
 * Runs `work` now when the key has been quiet for `windowMs`, else remembers it (the newest `work` of
 * a key replaces the older: all work under one key must expire the same things).
 */
export function submitThrottled(
	key: string,
	work: () => void,
	now: number = Date.now(),
	windowMs: number = REVALIDATE_WINDOW_MS,
): Submitted {
	const map = slots();
	const slot = map.get(key);
	if (!slot || now - slot.lastRunAt >= windowMs) {
		map.set(key, { lastRunAt: now, pending: null, flushScheduled: slot?.flushScheduled ?? false });
		work();
		return { outcome: "ran" };
	}
	slot.pending = work;
	if (slot.flushScheduled) return { outcome: "deferred", flushInMs: null };
	slot.flushScheduled = true;
	return { outcome: "deferred", flushInMs: Math.max(0, slot.lastRunAt + windowMs - now) };
}

/** Runs what the key is owed, if anything. Call it from inside a request (`after`). */
export function flushThrottled(key: string, now: number = Date.now()): boolean {
	const slot = slots().get(key);
	if (!slot) return false;
	slot.flushScheduled = false;
	const work = slot.pending;
	if (!work) return false;
	slot.pending = null;
	slot.lastRunAt = now;
	work();
	return true;
}

/** The flush could not be scheduled: the work stays pending, and a later submission tries to schedule it again. */
export function abandonFlush(key: string): void {
	const slot = slots().get(key);
	if (slot) slot.flushScheduled = false;
}

/** For tests. */
export function __resetRevalidateThrottle(): void {
	slots().clear();
}
