import { type FitmentDataset } from "./contract";
import { isDatasetStale } from "./resolve";
import { agreedIncludes, sellableRefsOf } from "./set-facts";

/**
 * What CFM documents a set to contain, for the product page: `["bars", "feet", "fitting-kit"]`, or
 * null when it does not say.
 *
 * The same rows the page's "Určené pre" box reads (accepted, sellable, not a negative row, a dataset
 * that is not past its date) — so the contents are only ever stated for an offer the page itself
 * describes. The rule for several rows that disagree, or none that speaks, is `agreedIncludes`, the
 * one the listing cards use too.
 */
export function documentedSetContents(
	dataset: FitmentDataset | null,
	saleorProductId: string,
	saleorVariantId?: string,
	now: number = Date.now(),
): readonly string[] | null {
	if (!dataset || isDatasetStale(dataset, now)) return null;
	return agreedIncludes(sellableRefsOf(dataset, saleorProductId, saleorVariantId));
}
