import "server-only";

/**
 * How often one checkout may run the B2B server actions (save input, evaluate) — per process, in memory.
 *
 * Generous for a person (every save, every delivery change and every payment attempt is one call), tight for a
 * script. VIES has its own, stricter gate (`vies-cache.ts`); this one bounds the Saleor reads and writes.
 */

export const B2B_ACTIONS_PER_CHECKOUT = 40;
export const B2B_ACTION_WINDOW_MS = 10 * 60 * 1000;
const MAX_KEYS = 4_000;

const STATE_KEY = Symbol.for("maky.b2b.action-gate.v1");
type Registry = typeof globalThis & { [STATE_KEY]?: Map<string, number[]> };

function windows(): Map<string, number[]> {
	const registry = globalThis as Registry;
	registry[STATE_KEY] ??= new Map();
	return registry[STATE_KEY];
}

/** Test seam. */
export function resetB2bActionGate(): void {
	delete (globalThis as Registry)[STATE_KEY];
}

export function admitB2bAction(checkoutId: string, now: number = Date.now()): boolean {
	const map = windows();
	const recent = (map.get(checkoutId) ?? []).filter((at) => now - at < B2B_ACTION_WINDOW_MS);
	if (recent.length >= B2B_ACTIONS_PER_CHECKOUT) {
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
