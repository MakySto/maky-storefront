import { runDetached } from "@/lib/async/detached";
import { createExpiringMemo } from "./expiring-memo";

/**
 * A slow Saleor read that the visitor never waits for twice.
 *
 * ## What it is for
 *
 * The listing's side reads (the price bands, the maker filter, the row of sub-categories, the hreflang
 * counterparts) answer in 0.1 to 2 s depending on the category, and for a big one (the roof-rack sets,
 * 25 000 products in the Slovak channel) Saleor takes 1.5 to 1.9 s over a deadline of 2 s. Each of them
 * used to be one `"use cache"` entry whose miss went to Saleor with `AbortSignal.timeout(2 s)`, and that
 * has two consequences that add up to a page that is slow on every visit and not only on the first:
 *
 *   - **The work is thrown away when the visitor gives up.** The deadline aborts the request, so a Saleor
 *     that needs 2.1 s is never allowed to finish, nothing is kept, and the next visit starts from zero.
 *   - **A fault is remembered for 5 seconds** (`@/lib/cache-fault`), so after any pause longer than that
 *     the next visitor pays the whole deadline again. Measured on 2026-11-15 on `/sk/stresne-nosice`: the
 *     shell in 60 to 110 ms and the product list 2.9 to 3.5 s later after every 20 s of quiet, the three
 *     reads timing out together (46 "price filter left out", 67 "category navigation left out" since 18:57
 *     UTC), where the listing itself needs about a second.
 *
 * ## What it does instead
 *
 * Every key keeps the LAST ANSWER it ever got, and a visitor is never made to wait for a new one:
 *
 *   - **Fresh** (within `freshMs` of the last answer): the answer, at once.
 *   - **Stale**: the old answer, at once, and ONE refresh behind it (shared by every visitor, started from
 *     the context captured at boot, not from the render that happened to need it). A failed refresh keeps
 *     the old answer and leaves the key alone for `pauseMs`, so a struggling Saleor is asked once, not once
 *     per visit.
 *   - **Never answered** (a process that has just started): one load, shared by every visitor and given the
 *     whole `loadDeadlineMs` to finish, which is longer than a visitor waits. The visitor waits `waitMs` at
 *     most; when that passes it is told "still loading" (and renders without the part, as it did for a fault)
 *     while the load goes on, so the NEXT visitor finds the answer. `prewarm` does that load at boot.
 *
 * Nothing here decides how long an answer is true: the `"use cache"` entry above it, with its tags, still
 * decides what a prerender contains and when it is regenerated (`/api/revalidate` expires it as before).
 * What this adds is that the entry, when it is asked again, is never sent to Saleor with a visitor waiting
 * and a deadline in its hand.
 *
 * Process-local, like `ExpiringMemo` it is built on (timers, never a clock read: see that file). An answer
 * may vanish with a restart, so a caller must always be able to load.
 */
export interface KeptReadOptions<Arg, Value> {
	/** For the log lines and the "still loading" message. */
	readonly name: string;
	/** How long an answer is served without asking again. */
	readonly freshMs: number;
	/** How long a key is left alone after a failed load. */
	readonly pauseMs: number;
	/** How long a load may take in all. Nobody is made to wait for all of it. */
	readonly loadDeadlineMs: number;
	/** Reads from the source. Throws on a fault, with the message the caller will log. */
	readonly load: (arg: Arg, signal: AbortSignal) => Promise<Value>;
}

export interface KeptRead<Arg, Value> {
	/**
	 * The answer for `key`: fresh or stale at once, otherwise a load that the caller waits for at most
	 * `waitMs`. Throws the load's own error, or "still loading" when `waitMs` passed first.
	 */
	read(key: string, arg: Arg, waitMs: number): Promise<Value>;
	/** Loads `key` now when nothing fresh is held, waiting for all of it. Resolves to whether an answer is held. */
	prewarm(key: string, arg: Arg): Promise<boolean>;
	/** For tests. */
	forget(): void;
}

export function createKeptRead<Arg, Value>(options: KeptReadOptions<Arg, Value>): KeptRead<Arg, Value> {
	// Boxed, so that `null` (a category with no price bands) is an answer and `undefined` is "none held".
	const answers = createExpiringMemo<{ readonly value: Value }>();
	/** A key whose last load failed: present while it is left alone. */
	const paused = createExpiringMemo<Error>();
	const loading = new Map<string, Promise<Value>>();

	/** Joins the load running for `key`, or starts one, or says the key is being left alone. */
	function load(key: string, arg: Arg): Promise<Value> {
		const running = loading.get(key);
		if (running) return running;
		const pause = paused.get(key);
		if (pause) return Promise.reject(pause);

		const job = runDetached(() => options.load(arg, AbortSignal.timeout(options.loadDeadlineMs)))
			.then((value) => {
				answers.set(key, { value }, options.freshMs);
				return value;
			})
			.catch((error: unknown) => {
				const failure = error instanceof Error ? error : new Error(String(error));
				paused.set(key, failure, options.pauseMs);
				// With an earlier answer held nobody sees this fault, so the log is the only place it shows.
				if (answers.getStale(key)) {
					console.warn(
						`[${options.name}] refresh failed for ${key}, the earlier answer stays:`,
						failure.message,
					);
				}
				throw failure;
			})
			.finally(() => {
				loading.delete(key);
			});
		loading.set(key, job);
		// Whoever started it may not wait for it (a refresh behind a stale answer): a rejection nobody
		// awaits is not an unhandled one. Callers that do await still get it.
		job.catch(() => undefined);
		return job;
	}

	return {
		async read(key, arg, waitMs) {
			const fresh = answers.get(key);
			if (fresh) return fresh.value;

			const stale = answers.getStale(key);
			if (stale) {
				// Behind the answer; a pause or a failure is logged where it happens, once, not per visit.
				load(key, arg).catch(() => undefined);
				return stale.value;
			}

			const job = load(key, arg);
			let timer: ReturnType<typeof setTimeout> | undefined;
			const patience = new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`[${options.name}] still loading for ${key}`)), waitMs);
				timer.unref?.();
			});
			try {
				return await Promise.race([job, patience]);
			} finally {
				clearTimeout(timer);
			}
		},

		async prewarm(key, arg) {
			if (answers.get(key)) return true;
			try {
				await load(key, arg);
				return true;
			} catch {
				return answers.getStale(key) !== undefined;
			}
		},

		forget() {
			answers.clear();
			paused.clear();
			loading.clear();
		},
	};
}
