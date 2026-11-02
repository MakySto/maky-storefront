import "server-only";

import type { ViesResult } from "./vies-client";

/**
 * A per-process cache and admission gate in front of VIES.
 *
 * A cache, not a store of proof: the backend keeps the protected attestation and applies the 24 hours itself from
 * the ORIGINAL `checkedAt`. Two processes (live and bridge) simply miss each other's entries. Nothing here can
 * make an answer younger than it is — a hit returns the entry exactly as VIES gave it, `checkedAt` included.
 *
 * - VALID lives at most 24 h from its original check (a little less, so it is not handed over on its last second);
 * - INVALID is held briefly, so a corrected number or a VIES correction is seen soon;
 * - UNAVAILABLE is a short backoff, never 24 hours.
 * Identical concurrent questions share one request. A checkout may ask a bounded number of times per window, and
 * the process runs a bounded number of VIES requests at once.
 */

export const VIES_POSITIVE_TTL_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;
export const VIES_NEGATIVE_TTL_MS = 10 * 60 * 1000;
export const VIES_UNAVAILABLE_BACKOFF_MS = 30 * 1000;
export const VIES_MAX_CHECKS_PER_CHECKOUT = 8;
export const VIES_CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
export const VIES_MAX_CONCURRENT = 4;
const MAX_ENTRIES = 2_000;

type CacheEntry = { result: ViesResult; storedUntil: number };

type ViesGateState = {
	entries: Map<string, CacheEntry>;
	inFlight: Map<string, Promise<ViesResult>>;
	checkoutWindows: Map<string, number[]>;
	active: number;
};

const STATE_KEY = Symbol.for("maky.b2b.vies-gate.v1");
type Registry = typeof globalThis & { [STATE_KEY]?: ViesGateState };

function state(): ViesGateState {
	const registry = globalThis as Registry;
	registry[STATE_KEY] ??= { entries: new Map(), inFlight: new Map(), checkoutWindows: new Map(), active: 0 };
	return registry[STATE_KEY];
}

/** Test seam. */
export function resetViesGate(): void {
	delete (globalThis as Registry)[STATE_KEY];
}

function lifetimeOf(result: ViesResult, now: number): number {
	const checkedAt = Date.parse(result.checkedAt);
	const base = Number.isFinite(checkedAt) ? checkedAt : now;
	switch (result.status) {
		case "VALID":
			return base + VIES_POSITIVE_TTL_MS;
		case "INVALID":
			return base + VIES_NEGATIVE_TTL_MS;
		default:
			return base + VIES_UNAVAILABLE_BACKOFF_MS;
	}
}

function remember(gate: ViesGateState, result: ViesResult, now: number): void {
	const storedUntil = lifetimeOf(result, now);
	if (storedUntil <= now) return;
	if (gate.entries.size >= MAX_ENTRIES) {
		const oldest = gate.entries.keys().next().value;
		if (oldest !== undefined) gate.entries.delete(oldest);
	}
	gate.entries.set(result.vatId, { result, storedUntil });
}

function admitCheckout(gate: ViesGateState, checkoutId: string, now: number): boolean {
	const recent = (gate.checkoutWindows.get(checkoutId) ?? []).filter(
		(at) => now - at < VIES_CHECKOUT_WINDOW_MS,
	);
	if (recent.length >= VIES_MAX_CHECKS_PER_CHECKOUT) {
		gate.checkoutWindows.set(checkoutId, recent);
		return false;
	}
	recent.push(now);
	gate.checkoutWindows.set(checkoutId, recent);
	if (gate.checkoutWindows.size > MAX_ENTRIES) {
		const oldest = gate.checkoutWindows.keys().next().value;
		if (oldest !== undefined) gate.checkoutWindows.delete(oldest);
	}
	return true;
}

export type CachedViesCheck = {
	vatId: string;
	checkoutId: string;
	check: () => Promise<ViesResult>;
	now?: () => number;
};

export type CachedViesOutcome = { result: ViesResult; source: "cache" | "shared" | "vies" | "limited" };

export async function cachedViesCheck({
	vatId,
	checkoutId,
	check,
	now = Date.now,
}: CachedViesCheck): Promise<CachedViesOutcome> {
	const gate = state();
	const at = now();

	const hit = gate.entries.get(vatId);
	if (hit && hit.storedUntil > at) return { result: hit.result, source: "cache" };
	if (hit) gate.entries.delete(vatId);

	const shared = gate.inFlight.get(vatId);
	if (shared) return { result: await shared, source: "shared" };

	const limited = (detail: string): CachedViesOutcome => ({
		source: "limited",
		result: {
			status: "UNAVAILABLE",
			vatId,
			checkedAt: new Date(at).toISOString(),
			requestIdentifier: null,
			name: null,
			address: null,
			detail,
		},
	});
	if (gate.active >= VIES_MAX_CONCURRENT) return limited("local-concurrency-limit");
	if (!admitCheckout(gate, checkoutId, at)) return limited("local-checkout-limit");

	gate.active++;
	const run = (async () => {
		try {
			// Deferred a microtask, so `inFlight` is registered before anything below can settle.
			const result = await Promise.resolve().then(check);
			remember(gate, result, now());
			return result;
		} catch {
			return limited("check-threw").result;
		} finally {
			gate.active--;
			gate.inFlight.delete(vatId);
		}
	})();
	gate.inFlight.set(vatId, run);
	return { result: await run, source: "vies" };
}
