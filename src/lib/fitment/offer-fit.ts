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

import {
	isFitmentRefSellable,
	type BodyType,
	type FitmentApplication,
	type FitmentDataset,
	type FitmentProductRef,
	type RoofType,
} from "./contract";

export type OfferFit = {
	yearFrom: number;
	/** `null` = the window is still open ("od 2024"). */
	yearTo: number | null;
	/** What the application constrains. `null` = it names no roof — nothing is said, never a guess. */
	roofTypes: readonly RoofType[] | null;
	bodyTypes: readonly BodyType[] | null;
	/**
	 * The generations of the applications these facts come from — which car the set is made for, to
	 * name it the way the rest of the shop does. Not part of the identity of a fit: applications with
	 * the same facts are still one statement (`sameFit`), and every generation behind it is listed.
	 */
	generationIds?: readonly string[];
};

export function offerFitOf(application: FitmentApplication): OfferFit {
	const roofs = application.qualifiers.roofTypes;
	const bodies = application.qualifiers.bodyTypes;
	return {
		yearFrom: application.window.from.year,
		yearTo: application.window.to?.year ?? null,
		roofTypes: roofs && roofs.length > 0 ? roofs : null,
		bodyTypes: bodies && bodies.length > 0 ? bodies : null,
		generationIds: [application.generationId],
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
 * `speaks` says which product rows may be counted at all; by default every one is.
 */
export function offerFitsByProduct(
	applications: Iterable<FitmentApplication>,
	speaks: (ref: FitmentProductRef) => boolean = () => true,
): Map<string, OfferFit[]> {
	const byProduct = new Map<string, OfferFit[]>();
	for (const application of applications) {
		if (application.negative) continue;
		const fit = offerFitOf(application);
		for (const ref of application.products) {
			if (!speaks(ref)) continue;
			// A copy for each product: the generations behind a fit are collected per product.
			const list = byProduct.get(ref.saleorProductId);
			if (!list) {
				byProduct.set(ref.saleorProductId, [{ ...fit }]);
				continue;
			}
			const known = list.find((other) => sameFit(other, fit));
			if (!known) list.push({ ...fit });
			else if (!known.generationIds?.includes(application.generationId)) {
				known.generationIds = [...(known.generationIds ?? []), application.generationId];
			}
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
 *
 * Only the rows the product page reads may speak (accepted and sellable): a product CFM holds back
 * stays in the export and out of every card, as it stays out of every offer.
 */
export function productFitIndex(dataset: FitmentDataset): ReadonlyMap<string, readonly OfferFit[]> {
	let index = INDEX.get(dataset);
	if (!index) {
		index = offerFitsByProduct(dataset.applications, isFitmentRefSellable);
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

/** Every roof a set is made for, in the listing's order: how often a shopper's roof is this one, roughly. */
export function roofsOf(fits: readonly OfferFit[] | undefined): RoofType[] {
	const roofs = fits?.flatMap((fit) => fit.roofTypes ?? []) ?? [];
	return ROOF_GROUP_ORDER.filter((roof) => roofs.includes(roof));
}

/** The roof a set is sorted under on a page that mixes several: its first, else none. */
export function groupRoofOf(fits: readonly OfferFit[] | undefined): RoofType | null {
	return roofsOf(fits)[0] ?? null;
}

/** A translator of the `fitment` namespace: the words a fit is told in. */
export type FitTranslator = (key: string, values?: Record<string, string | number>) => string;

/** The roofs a fit names, in the reader's words; null when it names none, and then nothing is said. */
function wordRoofs(fit: OfferFit, t: FitTranslator, roofLabelKey: Record<RoofType, string>): string | null {
	return fit.roofTypes ? fit.roofTypes.map((r) => t(roofLabelKey[r])).join(", ") : null;
}

/** One window in the reader's words: "2018 – 2021", "od 2024", or the single year of a one-year window. */
function wordYears(fit: OfferFit, t: FitTranslator): string {
	return fit.yearTo === null || fit.yearTo === undefined
		? t("yearFromOnly", { from: fit.yearFrom })
		: fit.yearTo === fit.yearFrom
			? String(fit.yearFrom)
			: t("yearRange", { from: fit.yearFrom, to: fit.yearTo });
}

/**
 * Words for a fit, from a translator of the `fitment` namespace.
 *
 * Returns the two facts as separate strings so each surface can lay them out its own way. A set
 * with MORE THAN ONE application is described by none of them: which of two windows a card means
 * is a question this statement cannot answer, and the product page lists them all. That is what
 * makes it the statement a surface may hang a decision on: the vehicle page adds a set to the cart
 * from its card only when the card can say this much. A listing card does not decide anything and
 * tells a set with several applications all the same, see `describeSetFit`.
 */
export function describeOfferFit(
	fits: readonly OfferFit[] | undefined,
	t: FitTranslator,
	roofLabelKey: Record<RoofType, string>,
): { roof: string | null; years: string } | null {
	if (!fits || fits.length !== 1) return null;
	const fit = fits[0]!;
	return { roof: wordRoofs(fit, t, roofLabelKey), years: wordYears(fit, t) };
}

const roofKey = (fit: OfferFit): string => (fit.roofTypes ? [...fit.roofTypes].sort().join("|") : "");
const windowEnd = (fit: OfferFit): number => fit.yearTo ?? Number.MAX_SAFE_INTEGER;
const lies = (inner: OfferFit, outer: OfferFit): boolean =>
	outer.yearFrom <= inner.yearFrom && windowEnd(outer) >= windowEnd(inner);

/**
 * What a LISTING card says about a set: the roof and the years it is made for, from its own
 * application(s).
 *
 * A set made for one car in two versions has two applications with their own windows: the Nordrive
 * Kargo basket for the Mercedes-Benz T-Class is made for the long van in 2022–2026 and for the
 * standard one from 2023. Both are told, earliest first ("2022 – 2026, od 2023"), and the product
 * page says which window belongs to which version. The windows are listed as the applications state
 * them, never merged into a span that covers a year none of them names: a gap between two of them
 * stays a gap. A window that lies inside another adds nothing to what the card says and is not
 * repeated (2012 – 2017 beside 2012 – 2018 reads "2012 – 2018"), and neither is a window that two
 * applications share, as when they differ only in the body type, which the card does not print.
 *
 * Silent (null) where the applications do not name the same roofs: a roof and a window are told
 * side by side, and with two roofs and two windows the reader could not tell which goes with which.
 * For a set with exactly one application this is `describeOfferFit`, word for word.
 */
export function describeSetFit(
	fits: readonly OfferFit[] | undefined,
	t: FitTranslator,
	roofLabelKey: Record<RoofType, string>,
): { roof: string | null; years: string } | null {
	if (!fits || fits.length === 0) return null;
	const first = fits[0]!;
	if (fits.some((fit) => roofKey(fit) !== roofKey(first))) return null;
	const windows = fits
		// Out: a window inside another one; of two equal windows, the later.
		.filter(
			(fit, at) => !fits.some((other, to) => to !== at && lies(fit, other) && (!lies(other, fit) || to < at)),
		)
		.sort((a, b) => a.yearFrom - b.yearFrom || windowEnd(a) - windowEnd(b));
	return {
		roof: wordRoofs(first, t, roofLabelKey),
		years: windows.map((fit) => wordYears(fit, t)).join(", "),
	};
}
