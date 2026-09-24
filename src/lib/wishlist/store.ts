import { useSyncExternalStore } from "react";
import { EMPTY_WISHLIST as EMPTY, isWishlistProductId, parseStoredWishlist, toggledWishlist } from "./ids";

export { WISHLIST_MAX } from "./ids";

/**
 * Favourites — the products a shopper marked with the heart, kept in THIS browser.
 *
 * The owner asked for the foundation of a wishlist (2026-09-24). This is it, and it is a real
 * list rather than a decoration: the heart on a card or a product page adds and removes, the
 * header's "Obľúbené" counts, and `/{market}/oblubene` shows the products with today's price.
 *
 * What it deliberately is NOT yet:
 *
 * - Not an account feature. The ids live in `localStorage`, so the list belongs to one browser
 *   and survives a reload, not a change of device. Keeping it on the customer's account means
 *   writing to Saleor (user metadata) on every click — a production write this change does not
 *   make. The store is the seam for it: the same ids, a second persistence.
 * - Not market-bound. A Saleor product id is the same product in every channel, so one list
 *   serves every market; the page asks the current channel for the price.
 *
 * Only ids are stored — never a name or a price, which would go stale. Anything unexpected in
 * storage (another shape, a foreign value) reads as an empty list rather than as an error.
 */

const STORAGE_KEY = "maky:wishlist:v1";

let snapshot: readonly string[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): readonly string[] {
	try {
		return parseStoredWishlist(window.localStorage.getItem(STORAGE_KEY));
	} catch {
		// Storage can throw outright (blocked site data); that is an empty list, not a fault.
		return EMPTY;
	}
}

function getSnapshot(): readonly string[] {
	if (snapshot === null) snapshot = readStorage();
	return snapshot;
}

// The server renders every heart empty; the browser fills them in on hydration. Same size,
// so nothing moves.
function getServerSnapshot(): readonly string[] {
	return EMPTY;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	// Another tab changed the list: drop the cached copy and re-read.
	const onStorage = (event: StorageEvent) => {
		if (event.key !== null && event.key !== STORAGE_KEY) return;
		snapshot = null;
		listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

function write(ids: readonly string[]) {
	snapshot = ids;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch {
		// A private window without storage keeps the list for this page's lifetime only.
	}
	for (const listener of listeners) listener();
}

/** The saved product ids, newest first. Empty on the server and in the first client render. */
export function useWishlist(): readonly string[] {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Adds or removes one product. Returns whether it is saved afterwards. */
export function toggleWishlist(id: string): boolean {
	if (!isWishlistProductId(id)) return false;
	const next = toggledWishlist(getSnapshot(), id);
	write(next);
	return next.includes(id);
}

export function removeFromWishlist(id: string) {
	const current = getSnapshot();
	if (current.includes(id)) write(current.filter((existing) => existing !== id));
}
