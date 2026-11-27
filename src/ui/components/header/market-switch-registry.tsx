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
 *
 * The values are SITE paths, market prefix included (`{ cz: "/cz/stresni-nosic-…" }`). They
 * reach this module as props of a client component, so they are written into the page's RSC
 * payload, where a crawler reads every string that looks like a path and asks for it from the
 * root of the domain. A market-relative path there (`/stresni-nosic-…`) is a URL no market
 * routes: Search Console counted 60 500 such 404s by 27 November 2026. Pages register through
 * `MarketSwitchTargets` (`market-switch-targets.tsx`), which adds the prefix on the server.
 */
type Registration = {
	readonly pathname: string;
	/** market → site path, e.g. `{ cz: "/cz/stresni-nosic-…" }`. */
	readonly sitePaths: Readonly<Record<string, string>>;
};

let registered: Registration | null = null;

/** Register `sitePaths` for the page at `pathname`; returns the unregister function. */
export function registerMarketSwitchTargets(
	pathname: string,
	sitePaths: Readonly<Record<string, string>>,
): () => void {
	const entry: Registration = { pathname, sitePaths };
	registered = entry;
	return () => {
		if (registered === entry) registered = null;
	};
}

export function MarketSwitchRegistrar({ sitePaths }: { sitePaths: Readonly<Record<string, string>> }) {
	useEffect(() => registerMarketSwitchTargets(window.location.pathname, sitePaths), [sitePaths]);
	return null;
}

/**
 * The switcher's answer for one target market, for the page at `pathname`:
 *
 * - a site path — the same entity in that market, at that market's own URL, prefix included;
 * - `null` — this page shows an entity that does not exist in that market (not published,
 *   or not complete in its language): go to that market's home rather than to a not-found;
 * - `undefined` — this page registered nothing, it is not an entity page: keep the path.
 */
export function registeredMarketTarget(pathname: string, market: string): string | null | undefined {
	if (!registered || registered.pathname !== pathname) return undefined;
	return registered.sitePaths[market] ?? null;
}
