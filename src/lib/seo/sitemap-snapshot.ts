import { runDetached } from "@/lib/async/detached";

/**
 * The last COMPLETE answer of a slow read, kept in this process and handed out at once.
 *
 * ## Why the sitemap needs one
 *
 * A market's product shard is built from a walk of the whole Saleor catalogue: 92 to 120 pages of 100
 * products, one after another, because a cursor connection cannot be read in parallel. Measured on the
 * live box (2026-10-30) the Slovak shard costs 17.9 s cold; a foreign market's walk, which carries every
 * translation the exact-locale boundary reads, ~14 s. The walk sat behind Next's data cache
 * (`revalidate: 3600`, tag `sitemap:{channel}`), and that cache was the wrong tool for it:
 *
 *   - `/api/revalidate` expires the tag IMMEDIATELY on every product, category and translation event
 *     of the channel, so the next crawler (or the deploy's own check) paid the whole walk again.
 *   - The entries are memory-only (`cache-handler.mjs`) and a foreign market's pages weigh 0.5 to 1 MB
 *     each: twelve markets of them are about a gigabyte against a 256 MB LRU shared with every rendered
 *     page, so they were evicted before they were reused, and they pushed the rendered pages out.
 *   - Twelve walks started together (a crawler asking for every shard, or the deploy gate) take every
 *     one of the twelve Saleor slots, and a page render waits behind them.
 *
 * ## What this does instead
 *
 * The walk's RESULT (a slug and a date per product, ~100 bytes) is kept per channel and language. A
 * request is answered from it whatever its age; when it is due, one rebuild runs in the background and
 * replaces it only when it is complete:
 *
 *   due    older than `FRESH_MS`, or a catalogue event arrived after the build started and the answer is
 *          at least `MIN_REFRESH_AFTER_EVENT_MS` old (a CFM publish is hundreds of events in a minute; one
 *          rebuild covers them)
 *   never  a rebuild that failed replaces anything: the previous complete list stays, the next try waits
 *          `RETRY_AFTER_FAILURE_MS`. A short list is still never served, which is the rule `collectConnection`
 *          exists for; an OLD complete list is what Google itself keeps when a fetch fails.
 *   limit  past `MAX_STALE_MS` the request waits for a rebuild and fails if it fails, so a catalogue that
 *          cannot be read for a day shows up as an error and not as a week-old list.
 *
 * With no answer at all (the process has just started) a request builds it itself and every other asker
 * joins that build. `prewarm` in `product-walk.ts` does this from `instrumentation.ts`, so the first
 * crawler usually finds it done.
 *
 * ## Where the state lives
 *
 * On `globalThis`, like `live-categories.ts`: the shard route, the index route, `/api/revalidate` and
 * `instrumentation.ts` are separate module graphs, and the event must reach the store the shards read.
 *
 * Background builds run through `runDetached` (see `src/lib/async/detached.ts`) so they do not count as
 * the work of whichever request happened to start them, and at most `MAX_BACKGROUND_BUILDS` run at once:
 * the rest wait, leaving the other Saleor slots to the pages.
 */

/** A build older than this is rebuilt in the background. Same hour the data cache used. */
export const FRESH_MS = 60 * 60 * 1000;

/** An event marks the answer dirty, but a rebuild does not start until it is this old. */
export const MIN_REFRESH_AFTER_EVENT_MS = 5 * 60 * 1000;

/** After a failed rebuild, the next try is no sooner than this. */
export const RETRY_AFTER_FAILURE_MS = 60 * 1000;

/** Beyond this age the old answer is no longer served unless a fresh build succeeds. */
export const MAX_STALE_MS = 24 * 60 * 60 * 1000;

/** Rebuilds that may be walking Saleor at the same time (twelve slots are shared with every page). */
export const MAX_BACKGROUND_BUILDS = 2;

interface Entry {
	readonly value: unknown;
	readonly builtAt: number;
	/** When the build that produced it BEGAN: an event at or after this may not be in it. */
	readonly startedAt: number;
}

interface Slot {
	readonly channel: string;
	entry: Entry | null;
	inFlight: Promise<unknown> | null;
	/** Not before: a failed rebuild is not retried on every request. */
	retryAt: number;
}

interface Registry {
	readonly slots: Map<string, Slot>;
	/** Channel → when its latest catalogue event arrived. */
	readonly events: Map<string, number>;
	active: number;
	readonly waiting: Array<() => void>;
}

const REGISTRY_KEY = Symbol.for("maky.sitemap-snapshots.v1");

function registry(): Registry {
	const shared = globalThis as typeof globalThis & { [REGISTRY_KEY]?: Registry };
	shared[REGISTRY_KEY] ??= { slots: new Map(), events: new Map(), active: 0, waiting: [] };
	return shared[REGISTRY_KEY];
}

function slotFor(key: string, channel: string): Slot {
	const { slots } = registry();
	let slot = slots.get(key);
	if (!slot) {
		slot = { channel, entry: null, inFlight: null, retryAt: 0 };
		slots.set(key, slot);
	}
	return slot;
}

/** A catalogue event for this channel: the answer built before it is due for a rebuild. */
export function markSitemapStale(channel: string): void {
	registry().events.set(channel, Date.now());
}

function isDue(slot: Slot, now: number): boolean {
	const { entry } = slot;
	if (!entry) return true;
	if (now < slot.retryAt) return false;
	const age = now - entry.builtAt;
	if (age >= FRESH_MS) return true;
	const eventAt = registry().events.get(slot.channel) ?? 0;
	return eventAt >= entry.startedAt && age >= MIN_REFRESH_AFTER_EVENT_MS;
}

/** Runs `job` when one of the background places is free. */
async function inBackgroundLane<T>(job: () => Promise<T>): Promise<T> {
	const lane = registry();
	if (lane.active >= MAX_BACKGROUND_BUILDS) {
		await new Promise<void>((resolve) => lane.waiting.push(resolve));
	} else {
		lane.active++;
	}
	try {
		return await job();
	} finally {
		// The place passes straight to the next in line, or is given back.
		const next = lane.waiting.shift();
		if (next) next();
		else lane.active--;
	}
}

type Build<T> = () => Promise<T>;

/** One build per slot at a time; whoever asks while it runs joins it. */
function start<T>(slot: Slot, build: Build<T>, background: boolean): Promise<T> {
	if (slot.inFlight) return slot.inFlight as Promise<T>;
	const run = (): Promise<T> => {
		// `startedAt` is taken when the walk begins, not when it was queued: it is the moment the
		// catalogue was first read, which is what an event is compared with.
		const startedAt = Date.now();
		return build().then((value) => {
			slot.entry = { value, builtAt: Date.now(), startedAt };
			slot.retryAt = 0;
			return value;
		});
	};
	const task = (background ? inBackgroundLane(() => runDetached(run)) : run())
		.catch((error: unknown) => {
			slot.retryAt = Date.now() + RETRY_AFTER_FAILURE_MS;
			throw error;
		})
		.finally(() => {
			slot.inFlight = null;
		});
	slot.inFlight = task;
	return task;
}

function refreshInBackground<T>(slot: Slot, key: string, build: Build<T>): void {
	if (slot.inFlight) return;
	const heldSince = slot.entry ? Math.round((Date.now() - slot.entry.builtAt) / 1000) : null;
	start(slot, build, true).catch((error: unknown) => {
		console.warn(
			`[sitemap] ${key.replace("\u0000", "/")}: rebuild failed, ${
				heldSince === null ? "nothing to serve yet" : `still serving the list built ${heldSince} s ago`
			}:`,
			error instanceof Error ? error.message : error,
		);
	});
}

/**
 * The answer for `key`, immediately when there is one.
 *
 * `build` must return a COMPLETE answer or throw — the same contract as the walk it wraps. With nothing
 * kept yet the caller waits for the build (and a failed build throws to the caller); with something
 * kept the caller never waits, and a due rebuild is started in the background.
 */
export async function readSnapshot<T>(key: string, channel: string, build: Build<T>): Promise<T> {
	const slot = slotFor(key, channel);
	if (!slot.entry) return start(slot, build, false);

	const now = Date.now();
	if (now - slot.entry.builtAt > MAX_STALE_MS) return start(slot, build, false);
	if (isDue(slot, now)) refreshInBackground(slot, key, build);
	return slot.entry.value as T;
}

/**
 * The answer for `key` if there is one, else `undefined` — and no build. A due rebuild is still
 * started, so asking keeps the answer fresh. For the index, which wants exact counts when they are
 * free and falls back to a cheaper plan when they are not.
 */
export function peekSnapshot<T>(key: string, channel: string, build: Build<T>): T | undefined {
	const slot = slotFor(key, channel);
	if (!slot.entry) return undefined;
	const now = Date.now();
	if (now - slot.entry.builtAt > MAX_STALE_MS) return undefined;
	if (isDue(slot, now)) refreshInBackground(slot, key, build);
	return slot.entry.value as T;
}

/**
 * Have an answer ready, built in the background lane; resolves when it is, and never rejects (a
 * failure is logged, and the first request builds it itself). For the boot warm-up.
 */
export async function warmSnapshot<T>(key: string, channel: string, build: Build<T>): Promise<boolean> {
	const slot = slotFor(key, channel);
	if (slot.entry && !isDue(slot, Date.now())) return true;
	try {
		await start(slot, build, true);
		return true;
	} catch (error) {
		console.warn(
			`[sitemap] ${key.replace("\u0000", "/")}: warm-up failed:`,
			error instanceof Error ? error.message : error,
		);
		return false;
	}
}

/** For tests: forget every answer, event and build. */
export function resetSitemapSnapshotsForTests(): void {
	delete (globalThis as typeof globalThis & { [REGISTRY_KEY]?: Registry })[REGISTRY_KEY];
}
