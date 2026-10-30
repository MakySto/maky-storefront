import { KARGO_CATEGORY_SLUGS } from "./category-routes";

/**
 * Where a product the channel does not sell is shown WITHOUT a price, with the way to ask for a quote in its place.
 *
 * A product the shop shows but a market cannot order (`isAvailableForPurchase` not `true` in that channel — the
 * United States and Canada for the car fridges, 2026-10-08) says so and offers "request a quote" (`quote-request.ts`).
 * The car fridges keep their price beside that. Nordrive Kargo does not (owner, 2026-10-28): its sets are written to
 * the US and Canadian channels with a price, because Saleor wants one to list a product at all, and the owner wants
 * the quote button instead of it. So the rule is two facts together — the product is not for sale in this channel,
 * and its category is one of these — and never the category alone: in a market that sells the set, the price stays.
 *
 * Keyed by the BASE category slug, as `fitment-shelves.ts` is, and by both slugs Kargo has had (`KARGO_CATEGORY_SLUGS`). Adding a slug here changes no URL and nothing else.
 */
const QUOTE_INSTEAD_OF_PRICE_CATEGORIES: ReadonlySet<string> = new Set(KARGO_CATEGORY_SLUGS);

/**
 * Whether a surface shows no price for this product: it cannot be ordered in the channel and its category asks for a
 * quote instead. An unknown category (`null`, a surface that does not carry it) never hides a price.
 */
export function quoteInsteadOfPrice(product: {
	isPurchasable: boolean;
	categorySlug?: string | null;
}): boolean {
	return (
		!product.isPurchasable &&
		Boolean(product.categorySlug) &&
		QUOTE_INSTEAD_OF_PRICE_CATEGORIES.has(product.categorySlug!)
	);
}
