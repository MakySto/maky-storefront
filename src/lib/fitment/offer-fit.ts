/**
 * What a set is FOR, as the source states it — the roof and the years — read off the application
 * the set belongs to, never off its name.
 *
 * A Thule set is sold for one car, one roof and one window of model years, and the title carries
 * all three as prose written by someone else. The customer needs them as facts: which roof, which
 * years. This is where they come from, so that the listing card, the vehicle page's card and the
 * configurator's card print the SAME facts and cannot drift from each other or from what the
 * resolver decides on.
 *
 * ## Years are the APPLICATION's, not the car's
 *
 * `window` is the manufacturer's: the years this set is made for. The generation's production
 * years are a different fact (see `contract.ts`) and are not used here — a car built 2015–2021
 * may have a set for 2017–2021 only, and printing the car's span on the card would claim a fit
 * for years nobody states one for. Years only: the month decides a purchase in the resolver, and
 * on a card it is noise.
 *
 * Pure and free of `server-only`: the shape is shared by server components and tests.
 */

import type { BodyType, FitmentApplication, FitmentDataset, RoofType } from "./contract";

export type OfferFit = {
	yearFrom: number;
	/** `null` = the window is still open ("od 2024"). */
	yearTo: number | null;
	/** What the application constrains. `null` = it names no roof — nothing is said, never a guess. */
	roofTypes: readonly RoofType[] | null;
	bodyTypes: readonly BodyType[] | null;
};

export function offerFitOf(application: FitmentApplication): OfferFit {
	const roofs = application.qualifiers.roofTypes;
	const bodies = application.qualifiers.bodyTypes;
	return {
		yearFrom: application.window.from.year,
		yearTo: application.window.to?.year ?? null,
		roofTypes: roofs && roofs.length > 0 ? roofs : null,
		bodyTypes: bodies && bodies.length > 0 ? bodies : null,
	};
}

function sameFit(a: OfferFit, b: OfferFit): boolean {
	return (
		a.yearFrom === b.yearFrom &&
		a.yearTo === b.yearTo &&
		(a.roofTypes ?? []).join() === (b.roofTypes ?? []).join() &&
		(a.bodyTypes ?? []).join() === (b.bodyTypes ?? []).join()
	);
}

/**
 * Every POSITIVE application of each product, as facts, in dataset order.
 *
 * A negative row says a set does NOT fit and is not an application of it. Identical facts from
 * two rows collapse to one — the same set reached through two rows is still one statement.
 */
export function offerFitsByProduct(applications: Iterable<FitmentApplication>): Map<string, OfferFit[]> {
	const byProduct = new Map<string, OfferFit[]>();
	for (const application of applications) {
		if (application.negative) continue;
		const fit = offerFitOf(application);
		for (const ref of application.products) {
			const list = byProduct.get(ref.saleorProductId);
			if (!list) byProduct.set(ref.saleorProductId, [fit]);
			else if (!list.some((known) => sameFit(known, fit))) list.push(fit);
		}
	}
	return byProduct;
}

const INDEX = new WeakMap<FitmentDataset, ReadonlyMap<string, readonly OfferFit[]>>();

/**
 * The index for one dataset: product id → its fits.
 *
 * Keyed by the dataset OBJECT, so it is tied to the exact dataset it was built from and goes
 * with it: a refreshed dataset is a new object and gets a new index, and an old one is collected
 * with it. There is no second copy of the data and nothing to invalidate — which is the whole
 * reason it is a `WeakMap` and not a module-level `Map`. Built once per dataset in a few
 * milliseconds (18 314 product rows), then a lookup per card.
 */
export function productFitIndex(dataset: FitmentDataset): ReadonlyMap<string, readonly OfferFit[]> {
	let index = INDEX.get(dataset);
	if (!index) {
		index = offerFitsByProduct(dataset.applications);
		INDEX.set(dataset, index);
	}
	return index;
}

/** The roof order the listing groups by: how often a shopper's roof is this one, roughly. */
export const ROOF_GROUP_ORDER: readonly RoofType[] = [
	"raised-rails",
	"flush-rails",
	"naked-roof",
	"fixpoint",
	"t-track",
	"rain-gutter",
];

/** The roof a set is grouped under on a page that mixes several: its first, else none. */
export function groupRoofOf(fits: readonly OfferFit[] | undefined): RoofType | null {
	const roofs = fits?.flatMap((fit) => fit.roofTypes ?? []) ?? [];
	for (const roof of ROOF_GROUP_ORDER) if (roofs.includes(roof)) return roof;
	return null;
}

/**
 * Words for a fit, from a translator of the `fitment` namespace.
 *
 * Returns the two facts as separate strings so each surface can lay them out its own way. A set
 * with MORE THAN ONE application is described by none of them: which of two windows a card means
 * is a question the card cannot answer, and the product page lists them all. Today every set has
 * exactly one (`18 314 / 18 314` in the 2026-10-01 export), so this costs nothing — it is here so
 * that the day it changes, a card stays silent instead of picking a window.
 */
export type FitTranslator = (key: string, values?: Record<string, string | number>) => string;

export function describeOfferFit(
	fits: readonly OfferFit[] | undefined,
	t: FitTranslator,
	roofLabelKey: Record<RoofType, string>,
): { roof: string | null; years: string } | null {
	if (!fits || fits.length !== 1) return null;
	const fit = fits[0]!;
	const roof = fit.roofTypes ? fit.roofTypes.map((r) => t(roofLabelKey[r])).join(", ") : null;
	const years =
		fit.yearTo === null || fit.yearTo === undefined
			? t("yearFromOnly", { from: fit.yearFrom })
			: fit.yearTo === fit.yearFrom
				? String(fit.yearFrom)
				: t("yearRange", { from: fit.yearFrom, to: fit.yearTo });
	return { roof, years };
}
