"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * How a product listing is laid out: a grid (the default) or a list.
 *
 * A reader's preference, kept in this browser the way the favourites are (`lib/wishlist/store`):
 * `localStorage`, read defensively. It is NOT part of the URL — a layout is not a different page, so
 * switching it never makes a new address, never changes a canonical and never touches the filters,
 * the order, the page or the vehicle, all of which live in the URL or in their own state.
 *
 * Hydration: the server cannot know the preference, so the server snapshot is always "grid" and the
 * first client render matches it. `useSyncExternalStore` then moves to the stored value after
 * hydration, which is a normal re-render and not a mismatch.
 */
export type ListingView = "grid" | "list";

const STORAGE_KEY = "maky.listing-view";
const CHANGE_EVENT = "maky:listing-view";

function read(): ListingView {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
	} catch {
		// Private mode, blocked storage, a sandboxed frame: the default, silently.
		return "grid";
	}
}

function subscribe(onChange: () => void): () => void {
	window.addEventListener("storage", onChange);
	window.addEventListener(CHANGE_EVENT, onChange);
	return () => {
		window.removeEventListener("storage", onChange);
		window.removeEventListener(CHANGE_EVENT, onChange);
	};
}

export function useListingView(): [ListingView, (view: ListingView) => void] {
	const view = useSyncExternalStore<ListingView>(subscribe, read, () => "grid");
	const setView = useCallback((next: ListingView) => {
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// The choice still applies to this page view through the event below; it just is not kept.
		}
		window.dispatchEvent(new Event(CHANGE_EVENT));
	}, []);
	return [view, setView];
}
