import { isFitmentRefSellable, type FitmentDataset, type FitmentProductRef } from "./contract";

/** What CFM's export says about a set itself, as opposed to the cars it fits. */
export type SetFacts = {
	facets: Readonly<Record<string, string | number | boolean>> | null;
	includes: readonly string[] | null;
};

const SELLABLE = new WeakMap<FitmentDataset, ReadonlyMap<string, readonly FitmentProductRef[]>>();

/**
 * Every row the source stands behind, by product: positive applications only, and only the products
 * in them that are accepted AND sellable (`isFitmentRefSellable`, the predicate every offer passes).
 *
 * The one place a card and a product page ask "which rows may speak for this set". A negative row says
 * the set does not fit; a held or disputed row is a row the source will not stand behind; neither
 * describes what is in the box or what the bars carry.
 *
 * Keyed by the dataset object like `productFitIndex`, so a refreshed dataset gets a fresh index.
 */
export function sellableRefsByProduct(
	dataset: FitmentDataset,
): ReadonlyMap<string, readonly FitmentProductRef[]> {
	let index = SELLABLE.get(dataset);
	if (!index) {
		const built = new Map<string, FitmentProductRef[]>();
		for (const application of dataset.applications) {
			if (application.negative) continue;
			for (const ref of application.products) {
				if (!isFitmentRefSellable(ref)) continue;
				const list = built.get(ref.saleorProductId);
				if (list) list.push(ref);
				else built.set(ref.saleorProductId, [ref]);
			}
		}
		index = built;
		SELLABLE.set(dataset, index);
	}
	return index;
}

/** The rows that may speak for one product — and, when given, for one variant of it. */
export function sellableRefsOf(
	dataset: FitmentDataset,
	saleorProductId: string,
	saleorVariantId?: string,
): readonly FitmentProductRef[] {
	const refs = sellableRefsByProduct(dataset).get(saleorProductId) ?? [];
	return saleorVariantId === undefined ? refs : refs.filter((ref) => ref.saleorVariantId === saleorVariantId);
}

/**
 * What the rows document the set to contain: the one statement they make, or null.
 *
 * A row without `completeSet` is no statement at all (a single documented component does not
 * evidence what is in the box), and the answer for a product no row speaks for is null, never "nothing
 * else". A product reachable through several rows is documented once per row, and those documents
 * can disagree; then nothing is said, because picking one of two statements about what is in the box
 * would be a guess. One statement made twice, in any order, is one statement.
 */
export function agreedIncludes(refs: readonly FitmentProductRef[]): readonly string[] | null {
	const statements = new Map<string, readonly string[]>();
	for (const ref of refs) {
		const includes = ref.completeSet?.includes;
		if (!includes || includes.length === 0) continue;
		const key = [...includes].sort().join("|");
		if (!statements.has(key)) statements.set(key, includes);
	}
	return statements.size === 1 ? [...statements.values()][0]! : null;
}

/**
 * The facets the rows agree on, fact by fact.
 *
 * A row that does not carry a facet is silent about it, not in disagreement. Two rows that carry
 * different values for the same facet disagree, and that facet is left out: a load rating in
 * particular is a safety number, and "which of the two" is not for a card to choose. The facets the
 * rows do agree on are still said — a conflict about the colour costs the colour, not the material.
 */
export function agreedFacets(
	refs: readonly FitmentProductRef[],
): Readonly<Record<string, string | number | boolean>> | null {
	const agreed = new Map<string, string | number | boolean>();
	const disputed = new Set<string>();
	for (const ref of refs) {
		for (const [key, value] of Object.entries(ref.facets ?? {})) {
			if (disputed.has(key)) continue;
			if (!agreed.has(key)) agreed.set(key, value);
			else if (agreed.get(key) !== value) {
				agreed.delete(key);
				disputed.add(key);
			}
		}
	}
	return agreed.size > 0 ? Object.fromEntries(agreed) : null;
}

const INDEX = new WeakMap<FitmentDataset, ReadonlyMap<string, SetFacts>>();

/**
 * Product id → the set's own facts (bar shape, material, length, load, contents), for one dataset.
 *
 * Built from the same rows the product page reads (`sellableRefsByProduct`) and with the same rule
 * for contents (`agreedIncludes`), so a card never states what the page would not. A product no
 * sellable row speaks for is simply absent: its card shows what its attributes say and nothing from
 * here.
 */
export function productSetFacts(dataset: FitmentDataset): ReadonlyMap<string, SetFacts> {
	let index = INDEX.get(dataset);
	if (!index) {
		const built = new Map<string, SetFacts>();
		for (const [productId, refs] of sellableRefsByProduct(dataset)) {
			built.set(productId, { facets: agreedFacets(refs), includes: agreedIncludes(refs) });
		}
		index = built;
		INDEX.set(dataset, index);
	}
	return index;
}
