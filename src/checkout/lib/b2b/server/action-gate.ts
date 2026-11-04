import "server-only";

/**
 * How often one checkout may run the B2B server actions (save input, evaluate, release a payment lock, read it) —
 * per process, in memory.
 *
 * Generous for a person (every save, every delivery change and every payment attempt is one call), tight for a
 * script. VIES has its own, stricter gate (`vies-cache.ts`); this one bounds the Saleor reads and writes.
 */

export const B2B_ACTIONS_PER_CHECKOUT = 40;
export const B2B_ACTION_WINDOW_MS = 10 * 60 * 1000;
/**
 * Reads of the payment lock while the customer waits for a cancelation to be confirmed (a public read of
 * `b2bTaxState.paymentLocked`, no token, nothing written). One wait asks about ten times in 30 s, so this leaves room
 * for several waits and still stops a script.
 */
export const B2B_LOCK_READS_PER_CHECKOUT = 120;
const MAX_KEYS = 4_000;

const STATE_KEY = Symbol.for("maky.b2b.action-gate.v1");
const READ_STATE_KEY = Symbol.for("maky.b2b.lock-read-gate.v1");
type Registry = typeof globalThis & {
	[STATE_KEY]?: Map<string, number[]>;
	[READ_STATE_KEY]?: Map<string, number[]>;
};

function windows(key: typeof STATE_KEY | typeof READ_STATE_KEY): Map<string, number[]> {
	const registry = globalThis as Registry;
	const existing = registry[key];
	if (existing) return existing;
	const created = new Map<string, number[]>();
	registry[key] = created;
	return created;
}

/** Test seam. */
export function resetB2bActionGate(): void {
	delete (globalThis as Registry)[STATE_KEY];
	delete (globalThis as Registry)[READ_STATE_KEY];
}

/** Save input, evaluate, release a payment lock: the calls that may write. */
export function admitB2bAction(checkoutId: string, now: number = Date.now()): boolean {
	return admit(windows(STATE_KEY), B2B_ACTIONS_PER_CHECKOUT, checkoutId, now);
}

/** The polls of the payment lock: their own budget, so waiting for a cancelation never uses up the one above. */
export function admitB2bLockRead(checkoutId: string, now: number = Date.now()): boolean {
	return admit(windows(READ_STATE_KEY), B2B_LOCK_READS_PER_CHECKOUT, checkoutId, now);
}

function admit(map: Map<string, number[]>, limit: number, checkoutId: string, now: number): boolean {
	const recent = (map.get(checkoutId) ?? []).filter((at) => now - at < B2B_ACTION_WINDOW_MS);
	if (recent.length >= limit) {
		map.set(checkoutId, recent);
		return false;
	}
	recent.push(now);
	// Re-insert so the Map's order is "least recently used first" for the eviction below.
	map.delete(checkoutId);
	map.set(checkoutId, recent);
	if (map.size > MAX_KEYS) {
		const oldest = map.keys().next().value;
		if (oldest !== undefined) map.delete(oldest);
	}
	return true;
}

/** A Saleor checkout id as this storefront passes it: a global id or token, never anything long or exotic. */
export function isPlausibleCheckoutId(value: unknown): value is string {
	return typeof value === "string" && /^[A-Za-z0-9+/=_-]{8,128}$/.test(value);
}
