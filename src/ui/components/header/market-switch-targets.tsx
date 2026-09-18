"use client";

import { useEffect } from "react";

/**
 * Where the entity on the current page lives in each LIVE market — registered by the page,
 * read by the header's market switcher (`HeaderMarketControls`).
 *
 * The switcher used to swap the market prefix and keep the rest of the path. That holds
 * for a page whose path is the same everywhere, and for nothing else: a product abroad is at
 * ITS market's translated slug (`/de/<german-slug>` is not a Czech URL), a category root is
 * localized (`/cz/stresni-nosice` vs `/de/dachtraeger`), and a vehicle page lives under that
 * root. The page already proves, per live market, where the same entity is — that is its
 * hreflang cluster — so it hands the same answer to the switcher instead of the switcher
 * guessing.
 *
 * Deliberately not a route, an endpoint or a second router: a page-scoped value in client
 * memory, cleared when the page unmounts, and keyed to the path it was registered on so a
 * stale registration can never answer for another page.
 */
type Registration = {
	readonly pathname: string;
	/** market → market-relative path, e.g. `{ cz: "/stresni-nosic-…" }`. */
	readonly paths: Readonly<Record<string, string>>;
};

let registered: Registration | null = null;

/** Register `paths` for the page at `pathname`; returns the unregister function. */
export function registerMarketSwitchTargets(
	pathname: string,
	paths: Readonly<Record<string, string>>,
): () => void {
	const entry: Registration = { pathname, paths };
	registered = entry;
	return () => {
		if (registered === entry) registered = null;
	};
}

export function MarketSwitchTargets({ paths }: { paths: Readonly<Record<string, string>> }) {
	useEffect(() => registerMarketSwitchTargets(window.location.pathname, paths), [paths]);
	return null;
}

/**
 * The switcher's answer for one target market, for the page at `pathname`:
 *
 * - a path — the same entity in that market, at that market's own URL;
 * - `null` — this page shows an entity that does not exist in that market (not published,
 *   or not complete in its language): go to that market's home rather than to a not-found;
 * - `undefined` — this page registered nothing, it is not an entity page: keep the path.
 */
export function registeredMarketTarget(pathname: string, market: string): string | null | undefined {
	if (!registered || registered.pathname !== pathname) return undefined;
	return registered.paths[market] ?? null;
}
