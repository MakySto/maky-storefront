import { catalogLanguageForMarket } from "./language";
import table from "./redirects.json";

/**
 * Retired vehicle-page URLs, and where each one lives now.
 *
 * CFM retires a vehicle page when the car it described turns out to be a different car. The
 * products move to the right generation and the fitment tree drops the old node, but the
 * page itself stays in the content export — published, with text, possibly indexed. Nothing
 * routes it any more (`tree.ts` builds nodes from fitment only), so without an entry here it
 * answers 200 with the not-found body. `src/proxy.ts` answers it with a 301 instead.
 *
 * ## Data, keyed the way CFM ships it
 *
 * `redirects.json` is keyed by CFM language, with paths spelled as the artifacts spell them:
 * no market prefix. A market reads the table of the language it reads its catalogue in, so
 * `at` answers like `de` and `ca` like `us` from one entry each. A release that retires or
 * re-targets a page changes the JSON and nothing else.
 *
 * - `exact`: one retired path → its replacement.
 * - `roots`: a retired category root → its replacement, and every path below moves with it.
 *   Spain's `/bacas-de-techo` became `/barras-de-techo` in the 2026-09-13 re-export.
 *
 * Targets are final. No exact target is itself a source (tested), and a root move that lands
 * on a retired path answers with that path's own target — nobody is sent through two hops.
 *
 * No `server-only` and no I/O: the proxy imports this, and the proxy runs before every request.
 */

type Table = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface CatalogRedirectTable {
	/** The CFM delivery the table was taken from. */
	readonly release: string;
	readonly source: string;
	readonly exact: Table;
	readonly roots: Table;
}

export const CATALOG_REDIRECTS: CatalogRedirectTable = table;

const EXACT = new Map(
	Object.entries(CATALOG_REDIRECTS.exact).map(([language, paths]) => [
		language,
		new Map(Object.entries(paths)),
	]),
);

const ROOTS = new Map(
	Object.entries(CATALOG_REDIRECTS.roots).map(([language, roots]) => [language, Object.entries(roots)]),
);

/**
 * Where a retired catalogue path lives now in `market`, or `null` when it is not retired.
 *
 * Both paths are market-relative: `("at", "/dachtraeger/subaru/legacy-kombi/bp")` gives
 * `"/dachtraeger/subaru/legacy-kombi"`. `path` must already be normalized — no `.rsc`
 * suffix, no trailing slash — which is what the proxy hands it.
 */
export function catalogRedirectTarget(market: string, path: string): string | null {
	const language = catalogLanguageForMarket(market);
	if (!language) return null;

	const exact = EXACT.get(language);
	const direct = exact?.get(path);
	if (direct) return direct;

	for (const [from, to] of ROOTS.get(language) ?? []) {
		if (path !== from && !path.startsWith(`${from}/`)) continue;
		const moved = to + path.slice(from.length);
		return exact?.get(moved) ?? moved;
	}
	return null;
}
