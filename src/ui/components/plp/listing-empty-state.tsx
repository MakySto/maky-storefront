"use client";

import { useTranslations } from "next-intl";

import { listingEmptyReason } from "./listing-empty-reason";

interface ListingEmptyStateProps {
	/**
	 * What the connection reports for this request — AFTER any server-side
	 * filter, BEFORE locale eligibility and before client-side filtering.
	 */
	totalCount: number;
	/** Rows this page lost because they carry no translation for this locale. */
	localeDropped: number;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
}

/**
 * An empty listing has several different causes, and they are not the same
 * sentence.
 *
 * Every listing used to answer with one line — "no products match your filters"
 * plus a "clear all filters" button — no matter why it was empty. On
 * `/sk/categories/stresne-nosice`, the flagship category, that told a visitor
 * who had touched nothing that their filters were the problem, and offered them
 * a button that clears nothing and changes nothing.
 *
 * The order of these branches is load-bearing. `totalCount` comes off the
 * filtered connection — `products(filter: $filter) { totalCount }` — so a price
 * filter that matches nothing reports `totalCount: 0` for a category holding a
 * hundred products (verified against live Saleor: `stresne-boxy` reports 101
 * unfiltered and 0 under `price: {gte: 99999}`). Reading that as "this category
 * is empty" would replace one false statement with another, so the filters are
 * asked about first — and when filters really are the cause, the button that
 * clears them is the one useful thing on the page.
 *
 * The fourth cause, an upstream fault, never reaches here: the listing throws
 * so the boundary renders an error, because a Saleor outage must never be
 * rendered as "there is nothing here".
 */
export function ListingEmptyState({
	totalCount,
	localeDropped,
	hasActiveFilters,
	onClearFilters,
}: ListingEmptyStateProps) {
	const t = useTranslations("plp");
	const reason = listingEmptyReason({ totalCount, localeDropped, hasActiveFilters });

	if (reason === "filtered-out") {
		return (
			<div className="py-12 text-center">
				<p className="text-text-secondary text-lg">{t("noProductsMatch")}</p>
				<button
					onClick={onClearFilters}
					className="text-text-primary mt-4 text-sm font-medium underline underline-offset-4"
				>
					{t("clearAllFilters")}
				</button>
			</div>
		);
	}

	// Stock exists in this market, but none of it carries content for this
	// language. Saying "empty" would be wrong in the one market where it is
	// most likely to be read as "you do not sell this".
	const message = reason === "untranslated" ? t("listingUntranslated") : t("listingEmpty");

	return (
		<div className="py-12 text-center">
			<p className="text-text-secondary text-lg">{message}</p>
		</div>
	);
}
