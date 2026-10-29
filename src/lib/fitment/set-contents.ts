import { type FitmentDataset } from "./contract";
import { isDatasetStale } from "./resolve";

/**
 * What CFM documents a set to contain, for the product page: `["bars", "feet", "fitting-kit"]`, or
 * null when it does not say.
 *
 * The same rows the page's "Určené pre" box reads (accepted, sellable, not a negative row, a dataset
 * that is not past its date) — so the contents are only ever stated for an offer the page itself
 * describes. A product reachable through several applications is documented once per application,
 * and those documents can disagree; then nothing is said, because picking one of two statements
 * about what is in the box would be a guess. A row without `completeSet` is no statement at all
 * (a single documented component does not evidence what is in the box), and the answer for such a
 * product is null, never "nothing else".
 */
export function documentedSetContents(
	dataset: FitmentDataset | null,
	saleorProductId: string,
	saleorVariantId?: string,
	now: number = Date.now(),
): readonly string[] | null {
	if (!dataset || isDatasetStale(dataset, now)) return null;
	const statements = new Map<string, readonly string[]>();
	for (const application of dataset.applications) {
		if (application.negative) continue;
		for (const ref of application.products) {
			if (ref.saleorProductId !== saleorProductId) continue;
			if (saleorVariantId !== undefined && ref.saleorVariantId !== saleorVariantId) continue;
			if (ref.qaStatus !== "accepted" || !ref.eligibility.sellable) continue;
			const includes = ref.completeSet?.includes;
			if (!includes || includes.length === 0) continue;
			const key = [...includes].sort().join("|");
			if (!statements.has(key)) statements.set(key, includes);
		}
	}
	return statements.size === 1 ? [...statements.values()][0]! : null;
}
