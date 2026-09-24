/**
 * Product ratings and reviews — the foundation (owner, 2026-09-24: "pripraviť základ pre
 * hodnotenia produktov hviezdičkami a pre recenzie").
 *
 * What exists today, and nothing more is claimed:
 *
 * - Saleor carries `Product.rating`, a single number per product. Nothing writes it yet — Saleor
 *   ships no review system and CFM publishes no score — so it is null across the catalogue, and
 *   every surface that draws stars asks `reviewSummaryFor` first and draws nothing for null.
 * - There is no count and no review text anywhere yet. `ProductReview` is the shape the product
 *   page's review section will take once a source exists; until then it has no data and renders
 *   nothing, and no "Napísať recenziu" button pretends a system is there.
 *
 * Where the reviews come from is still to be decided — a moderated Payload collection tied to a
 * Saleor order, or an external service (Heureka, Trustpilot). Whichever it is plugs in here: it
 * fills `count` and the list, and the stars, the count in brackets and the structured data's
 * `aggregateRating` (which Google accepts only with a count) follow from this one place.
 */

export interface ReviewSummary {
	/** 0–5, as the source states it; never rounded up for display. */
	readonly average: number;
	/** How many reviews the average stands on; null while no source counts them. */
	readonly count: number | null;
}

export interface ProductReview {
	readonly id: string;
	readonly author: string;
	readonly rating: number;
	readonly title: string | null;
	readonly body: string;
	readonly createdAt: string;
	/** Written by a customer whose order for this product is on record. */
	readonly verifiedPurchase: boolean;
}

/** The product's rating as the storefront may show it, or `null` for none. */
export function reviewSummaryFor(product: { readonly rating?: number | null }): ReviewSummary | null {
	const average = product.rating;
	if (typeof average !== "number" || !Number.isFinite(average) || average <= 0) return null;
	return { average: Math.min(average, 5), count: null };
}
