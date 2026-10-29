import type { FitmentDataset } from "./contract";

/** What CFM's export says about a set itself, as opposed to the cars it fits. */
export type SetFacts = {
	facets: Readonly<Record<string, string | number | boolean>> | null;
	includes: readonly string[] | null;
};

const INDEX = new WeakMap<FitmentDataset, ReadonlyMap<string, SetFacts>>();

/**
 * Product id → the set's own facts (bar shape, material, length, load, contents), for one dataset.
 *
 * Keyed by the dataset object like `productFitIndex`, so a refreshed dataset gets a fresh index and
 * the old one goes with it. A product the programme has no row for is simply absent: its card shows
 * what its attributes say and nothing from here.
 */
export function productSetFacts(dataset: FitmentDataset): ReadonlyMap<string, SetFacts> {
	let index = INDEX.get(dataset);
	if (!index) {
		const built = new Map<string, SetFacts>();
		for (const application of dataset.applications) {
			if (application.negative) continue;
			for (const ref of application.products) {
				if (built.has(ref.saleorProductId)) continue;
				built.set(ref.saleorProductId, {
					facets: ref.facets ?? null,
					includes: ref.completeSet?.includes ?? null,
				});
			}
		}
		index = built;
		INDEX.set(dataset, index);
	}
	return index;
}
