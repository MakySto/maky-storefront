/**
 * Fitment resolution — pure, deterministic, no I/O.
 *
 * Every rule that decides whether a customer is told "this fits" lives here, in one
 * place, so that the PDP box, the PLP filter and the configurator cannot drift apart
 * and answer the same question differently.
 *
 * The asymmetry is deliberate and is the whole point of the module:
 *
 *   Saying YES is expensive. It needs a `verified` row covering the ENTIRE selection.
 *   Saying NO is expensive too. It needs explicit negative evidence, or a dataset that
 *   guarantees complete coverage for that make.
 *   Saying "we don't know" is cheap, and is therefore the default.
 *
 * A missing row in a partial index is UNKNOWN. A provider outage is UNKNOWN's cousin
 * PROVIDER_UNAVAILABLE. Neither is ever NO_FIT — telling a customer nothing fits their
 * car when we simply have no data is the single worst thing this feature can do.
 */

import {
	type FitmentApplication,
	type FitmentCondition,
	type FitmentDataset,
	type FitmentQualifiers,
	type FitmentResult,
	type FitmentVerdict,
	type VehicleSelection,
} from "./contract";

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyResult(verdict: FitmentVerdict, reason: string, dataset: FitmentDataset | null): FitmentResult {
	return {
		verdict,
		coverage: "partial",
		matched: [],
		conditions: [],
		dataset: dataset
			? {
					datasetVersion: dataset.datasetVersion,
					generatedAt: dataset.generatedAt,
					schemaVersion: dataset.schemaVersion,
				}
			: null,
		reason,
	};
}

/** A dataset past `validUntil`, or older than `staleAfterDays`, may not answer YES. */
export function isDatasetStale(dataset: FitmentDataset, now: number): boolean {
	if (dataset.validity.validUntil) {
		const until = Date.parse(dataset.validity.validUntil);
		if (Number.isFinite(until) && now > until) return true;
	}
	const generated = Date.parse(dataset.generatedAt);
	if (!Number.isFinite(generated)) return true;
	return now - generated > dataset.validity.staleAfterDays * DAY_MS;
}

/** Application year windows are half-open at the top only when `yearTo` is null. */
function yearMatches(application: FitmentApplication, year: number): boolean {
	if (year < application.yearFrom) return false;
	if (application.yearTo !== null && year > application.yearTo) return false;
	return true;
}

type QualifierMatch = "match" | "miss" | "undecidable";

/**
 * Compare one qualifier the application constrains against the customer's answer.
 *
 * The third outcome is the important one: if the application is specific about the roof
 * type and the customer has not told us their roof type, we have not established a fit
 * and we have not ruled one out. That is AMBIGUOUS, and the UI must ask rather than
 * guess — picking a roof type for the customer is how someone ends up with feet that
 * do not attach to their car.
 */
function matchQualifier<T>(constrained: T[] | undefined, answer: T | undefined): QualifierMatch {
	if (constrained === undefined || constrained.length === 0) return "match";
	if (answer === undefined) return "undecidable";
	return constrained.includes(answer) ? "match" : "miss";
}

function matchQualifiers(qualifiers: FitmentQualifiers, selection: VehicleSelection): QualifierMatch {
	const outcomes: QualifierMatch[] = [
		matchQualifier(qualifiers.roofTypes, selection.roofType),
		matchQualifier(qualifiers.bodyTypes, selection.bodyType),
		matchQualifier(qualifiers.doors, selection.doors),
	];
	if (outcomes.includes("miss")) return "miss";
	if (outcomes.includes("undecidable")) return "undecidable";
	return "match";
}

function dedupeConditions(applications: FitmentApplication[]): FitmentCondition[] {
	const seen = new Map<string, FitmentCondition>();
	for (const application of applications) {
		for (const condition of application.conditions) {
			if (!seen.has(condition.code)) seen.set(condition.code, condition);
		}
	}
	return [...seen.values()];
}

export type ResolveOptions = {
	/** Restrict to applications offering this product. Used by the PDP. */
	saleorProductId?: string;
	/** A product the catalogue marks as fitting every vehicle. */
	universal?: boolean;
	/** Injected for determinism in tests. */
	now?: number;
};

/**
 * Resolve one selection against one dataset.
 *
 * `dataset === null` means the provider could not be reached. That is reported as
 * PROVIDER_UNAVAILABLE and never as NO_FIT.
 */
export function resolveFitment(
	dataset: FitmentDataset | null,
	selection: VehicleSelection | null,
	options: ResolveOptions = {},
): FitmentResult {
	const now = options.now ?? Date.now();

	if (!dataset) return emptyResult("PROVIDER_UNAVAILABLE", "provider-unavailable", null);

	// A universal product is universal whether or not a car is selected. It still gets
	// its conditions rendered: "fits every car" is not "needs no crossbars".
	if (options.universal) {
		return { ...emptyResult("UNIVERSAL", "universal-product", dataset), coverage: "complete" };
	}

	if (!selection) return emptyResult("NO_VEHICLE_SELECTED", "no-vehicle-selected", dataset);

	if (isDatasetStale(dataset, now)) return emptyResult("STALE", "dataset-stale", dataset);

	const coverageComplete = dataset.coverage.completeForMakeIds.includes(selection.makeId);
	const coverage = coverageComplete ? "complete" : "partial";

	const forGeneration = dataset.applications.filter((a) => a.generationId === selection.generationId);
	const relevant = options.saleorProductId
		? forGeneration.filter((a) => a.products.some((p) => p.saleorProductId === options.saleorProductId))
		: forGeneration;

	const positives: FitmentApplication[] = [];
	const negatives: FitmentApplication[] = [];
	let undecidable = false;

	for (const application of relevant) {
		if (!yearMatches(application, selection.year)) continue;
		const qualifier = matchQualifiers(application.qualifiers, selection);
		if (qualifier === "miss") continue;
		if (qualifier === "undecidable") {
			undecidable = true;
			continue;
		}
		(application.negative ? negatives : positives).push(application);
	}

	// A source that both affirms and denies the same selection has not been resolved
	// upstream. Presenting either half would be presenting a coin flip as a fact.
	if (positives.length > 0 && negatives.length > 0) {
		return { ...emptyResult("AMBIGUOUS", "positive-and-negative-rows", dataset), coverage };
	}

	if (positives.length > 0) {
		if (positives.some((a) => a.verificationStatus === "conflict")) {
			return { ...emptyResult("AMBIGUOUS", "conflicting-row", dataset), coverage };
		}
		// `provisional` and `year-hold` are usable data but they are not a promise.
		// They must never be promoted to a green badge, no matter how many rows agree.
		const unverified = positives.filter((a) => a.verificationStatus !== "verified");
		if (unverified.length > 0) {
			return {
				verdict: "UNKNOWN",
				coverage,
				matched: positives,
				conditions: dedupeConditions(positives),
				dataset: {
					datasetVersion: dataset.datasetVersion,
					generatedAt: dataset.generatedAt,
					schemaVersion: dataset.schemaVersion,
				},
				reason: `unverified-rows:${unverified[0]!.verificationStatus}`,
			};
		}
		return {
			verdict: "VERIFIED_FIT",
			coverage,
			matched: positives,
			conditions: dedupeConditions(positives),
			dataset: {
				datasetVersion: dataset.datasetVersion,
				generatedAt: dataset.generatedAt,
				schemaVersion: dataset.schemaVersion,
			},
			reason: "verified",
		};
	}

	// An unanswered qualifier outranks an absent row: we should ask the question before
	// concluding anything, including "no".
	if (undecidable) {
		return { ...emptyResult("AMBIGUOUS", "qualifier-not-answered", dataset), coverage };
	}

	if (negatives.length > 0) {
		return {
			...emptyResult("NO_FIT", "explicit-negative-row", dataset),
			coverage,
			conditions: dedupeConditions(negatives),
		};
	}

	// The one place absence is allowed to mean "no".
	if (coverageComplete) {
		return { ...emptyResult("NO_FIT", "absent-under-complete-coverage", dataset), coverage };
	}

	return { ...emptyResult("UNKNOWN", "absent-under-partial-coverage", dataset), coverage };
}

/**
 * Every product reference that fits the selection, de-duplicated by variant and in a
 * stable order. This is the configurator's candidate list BEFORE Saleor is consulted —
 * these are compatibility candidates, not an offer. Whether any of them can actually be
 * bought in this channel is decided later, against Saleor, by the server.
 */
export function collectFittingProducts(
	dataset: FitmentDataset | null,
	selection: VehicleSelection | null,
	options: { now?: number } = {},
): { result: FitmentResult; saleorProductIds: string[]; saleorVariantIds: string[] } {
	const result = resolveFitment(dataset, selection, { now: options.now });
	if (result.verdict !== "VERIFIED_FIT" && result.verdict !== "UNKNOWN") {
		return { result, saleorProductIds: [], saleorVariantIds: [] };
	}
	const productIds: string[] = [];
	const variantIds: string[] = [];
	for (const application of result.matched) {
		for (const product of application.products) {
			if (!productIds.includes(product.saleorProductId)) productIds.push(product.saleorProductId);
			if (!variantIds.includes(product.saleorVariantId)) variantIds.push(product.saleorVariantId);
		}
	}
	return { result, saleorProductIds: productIds, saleorVariantIds: variantIds };
}

/**
 * The vehicles a given product is documented to fit — the PDP's "which cars is this
 * for?" question, which is asked with NO vehicle selected and must be answerable then.
 */
export function collectApplicationsForProduct(
	dataset: FitmentDataset | null,
	saleorProductId: string,
): FitmentApplication[] {
	if (!dataset) return [];
	return dataset.applications.filter(
		(a) => !a.negative && a.products.some((p) => p.saleorProductId === saleorProductId),
	);
}
