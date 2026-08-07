import { MarketNotFound } from "@/ui/components/market-not-found";

/**
 * The 404 body for every route under a market.
 *
 * Without this file, every `notFound()` outside the `[productSlug]` segment —
 * categories, collections, Saleor pages, search, the seven Slovak legal pages and
 * the CMS routes — fell through to `src/app/not-found.tsx`, which is hardcoded
 * English and was being rendered inside Slovak chrome.
 */
export default function MarketNotFoundBoundary() {
	return <MarketNotFound />;
}
