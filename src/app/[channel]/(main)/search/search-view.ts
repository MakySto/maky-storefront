import { type SearchResult } from "@/lib/search/types";

/**
 * What the search page shows for an answer.
 *
 * `unavailable` comes first because a Saleor outage and "nothing matches" both arrive as zero
 * products. The provider has flagged the outage since it stopped hiding it (`saleor-provider.ts`),
 * but the page still printed "No results for …" for it until 2026-09-26 — telling a shopper the
 * shop does not carry what they typed, while it could not look.
 */
export function searchView(
	result: Pick<SearchResult, "unavailable" | "pagination">,
): "unavailable" | "empty" | "results" {
	if (result.unavailable) return "unavailable";
	return result.pagination.totalCount === 0 ? "empty" : "results";
}
