import { MarketSwitchRegistrar } from "./market-switch-registry";

/**
 * Market-relative paths (`{ cz: "/stresni-nosic-…" }`, what the hreflang cluster is built from)
 * as site paths (`{ cz: "/cz/stresni-nosic-…" }`).
 *
 * No I/O, no lookup: the market key IS the URL prefix, exactly as `counterpartAlternates`
 * writes the hreflang links from the same pairs.
 */
export function marketSitePaths(paths: Readonly<Record<string, string>>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(paths).map(([market, path]) => [market, `/${market}${path === "/" ? "" : path}`]),
	);
}

/**
 * Hands the header's market switcher the same entity in every live market (see
 * `market-switch-registry.tsx`). Takes market-relative paths, as every entity page computes
 * them, and turns them into site paths HERE, on the server, before they cross into the client
 * component: whatever crosses is written into the page's RSC payload, and every path a crawler
 * finds there must be a page that exists.
 */
export function MarketSwitchTargets({ paths }: { paths: Readonly<Record<string, string>> }) {
	return <MarketSwitchRegistrar sitePaths={marketSitePaths(paths)} />;
}
