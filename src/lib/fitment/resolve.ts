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
	CONFIGURATOR_PRODUCT_KIND,
	isFitmentOfferable,
	matchWindow,
	type QaStatus,
	type WindowMatch,
	type FitmentApplication,
	type FitmentCondition,
	type FitmentCoverageLevel,
	type FitmentDataset,
	type FitmentProductRef,
	type FitmentQualifiers,
	type FitmentResult,
	type FitmentVerdict,
	isInconclusiveVerdict,
	type ProductKind,
	type VehicleSelection,
} from "./contract";

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyResult(verdict: FitmentVerdict, reason: string, dataset: FitmentDataset | null): FitmentResult {
	return {
		verdict,
		coverage: "partial",
		// No product judged, so no evidence to carry. Every caller must treat a null
		// here as "not offerable" rather than as "no objection".
		product: null,
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

/**
 * Does the customer's vehicle fall inside this application's window?
 *
 * Delegates to `matchWindow`, which is where the inclusive boundaries and the
 * three-valued answer live. The third value is the reason this is not a boolean any
 * more: on a boundary year of a month-precise window, the year alone does not decide,
 * and the honest move is to ask for the month rather than round it either way.
 */
function windowMatches(application: FitmentApplication, selection: VehicleSelection): WindowMatch {
	return matchWindow(application.window, selection.year, selection.manufactureMonth);
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
	/** A window that only the manufacture month can settle. */
	let needsMonth = false;

	for (const application of relevant) {
		const window = windowMatches(application, selection);
		if (window === "out") continue;
		if (window === "needs-detail") {
			needsMonth = true;
			continue;
		}
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
		const conditions = dedupeConditions(positives);
		const provenance = {
			datasetVersion: dataset.datasetVersion,
			generatedAt: dataset.generatedAt,
			schemaVersion: dataset.schemaVersion,
		};

		// Without a named product there is no evidence block to judge, and a
		// vehicle-level "something fits" claim is not one this feature makes. The
		// per-product callers below are where an offer can come from.
		if (!options.saleorProductId) {
			return {
				verdict: "UNKNOWN",
				coverage,
				product: null,
				matched: positives,
				conditions,
				dataset: provenance,
				reason: "no-product-named",
			};
		}

		const refs = positives
			.map((a) => a.products.find((p) => p.saleorProductId === options.saleorProductId))
			.filter((r): r is NonNullable<typeof r> => Boolean(r));

		// Evidence lives on the PRODUCT, so a row disputed for this product is disputed
		// here even when the application around it is clean and carries other products
		// that are not.
		const worst = pickWorstRef(refs);
		if (!worst) {
			return { ...emptyResult("UNKNOWN", "product-ref-missing", dataset), coverage };
		}
		const product = {
			evidence: worst.evidence,
			qaStatus: worst.qaStatus,
			verification: worst.verification,
			eligibility: worst.eligibility,
		};
		const result = (verdict: FitmentVerdict, reason: string): FitmentResult => ({
			verdict,
			coverage,
			product,
			matched: positives,
			conditions,
			dataset: provenance,
			reason,
		});

		if (worst.qaStatus === "conflict") return result("AMBIGUOUS", "qa-conflict");
		// `hold`, `unreviewed` and `rejected` are all "we cannot stand behind this",
		// which is not the same as "it does not fit" — the shopper is told we cannot
		// confirm it, never that their car is wrong.
		if (worst.qaStatus !== "accepted") return result("UNKNOWN", `qa-${worst.qaStatus}`);
		if (worst.verification === "cfm-verified") return result("VERIFIED_FIT", "cfm-verified");
		// The manufacturer's own application list, and nothing more. Offerable, and it
		// must say exactly that. A `derived` row is NOT the manufacturer's word and does
		// not get to borrow the phrase.
		if (worst.evidence.kind === "manufacturer-application") {
			return result("MANUFACTURER_FIT", "manufacturer-declared");
		}
		return result("UNKNOWN", `unverified-evidence:${worst.evidence.kind}`);
	}

	// An unanswered qualifier outranks an absent row: we should ask the question before
	// concluding anything, including "no".
	if (undecidable) {
		return { ...emptyResult("AMBIGUOUS", "qualifier-not-answered", dataset), coverage };
	}

	// A window we could have matched if the shopper had told us their month. Asked for
	// before absence is interpreted, and never rounded into a yes or a no.
	if (needsMonth) {
		return { ...emptyResult("NEEDS_DETAIL", "manufacture-month-required", dataset), coverage };
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
 * The least favourable of a product's rows across the matching applications.
 *
 * One product can be reachable through several application rows for the same vehicle,
 * and they need not agree. Taking the best of them would let a clean row launder a
 * disputed one — exactly the laundering that moving evidence onto the product was
 * meant to stop, reintroduced one level up.
 */
const QA_ORDER: Record<QaStatus, number> = {
	conflict: 0,
	rejected: 1,
	hold: 2,
	unreviewed: 3,
	accepted: 4,
};

function pickWorstRef(refs: FitmentProductRef[]): FitmentProductRef | null {
	let worst: FitmentProductRef | null = null;
	for (const ref of refs) {
		if (!worst) {
			worst = ref;
			continue;
		}
		if (QA_ORDER[ref.qaStatus] < QA_ORDER[worst.qaStatus]) worst = ref;
		else if (QA_ORDER[ref.qaStatus] === QA_ORDER[worst.qaStatus] && !ref.eligibility.sellable) worst = ref;
	}
	return worst;
}

/**
 * Every product the dataset has any application row for, restricted to one kind.
 *
 * This is the candidate set, not an answer. Kind-filtering happens HERE rather than
 * after resolution so that a roof box can never reach the offer list even if a row
 * mistakenly points at one.
 */
export function candidateProductRefs(
	dataset: FitmentDataset | null,
	selection: VehicleSelection | null,
	kind: ProductKind = CONFIGURATOR_PRODUCT_KIND,
): FitmentProductRef[] {
	if (!dataset || !selection) return [];
	const seen = new Set<string>();
	const refs: FitmentProductRef[] = [];
	for (const application of dataset.applications) {
		if (application.generationId !== selection.generationId) continue;
		for (const ref of application.products) {
			if (ref.productKind !== kind) continue;
			if (seen.has(ref.saleorProductId)) continue;
			seen.add(ref.saleorProductId);
			refs.push(ref);
		}
	}
	return refs;
}

export type ProductOutcome = {
	ref: FitmentProductRef;
	result: FitmentResult;
};

/**
 * Resolve EVERY candidate independently, then report them together.
 *
 * The independence is the point, and it is what the first version got wrong. Resolving
 * the whole vehicle in one pass merged rows belonging to different products, so one set
 * with a disputed year, or one explicitly-negative row for a DIFFERENT set, collapsed
 * the entire vehicle to AMBIGUOUS and offered nothing. "Set A fits, set B does not" has
 * an obvious right answer — offer A — and it is only reachable by asking about A and B
 * separately.
 */
export function resolveCandidates(
	dataset: FitmentDataset | null,
	selection: VehicleSelection | null,
	options: { kind?: ProductKind; now?: number } = {},
): ProductOutcome[] {
	const refs = candidateProductRefs(dataset, selection, options.kind ?? CONFIGURATOR_PRODUCT_KIND);
	return refs.map((ref) => ({
		ref,
		result: resolveFitment(dataset, selection, {
			saleorProductId: ref.saleorProductId,
			now: options.now,
		}),
	}));
}

export type VehicleOutcome = {
	/** Only these may be offered. Never UNKNOWN, STALE, AMBIGUOUS or a provider outage. */
	verified: ProductOutcome[];
	/** Resolved but not offerable — kept so the UI can explain rather than stay silent. */
	unconfirmed: ProductOutcome[];
	/** Positively ruled out for this exact selection. */
	rejected: ProductOutcome[];
	/** True when the dataset could not answer at all (outage, stale, no vehicle). */
	unanswerable: boolean;
	/** The reason, when unanswerable. */
	unanswerableVerdict: FitmentVerdict | null;
	/** Whether the dataset claims complete coverage of its scope for this make. */
	coverage: FitmentCoverageLevel;
};

/**
 * The page-level answer: what do we know about THIS VEHICLE, across all candidate sets.
 *
 * Deliberately not a single verdict. A page that says "verified" before any set is
 * chosen is claiming something it has not established, and a page that says "this
 * product does not fit" over an empty list is answering a question nobody asked.
 */
export function resolveVehicleOutcome(
	dataset: FitmentDataset | null,
	selection: VehicleSelection | null,
	options: { kind?: ProductKind; now?: number } = {},
): VehicleOutcome {
	const base = resolveFitment(dataset, selection, { now: options.now });
	const empty: VehicleOutcome = {
		verified: [],
		unconfirmed: [],
		rejected: [],
		unanswerable: true,
		unanswerableVerdict: base.verdict,
		coverage: base.coverage,
	};

	// A missing dataset, a missing vehicle or a stale dataset are conditions of the
	// whole lookup, not properties of any one set.
	if (
		base.verdict === "PROVIDER_UNAVAILABLE" ||
		base.verdict === "NO_VEHICLE_SELECTED" ||
		base.verdict === "STALE"
	) {
		return empty;
	}

	const outcomes = resolveCandidates(dataset, selection, options);
	return {
		// One gate, shared with the cart, the PDP and the listing filter. A set reaches
		// this list only if the verdict is a fit AND the source will stand behind selling
		// this product for it — a `hold` inside an otherwise clean application stops here.
		verified: outcomes.filter((o) =>
			isFitmentOfferable({ verdict: o.result.verdict, eligibility: o.result.product?.eligibility }),
		),
		// Resolved but not offerable: the inconclusive verdicts, plus anything that reads
		// as a fit yet is not sellable. The second half used to be impossible; now a
		// disputed product can match perfectly and still be refused, and the shopper is
		// owed an explanation rather than silence.
		unconfirmed: outcomes.filter(
			(o) =>
				isInconclusiveVerdict(o.result.verdict) ||
				(o.result.verdict !== "NO_FIT" &&
					!isFitmentOfferable({ verdict: o.result.verdict, eligibility: o.result.product?.eligibility })),
		),
		rejected: outcomes.filter((o) => o.result.verdict === "NO_FIT"),
		unanswerable: false,
		unanswerableVerdict: null,
		coverage: base.coverage,
	};
}

/**
 * Does this dataset speak for this product AT ALL?
 *
 * The gate every surface must pass before it shows a compatibility answer, and it is
 * about the DATASET, never about the product's name, slug, category or Saleor product
 * type. A snow chain, a roof box or a work boot has no row here, and the honest thing to
 * say about it is nothing — the feature stays silent rather than answering a question it
 * was never given data for.
 *
 * Without this gate `coverage.completeForMakeIds` becomes actively dangerous: inside a
 * complete make, `resolveFitment` is entitled to turn an absent row into NO_FIT, which
 * is correct for a roof-rack set in the programme and a flat lie about every product
 * outside it. `FitmentScope` says so in as many words — "complete for Škoda" inside a
 * Nordrive roof-rack programme does not license the sentence "nothing fits your Škoda".
 *
 * Negative rows count. A product the source explicitly rules out for some vehicle is
 * still a product the source knows about, and hiding the box would drop the one warning
 * that matters most.
 */
export function datasetSpeaksForProduct(dataset: FitmentDataset | null, saleorProductId: string): boolean {
	if (!dataset) return false;
	return dataset.applications.some((a) => a.products.some((p) => p.saleorProductId === saleorProductId));
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
