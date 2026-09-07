/**
 * Runtime validation of a fitment dataset.
 *
 * The provider is external and versioned independently, so its payload is untrusted
 * input in the ordinary sense: it is validated at the boundary and rejected as a whole
 * if it does not hold up. A dataset that fails here produces PROVIDER_UNAVAILABLE —
 * the storefront answers "we could not check", never a fabricated fit.
 *
 * Two checks here are not shape checks and are the reason this file exists:
 *
 *   - `schemaVersion` must match the major version this build understands. A newer
 *     minor version is accepted; a different major is refused.
 *   - `saleorInstance` must match the instance this build talks to. Saleor product and
 *     variant ids are instance-bound, so a dataset generated against staging would
 *     resolve to real ids here and point at entirely different products. Silently
 *     wrong, and invisible in every UI. Refused.
 */

import {
	BODY_TYPES,
	EVIDENCE_KINDS,
	PRODUCT_KINDS,
	QA_STATUSES,
	ROOF_TYPES,
	SUPPORTED_SCHEMA_VERSIONS,
	VERIFICATION_LEVELS,
	WINDOW_PRECISIONS,
	type FitmentDataset,
	type FitmentWindow,
} from "./contract";
import { datasetHashFromText, datasetHashFromValue } from "./dataset-hash";

/**
 * An application window, and the four ways it can contradict itself.
 *
 * The contradictions matter more than the shapes. A window that says
 * `startPrecision: "month"` with no month is a window whose exporter lost the value and
 * did not notice; one that says `"year"` WITH a month is a window whose precision claim
 * cannot be trusted, and trusting it either way would decide somebody's purchase on a
 * boundary. Both are rejected rather than reconciled here.
 */
function validateWindow(raw: unknown, path: string, errors: string[]): void {
	if (!isRecord(raw)) {
		errors.push(`${path}: window is required`);
		return;
	}

	const boundary = (value: unknown, side: string): { year: number; month?: number } | null => {
		if (!isRecord(value) || typeof value.year !== "number" || !Number.isInteger(value.year)) {
			errors.push(`${path}.${side}: year must be an integer`);
			return null;
		}
		if (value.month !== undefined) {
			if (!Number.isInteger(value.month) || (value.month as number) < 1 || (value.month as number) > 12) {
				errors.push(`${path}.${side}.month: must be an integer 1-12, or absent for unknown`);
				return null;
			}
		}
		return { year: value.year, month: value.month as number | undefined };
	};

	for (const key of ["startPrecision", "endPrecision"] as const) {
		if (!WINDOW_PRECISIONS.includes(raw[key] as never)) {
			errors.push(`${path}.${key}: must be one of ${WINDOW_PRECISIONS.join(", ")}`);
		}
	}
	if (typeof raw.reconciledToGeneration !== "boolean") {
		errors.push(`${path}.reconciledToGeneration: must be a boolean`);
	}

	const from = boundary(raw.from, "from");
	if (raw.to !== null && !isRecord(raw.to)) {
		errors.push(`${path}.to: must be an object or null`);
		return;
	}
	const to = raw.to === null ? null : boundary(raw.to, "to");

	// An open end and a stated end are two different facts and must agree.
	if (raw.to === null && raw.endPrecision !== "open") {
		errors.push(`${path}: to is null but endPrecision is "${String(raw.endPrecision)}" — expected "open"`);
	}
	if (raw.to !== null && raw.endPrecision === "open") {
		errors.push(`${path}: endPrecision is "open" but to is present`);
	}

	// Precision must describe the value that is actually there.
	if (from) {
		if (raw.startPrecision === "month" && from.month === undefined) {
			errors.push(`${path}: startPrecision is "month" but from.month is absent`);
		}
		if (raw.startPrecision === "year" && from.month !== undefined) {
			errors.push(`${path}: startPrecision is "year" but from.month is present`);
		}
	}
	if (to) {
		if (raw.endPrecision === "month" && to.month === undefined) {
			errors.push(`${path}: endPrecision is "month" but to.month is absent`);
		}
		if (raw.endPrecision === "year" && to.month !== undefined) {
			errors.push(`${path}: endPrecision is "year" but to.month is present`);
		}
	}

	if (from && to) {
		const a = from.year * 12 + (from.month ?? 1);
		const b = to.year * 12 + (to.month ?? 12);
		if (b < a) errors.push(`${path}: window ends before it starts`);
	}
}

/**
 * The per-product evidence block.
 *
 * `eligibility.sellable` is the source's own decision and the storefront does not
 * second-guess it — but its ABSENCE is never read as permission, which is why the field
 * is required rather than defaulted to true.
 */
function validateProductEvidence(product: Record<string, unknown>, path: string, errors: string[]): void {
	const evidence = product.evidence;
	if (!isRecord(evidence)) {
		errors.push(`${path}.evidence: is required`);
	} else {
		if (!EVIDENCE_KINDS.includes(evidence.kind as never)) {
			errors.push(`${path}.evidence.kind: must be one of ${EVIDENCE_KINDS.join(", ")}`);
		}
		if (
			evidence.confidence !== undefined &&
			(typeof evidence.confidence !== "number" || evidence.confidence < 0 || evidence.confidence > 1)
		) {
			errors.push(`${path}.evidence.confidence: must be a number between 0 and 1`);
		}
	}

	if (!QA_STATUSES.includes(product.qaStatus as never)) {
		errors.push(`${path}.qaStatus: must be one of ${QA_STATUSES.join(", ")}`);
	}
	if (!VERIFICATION_LEVELS.includes(product.verification as never)) {
		errors.push(`${path}.verification: must be one of ${VERIFICATION_LEVELS.join(", ")}`);
	}

	const eligibility = product.eligibility;
	if (!isRecord(eligibility)) {
		errors.push(`${path}.eligibility: is required — an absent decision is not permission`);
		return;
	}
	if (typeof eligibility.sellable !== "boolean") {
		errors.push(`${path}.eligibility.sellable: must be a boolean`);
	}
	if (!Array.isArray(eligibility.reasons) || eligibility.reasons.some((r) => typeof r !== "string")) {
		errors.push(`${path}.eligibility.reasons: must be an array of strings`);
	}
	// A refusal without a reason cannot be diagnosed, and a permission with one reads as
	// a refusal somebody forgot to act on.
	if (
		eligibility.sellable === false &&
		Array.isArray(eligibility.reasons) &&
		eligibility.reasons.length === 0
	) {
		errors.push(`${path}.eligibility: sellable is false but no reason is given`);
	}
}

export type ValidationResult =
	| { ok: true; dataset: FitmentDataset; warnings: string[] }
	| { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

/** An empty array on a qualifier is a data error: it reads as "no value fits". */
function validateQualifiers(raw: unknown, path: string, errors: string[]): void {
	if (raw === undefined) return;
	if (!isRecord(raw)) {
		errors.push(`${path}: qualifiers must be an object`);
		return;
	}
	const checks: [string, readonly string[] | "number"][] = [
		["roofTypes", ROOF_TYPES],
		["bodyTypes", BODY_TYPES],
		["doors", "number"],
	];
	for (const [key, allowed] of checks) {
		const value = raw[key];
		if (value === undefined) continue;
		if (!Array.isArray(value)) {
			errors.push(`${path}.${key}: must be an array`);
			continue;
		}
		if (value.length === 0) {
			errors.push(`${path}.${key}: empty array is ambiguous — omit the key instead`);
			continue;
		}
		for (const entry of value) {
			if (allowed === "number") {
				if (typeof entry !== "number" || !Number.isInteger(entry)) {
					errors.push(`${path}.${key}: "${String(entry)}" is not an integer`);
				}
			} else if (!allowed.includes(entry as string)) {
				errors.push(`${path}.${key}: "${String(entry)}" is not a known value`);
			}
		}
	}
}

export type ValidateOptions = {
	/** The Saleor instance this build talks to. Mismatch is fatal — see file header. */
	expectedSaleorInstance?: string;
	/**
	 * The exact text the dataset arrived as, when it arrived as text.
	 *
	 * Supplying it is what makes the recomputed `datasetHash` byte-accurate against CFM's
	 * Python: numbers are re-emitted from their original source token, so a
	 * `confidence: 1.0` stays `1.0` instead of becoming `1`. Without it the hash is taken
	 * over the parsed value, which is correct only for a document that has no
	 * whole-valued float in it.
	 */
	rawText?: string;
	/**
	 * Permit the committed demo fixture's explicit non-hash sentinel.
	 *
	 * Deliberately keyed on HOW the dataset got here, not on what it calls itself. A
	 * payload that arrives over HTTP is untrusted no matter which `source.system` it
	 * declares, so it never gets this — otherwise the escape hatch would be openable by
	 * the very input it is meant to check.
	 */
	allowUnhashedFixture?: boolean;
};

/** The one value that may stand in place of a real hash, and only for a local import. */
const UNHASHED_FIXTURE_SENTINEL = "demo-no-hash-this-is-not-a-cfm-export";

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function validateFitmentDataset(raw: unknown, options: ValidateOptions = {}): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!isRecord(raw)) return { ok: false, errors: ["dataset is not an object"] };

	// Exact match, not "any compatible major". Accepting `2.1` because it looked close
	// enough is precisely how a dataset carrying month boundaries would have been read as
	// a dataset without them: every unknown field ignored, every decision still made from
	// years, and nothing anywhere reporting a problem.
	if (!isNonEmptyString(raw.schemaVersion)) {
		errors.push("schemaVersion is missing");
	} else if (!SUPPORTED_SCHEMA_VERSIONS.includes(raw.schemaVersion)) {
		errors.push(
			`schemaVersion "${raw.schemaVersion}" is not supported by this build ` +
				`(supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")})`,
		);
	}

	for (const key of ["datasetVersion", "datasetHash", "generatedAt", "saleorInstance"]) {
		if (!isNonEmptyString(raw[key])) errors.push(`${key} is missing`);
	}

	if (isNonEmptyString(raw.generatedAt) && !Number.isFinite(Date.parse(raw.generatedAt))) {
		errors.push("generatedAt is not a parsable date");
	}

	// The hash is RECOMPUTED, not merely present.
	//
	// Checking `datasetHash` for non-emptiness was not a check at all: a payload carrying
	// an invented hash, or the hash of an entirely different document, passed exactly like
	// a correct one — and that is not hypothetical, the committed two-application excerpt
	// was carrying the hash of the full 77-product pilot. A mismatch rejects the whole
	// dataset rather than warning: half a dataset is not a smaller dataset, and a document
	// that is not the one CFM counted cannot have its accounting trusted either.
	if (isNonEmptyString(raw.datasetHash)) {
		if (raw.datasetHash === UNHASHED_FIXTURE_SENTINEL) {
			if (!options.allowUnhashedFixture) {
				errors.push(
					`datasetHash "${UNHASHED_FIXTURE_SENTINEL}" is accepted only for the committed fixture, ` +
						"never for a delivered dataset",
				);
			}
		} else if (!SHA256_HEX.test(raw.datasetHash)) {
			errors.push("datasetHash must be 64 lower-case hex characters (SHA-256)");
		} else {
			try {
				const computed = options.rawText ? datasetHashFromText(options.rawText) : datasetHashFromValue(raw);
				if (computed !== raw.datasetHash) {
					errors.push(
						`datasetHash mismatch: declared ${raw.datasetHash}, recomputed ${computed} ` +
							"(canonical JSON, sorted keys, compact separators, datasetHash and generatedAt removed)",
					);
				}
			} catch (error) {
				errors.push(`datasetHash could not be recomputed: ${String(error)}`);
			}
		}
	}

	// A demo dataset deliberately names an instance that does not exist, because its ids
	// are synthetic and are never looked up against Saleor. Applying the instance check
	// to it would reject it — which is exactly what happened: the demo silently switched
	// itself off while the build and the whole test suite stayed green.
	const isDemoPayload = Array.isArray(raw.demoCatalogue);
	if (
		!isDemoPayload &&
		options.expectedSaleorInstance &&
		isNonEmptyString(raw.saleorInstance) &&
		raw.saleorInstance !== options.expectedSaleorInstance
	) {
		errors.push(
			`saleorInstance "${raw.saleorInstance}" does not match this build's "${options.expectedSaleorInstance}" — ` +
				"product ids are instance-bound and would point at the wrong products",
		);
	}

	if (!isRecord(raw.validity)) {
		errors.push("validity is missing");
	} else {
		const { validUntil, staleAfterDays } = raw.validity;
		if (validUntil !== null && !isNonEmptyString(validUntil))
			errors.push("validity.validUntil must be a string or null");
		if (typeof staleAfterDays !== "number" || staleAfterDays <= 0) {
			errors.push("validity.staleAfterDays must be a positive number");
		}
	}

	if (!isRecord(raw.coverage) || !Array.isArray(raw.coverage.completeForMakeIds)) {
		errors.push("coverage.completeForMakeIds is missing");
	} else if (!isRecord(raw.coverage.scope) || !isNonEmptyString(raw.coverage.scope.programId)) {
		// Without a scope, "complete for Skoda" would license the sentence "nothing fits
		// your Skoda" — which also denies every roof box, every carrier and every other
		// brand in the shop.
		errors.push("coverage.scope.programId is required — a coverage claim needs a scope");
	}

	const makes = Array.isArray(raw.makes) ? raw.makes : null;
	const models = Array.isArray(raw.models) ? raw.models : null;
	const generations = Array.isArray(raw.generations) ? raw.generations : null;
	const applications = Array.isArray(raw.applications) ? raw.applications : null;

	if (!makes) errors.push("makes must be an array");
	if (!models) errors.push("models must be an array");
	if (!generations) errors.push("generations must be an array");
	if (!applications) errors.push("applications must be an array");

	if (errors.length > 0) return { ok: false, errors };

	const makeIds = new Set<string>();
	for (const [i, make] of makes!.entries()) {
		if (!isRecord(make) || !isNonEmptyString(make.id) || !isNonEmptyString(make.name)) {
			errors.push(`makes[${i}]: id and name are required`);
			continue;
		}
		if (makeIds.has(make.id)) errors.push(`makes[${i}]: duplicate id "${make.id}"`);
		makeIds.add(make.id);
	}

	const modelIds = new Set<string>();
	for (const [i, model] of models!.entries()) {
		if (!isRecord(model) || !isNonEmptyString(model.id) || !isNonEmptyString(model.makeId)) {
			errors.push(`models[${i}]: id and makeId are required`);
			continue;
		}
		if (!makeIds.has(model.makeId)) errors.push(`models[${i}]: unknown makeId "${model.makeId}"`);
		if (modelIds.has(model.id)) errors.push(`models[${i}]: duplicate id "${model.id}"`);
		modelIds.add(model.id);
	}

	const generationIds = new Set<string>();
	for (const [i, generation] of generations!.entries()) {
		if (!isRecord(generation) || !isNonEmptyString(generation.id) || !isNonEmptyString(generation.modelId)) {
			errors.push(`generations[${i}]: id and modelId are required`);
			continue;
		}
		if (!modelIds.has(generation.modelId)) {
			errors.push(`generations[${i}]: unknown modelId "${generation.modelId}"`);
		}
		if (generationIds.has(generation.id)) errors.push(`generations[${i}]: duplicate id "${generation.id}"`);
		generationIds.add(generation.id);
		if (typeof generation.productionYearFrom !== "number") {
			errors.push(`generations[${i}]: productionYearFrom must be a number`);
		}
		if (generation.productionYearTo !== null && typeof generation.productionYearTo !== "number") {
			errors.push(`generations[${i}]: productionYearTo must be a number or null`);
		}
		validateQualifiers(generation.qualifiers, `generations[${i}].qualifiers`, errors);
	}

	const applicationIds = new Set<string>();
	for (const [i, application] of applications!.entries()) {
		const path = `applications[${i}]`;
		if (!isRecord(application) || !isNonEmptyString(application.applicationId)) {
			errors.push(`${path}: applicationId is required`);
			continue;
		}
		if (applicationIds.has(application.applicationId)) {
			errors.push(`${path}: duplicate applicationId "${application.applicationId}"`);
		}
		applicationIds.add(application.applicationId);

		if (!isNonEmptyString(application.generationId) || !generationIds.has(application.generationId)) {
			errors.push(`${path}: unknown generationId "${String(application.generationId)}"`);
		}
		validateWindow(application.window, `${path}.window`, errors);
		validateQualifiers(application.qualifiers, `${path}.qualifiers`, errors);

		if (!Array.isArray(application.conditions)) {
			errors.push(`${path}: conditions must be an array`);
		} else {
			for (const [j, condition] of application.conditions.entries()) {
				if (!isRecord(condition) || !isNonEmptyString(condition.code)) {
					errors.push(`${path}.conditions[${j}]: code is required`);
				}
			}
		}

		if (!Array.isArray(application.products)) {
			errors.push(`${path}: products must be an array`);
			continue;
		}
		for (const [j, product] of application.products.entries()) {
			const productPath = `${path}.products[${j}]`;
			if (!isRecord(product)) {
				errors.push(`${productPath}: not an object`);
				continue;
			}
			if (!isNonEmptyString(product.externalReference)) {
				errors.push(`${productPath}: externalReference is required`);
			}
			// The join that actually works in bulk. Without these two the configurator
			// would have to query Saleor one product at a time.
			if (!isNonEmptyString(product.saleorProductId)) {
				errors.push(`${productPath}: saleorProductId is required (no bulk externalReference filter exists)`);
			}
			if (!isNonEmptyString(product.saleorVariantId)) {
				errors.push(`${productPath}: saleorVariantId is required — the variant is never inferred`);
			}
			// Unclassified products are refused rather than guessed at. Guessing is how a
			// roof box came to be offered as a roof rack.
			if (!PRODUCT_KINDS.includes(product.productKind as never)) {
				errors.push(`${productPath}: productKind is required and must be one of ${PRODUCT_KINDS.join(", ")}`);
			}
			validateProductEvidence(product, productPath, errors);
			{
			}
			if (product.completeSet !== undefined) {
				const set = product.completeSet;
				if (!isRecord(set) || !Array.isArray(set.includes) || set.includes.length === 0) {
					errors.push(`${productPath}.completeSet.includes must be a non-empty array when present`);
				}
			}
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	// A demo dataset must be self-contained: every product it references has to exist in
	// its own catalogue, so it can never fall through to a live product lookup.
	if (raw.demoCatalogue !== undefined) {
		if (!Array.isArray(raw.demoCatalogue)) {
			errors.push("demoCatalogue must be an array when present");
		} else {
			const known = new Set(
				raw.demoCatalogue
					.filter((e): e is Record<string, unknown> => isRecord(e))
					.map((e) => String(e.saleorProductId)),
			);
			for (const application of applications!) {
				for (const product of (application as { products: Record<string, unknown>[] }).products) {
					if (!known.has(String(product.saleorProductId))) {
						warnings.push(
							`demo dataset references ${String(
								product.saleorProductId,
							)}, which is not in demoCatalogue — it will render as having no public offer`,
						);
					}
				}
			}
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	// Generation production years must not widen an application window: a set verified
	// for 2017-2021 does not become verified for 2015 because the car was built then.
	const generationById = new Map(
		generations!.map((g) => [(g as { id: string }).id, g as Record<string, unknown>]),
	);
	//
	// This read `app.yearFrom` and `app.yearTo` until now — the schema-2 pair that 3.0.0
	// replaced with `window`. Both were `undefined`, `as number` made that `NaN`, and
	// every comparison against `NaN` is false, so the warning could not fire for any
	// dataset at all. It is the window's own year fields that carry the answer.
	for (const application of applications!) {
		const app = application as unknown as {
			applicationId: string;
			generationId: string;
			window: FitmentWindow;
		};
		const generation = generationById.get(app.generationId);
		if (!generation) continue;
		const productionFrom = generation.productionYearFrom as number;
		const productionTo = generation.productionYearTo as number | null;
		const windowFrom = app.window?.from?.year;
		const windowTo = app.window?.to?.year ?? null;
		if (typeof windowFrom === "number" && windowFrom < productionFrom) {
			warnings.push(
				`applications[${app.applicationId}]: window.from.year ${windowFrom} ` +
					`precedes generation production start ${productionFrom}`,
			);
		}
		if (productionTo !== null && typeof windowTo === "number" && windowTo > productionTo) {
			warnings.push(
				`applications[${app.applicationId}]: window.to.year ${windowTo} ` +
					`exceeds generation production end ${productionTo}`,
			);
		}
	}

	return { ok: true, dataset: raw as unknown as FitmentDataset, warnings };
}
