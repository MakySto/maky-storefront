/**
 * The favourites list's pure half — what a stored list may contain and what a click does to it.
 * Shared by the browser store (`store.ts`) and the server action that loads the products
 * (`actions.ts`), which must not import React hooks.
 */

/** Enough for any real shortlist, and a bound on what one page load asks Saleor for. */
export const WISHLIST_MAX = 60;

export const EMPTY_WISHLIST: readonly string[] = Object.freeze([]);

/** A Saleor global id: base64 of `Product:<n>`. Anything else is not ours to keep. */
const PRODUCT_ID = /^[A-Za-z0-9+/]{4,80}={0,2}$/;

export function isWishlistProductId(value: unknown): value is string {
	return typeof value === "string" && PRODUCT_ID.test(value);
}

/** The stored list, validated — pure, for the store and the tests. */
export function parseStoredWishlist(raw: string | null): readonly string[] {
	if (!raw) return EMPTY_WISHLIST;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return EMPTY_WISHLIST;
		const ids = [...new Set(parsed.filter(isWishlistProductId))];
		return ids.length ? ids.slice(0, WISHLIST_MAX) : EMPTY_WISHLIST;
	} catch {
		return EMPTY_WISHLIST;
	}
}

/** The list after one click on a heart: newest first, never over the limit. Pure. */
export function toggledWishlist(ids: readonly string[], id: string): readonly string[] {
	if (ids.includes(id)) return ids.filter((existing) => existing !== id);
	return [id, ...ids].slice(0, WISHLIST_MAX);
}
