/**
 * A process-local memo whose entries expire on a TIMER, never on a clock read.
 *
 * ## Why not `expiresAt > Date.now()`
 *
 * That is the obvious shape and it breaks preview markets. Under `cacheComponents`, Next
 * builds a route's static shell at request time for any route it did not prerender, and
 * inside that shell reading the current time before reading uncached or request data is
 * refused:
 *
 *     Route "/[channel]/categories/[slug]/[...vehicle]" used `Date.now()` before accessing
 *     either uncached data (e.g. `fetch()`) or Request data … NEXT_STATIC_GEN_BAILOUT
 *
 * The result is an HTTP 500, and only on the markets nobody looks at: `generateStaticParams`
 * emits the default channel alone, so `/sk` is prerendered and fine while `/cz` and `/de`
 * render on demand and fail. Measured on production 2026-09-12 — `/sk/stresne-nosice/bmw`
 * 200, `/cz/stresne-nosice/bmw` 500 — with `noindex` on the preview markets hiding it from
 * every crawler and every uptime check pointed at `/sk`.
 *
 * Expiring on a timer keeps the same TTL and removes the clock from the read path
 * entirely: a hit is a map lookup and nothing more. The timer is `unref`ed so a pending
 * expiry never holds the process open, and re-setting a key reschedules rather than
 * stacking timers.
 *
 * This is a memo, not a cache with guarantees: entries may vanish early (a restart) and a
 * caller must always be able to reload. That is exactly how both callers already behave.
 */
export interface ExpiringMemo<V> {
	/** The value, only while it is still fresh. */
	get(key: string): V | undefined;
	/**
	 * The value whether fresh or stale.
	 *
	 * Expiry marks an entry stale; it does not throw it away. That distinction is the
	 * whole point of the fallback both callers rely on: "a failed refresh must not evict a
	 * good snapshot". Deleting on expiry would mean the first failed reload after a TTL
	 * turns a working page into an empty one, which is strictly worse than serving prose
	 * that is fifteen minutes old.
	 *
	 * Nothing is ever evicted, and nothing needs to be: the key space is the set of
	 * languages, which is closed and small.
	 */
	getStale(key: string): V | undefined;
	/** Replaces any existing entry for `key`, marks it fresh, and reschedules its expiry. */
	set(key: string, value: V, ttlMs: number): void;
	clear(): void;
	/** For tests and diagnostics — entries held, fresh or stale. */
	readonly size: number;
}

export function createExpiringMemo<V>(): ExpiringMemo<V> {
	const entries = new Map<string, { value: V; fresh: boolean }>();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	const cancel = (key: string) => {
		const timer = timers.get(key);
		if (timer) {
			clearTimeout(timer);
			timers.delete(key);
		}
	};

	return {
		get: (key) => {
			const entry = entries.get(key);
			return entry?.fresh ? entry.value : undefined;
		},
		getStale: (key) => entries.get(key)?.value,
		set: (key, value, ttlMs) => {
			cancel(key);
			entries.set(key, { value, fresh: true });
			const timer = setTimeout(() => {
				const entry = entries.get(key);
				// Stale, not gone. The next read reloads; if that reload fails, the caller
				// can still fall back to this.
				if (entry) entry.fresh = false;
				timers.delete(key);
			}, ttlMs);
			// Node only; a pending expiry must not be a reason for the process to stay alive.
			timer.unref?.();
			timers.set(key, timer);
		},
		clear: () => {
			for (const key of [...timers.keys()]) cancel(key);
			entries.clear();
		},
		get size() {
			return entries.size;
		},
	};
}
