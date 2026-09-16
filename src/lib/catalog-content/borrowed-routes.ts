import { catalogLanguageForMarket } from "./language";
import table from "./borrowed-routes.json";

/**
 * Pages a foreign catalogue still publishes under the SLOVAK root.
 *
 * RELEASE-4 moved three generations (Golf Variant BA5, H-1 Van A1, Legacy Kombi BH) onto new
 * pages that have Slovak text only, and CFM published them in all nine foreign artifacts at
 * the Slovak path — `/stresne-nosice/subaru/legacy-kombi/bh` inside the Czech catalogue, next to
 * 1 475 pages under `/stresni-nosice/`. Those three URLs are real pages abroad, so the
 * localized-root alias (`/cz/stresne-nosice/…` → `/cz/stresni-nosice/…`) must leave them alone,
 * and the reverse spelling must lead to them.
 *
 * Data, keyed by CFM language like `redirects.json`, because the next release decides it —
 * a translated BH page would move from this list to the localized root with no code change.
 * No `server-only`: the proxy reads it before every request.
 */

export interface BorrowedRoutesTable {
	/** The CFM delivery the list was taken from. */
	readonly release: string;
	readonly source: string;
	/** Language → market-relative paths, spelled as the artifacts spell them. */
	readonly paths: Readonly<Record<string, readonly string[]>>;
}

export const BORROWED_ROUTES: BorrowedRoutesTable = table;

const BY_LANGUAGE = new Map(
	Object.entries(BORROWED_ROUTES.paths).map(([language, paths]) => [language, new Set(paths)]),
);

/** Whether `path` (market-relative, normalized) is a borrowed Slovak page in this market's catalogue. */
export function isBorrowedCatalogPath(market: string, path: string): boolean {
	const language = catalogLanguageForMarket(market);
	return Boolean(language && BY_LANGUAGE.get(language)?.has(path));
}
