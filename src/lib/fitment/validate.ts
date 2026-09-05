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
	FITMENT_SCHEMA_VERSION,
	PRODUCT_KINDS,
	ROOF_TYPES,
	VERIFICATION_STATUSES,
	type FitmentDataset,
} from "./contract";

export type ValidationResult =
	| { ok: true; dataset: FitmentDataset; warnings: string[] }
	| { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function majorOf(version: string): string | null {
	const match = /^(\d+)\./.exec(version);
	return match ? match[1]! : null;
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
};

export function validateFitmentDataset(raw: unknown, options: ValidateOptions = {}): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!isRecord(raw)) return { ok: false, errors: ["dataset is not an object"] };

	if (!isNonEmptyString(raw.schemaVersion)) {
		errors.push("schemaVersion is missing");
	} else {
		const expected = majorOf(FITMENT_SCHEMA_VERSION);
		const actual = majorOf(raw.schemaVersion);
		if (actual === null) {
			errors.push(`schemaVersion "${raw.schemaVersion}" is not semver-like`);
		} else if (actual !== expected) {
			errors.push(`schemaVersion major ${actual} is not supported by this build (expects ${expected}.x)`);
		} else if (raw.schemaVersion !== FITMENT_SCHEMA_VERSION) {
			warnings.push(`schemaVersion ${raw.schemaVersion} differs from ${FITMENT_SCHEMA_VERSION}`);
		}
	}

	for (const key of ["datasetVersion", "datasetHash", "generatedAt", "saleorInstance"]) {
		if (!isNonEmptyString(raw[key])) errors.push(`${key} is missing`);
	}

	if (isNonEmptyString(raw.generatedAt) && !Number.isFinite(Date.parse(raw.generatedAt))) {
		errors.push("generatedAt is not a parsable date");
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
		if (typeof application.yearFrom !== "number") errors.push(`${path}: yearFrom must be a number`);
		if (application.yearTo !== null && typeof application.yearTo !== "number") {
			errors.push(`${path}: yearTo must be a number or null`);
		}
		if (
			typeof application.yearFrom === "number" &&
			typeof application.yearTo === "number" &&
			application.yearTo < application.yearFrom
		) {
			errors.push(`${path}: yearTo is before yearFrom`);
		}
		if (!VERIFICATION_STATUSES.includes(application.verificationStatus as never)) {
			errors.push(`${path}: unknown verificationStatus "${String(application.verificationStatus)}"`);
		}
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
	for (const application of applications!) {
		const app = application as Record<string, unknown>;
		const generation = generationById.get(app.generationId as string);
		if (!generation) continue;
		const productionFrom = generation.productionYearFrom as number;
		const productionTo = generation.productionYearTo as number | null;
		if ((app.yearFrom as number) < productionFrom) {
			warnings.push(
				`applications[${String(app.applicationId)}]: yearFrom ${String(
					app.yearFrom,
				)} precedes generation production start ${productionFrom}`,
			);
		}
		if (productionTo !== null && app.yearTo !== null && (app.yearTo as number) > productionTo) {
			warnings.push(
				`applications[${String(app.applicationId)}]: yearTo ${String(
					app.yearTo,
				)} exceeds generation production end ${productionTo}`,
			);
		}
	}

	return { ok: true, dataset: raw as unknown as FitmentDataset, warnings };
}
