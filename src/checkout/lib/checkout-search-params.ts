import { useMemo, useSyncExternalStore } from "react";
import { type ReadonlyURLSearchParams } from "next/navigation";

import { createQueryString } from "@/checkout/lib/utils/url";

/**
 * Shallow `?step=` plumbing for the checkout SPA (Track B.4.3, MIGRATION step 6).
 *
 * App Router does not expose the Pages-Router `shallow: true` for search-only updates, and a real
 * `router.push`/`router.replace` would re-run the whole checkout RSC page on every step change.
 * Instead we write the URL directly through the History API and notify subscribers with a custom
 * event, reading the live query with `useSyncExternalStore` (Next's `useSearchParams()` does not
 * reflect a `pushState` until a full navigation).
 */

/** Fired after a shallow history update so subscribers re-read `window.location.search`. */
export const CHECKOUT_QUERY_CHANGE = "checkout:query-change";

export type CheckoutQueryUpdate = Record<string, string | null>;

export type CheckoutQueryHistory = "push" | "replace";

export type UpdateCheckoutQueryOptions = {
	/** `shallow` (default) avoids re-running the checkout RSC page on step-only changes. */
	mode?: "shallow" | "navigate";
	pathname?: string;
	/**
	 * `replace` (default) overwrites the current entry — use for stepper jumps / back.
	 * `push` adds a history entry — use when advancing via Continue so browser Back walks steps.
	 */
	history?: CheckoutQueryHistory;
};

function normalizeSearchString(search: string): string {
	if (!search) {
		return "";
	}
	return search.startsWith("?") ? search.slice(1) : search;
}

function subscribeToCheckoutQuery(onStoreChange: () => void): () => void {
	window.addEventListener("popstate", onStoreChange);
	window.addEventListener(CHECKOUT_QUERY_CHANGE, onStoreChange);
	return () => {
		window.removeEventListener("popstate", onStoreChange);
		window.removeEventListener(CHECKOUT_QUERY_CHANGE, onStoreChange);
	};
}

function getLiveSearchString(): string {
	return normalizeSearchString(window.location.search);
}

/**
 * Live checkout query string, including shallow history updates that Next's `useSearchParams()`
 * does not reflect until a full navigation.
 */
export function useLiveCheckoutSearchString(serverFallback: string): string {
	return useSyncExternalStore(subscribeToCheckoutQuery, getLiveSearchString, () =>
		normalizeSearchString(serverFallback),
	);
}

/** Live checkout query params — includes shallow history updates. Read-only for consumers. */
export function useLiveCheckoutSearchParams(
	serverSearchParams: ReadonlyURLSearchParams,
): ReadonlyURLSearchParams {
	const searchString = useLiveCheckoutSearchString(serverSearchParams.toString());
	return useMemo(
		() => new URLSearchParams(searchString) as unknown as ReadonlyURLSearchParams,
		[searchString],
	);
}

/**
 * Build the next checkout URL from the live query string and internal param updates.
 * Exported for unit tests — the browser entry point is `updateCheckoutQuery`.
 */
export function buildCheckoutQueryUrl(
	liveSearch: string,
	updates: CheckoutQueryUpdate,
	pathname: string,
): string {
	const liveParams = new URLSearchParams(liveSearch);
	const query = createQueryString(liveParams as ReadonlyURLSearchParams, updates);
	return query ? `${pathname}?${query}` : pathname;
}

function writeCheckoutQueryHistory(url: string, history: CheckoutQueryHistory): void {
	const state = window.history.state;
	if (history === "push") {
		window.history.pushState(state, "", url);
	} else {
		window.history.replaceState(state, "", url);
	}
	window.dispatchEvent(new Event(CHECKOUT_QUERY_CHANGE));
}

/**
 * Update the checkout URL `?step=` (and other checkout params), merging into the LIVE URL bar so
 * ephemeral params (payment-return params, etc.) are never dropped. Shallow by design — never
 * triggers `router.replace` / an RSC re-run.
 */
export function updateCheckoutQuery(
	updates: CheckoutQueryUpdate,
	options: UpdateCheckoutQueryOptions = {},
): void {
	const { mode = "shallow", pathname = window.location.pathname, history = "replace" } = options;

	if (mode === "navigate") {
		throw new Error(
			"updateCheckoutQuery navigate mode is not implemented — use router.replace for full navigations",
		);
	}

	const url = buildCheckoutQueryUrl(window.location.search, updates, pathname);
	writeCheckoutQueryHistory(url, history);
}
