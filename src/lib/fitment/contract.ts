/**
 * Vehicle fitment read contract — v1.
 *
 * This module is the SINGLE authority for the shape of vehicle/fitment data in the
 * storefront. CFM is the authority for the data itself; this file is the promise the
 * storefront makes about what it will accept and how it will read it.
 *
 * PURE: no server-only imports, no I/O. Safe from both Client and Server Components.
 *
 * Three rules encoded here, because they are the ones a UI gets wrong:
 *
 * 1. `externalReference` (`cfm:product:<id>`) stays the stable integration identity,
 *    but it is NOT sufficient on its own. The live Saleor API offers no bulk filter by
 *    externalReference — neither `ProductWhereInput` nor `ProductFilterInput` exposes
 *    it, only the singular `product(externalReference:)` lookup. Bulk goes through
 *    `ids:`. So every product reference MUST also carry `saleorProductId` and
 *    `saleorVariantId`, and those are bound to one Saleor instance — hence
 *    `FitmentDataset.saleorInstance`.
 *
 * 2. Generation production years are NOT application years. A generation built
 *    2015–2021 may only have a verified roof-rack application for 2017–2021.
 *    `VehicleGeneration.production*` never widens `FitmentApplication.year*`.
 *
 * 3. Absence of a row is only NO_FIT where the dataset explicitly claims complete
 *    coverage (see `FitmentCoverage`). Everywhere else absence is UNKNOWN. This is
 *    what stops a partial index from telling a customer "nothing fits your car".
 */

/** Bump on any breaking change to the shapes below. Providers must match exactly. */
export const FITMENT_SCHEMA_VERSION = "1.0.0";

/** Prefix of the stable CFM integration identity. */
export const CFM_EXTERNAL_REFERENCE_PREFIX = "cfm:product:";

// ---------------------------------------------------------------------------
// Qualifiers
// ---------------------------------------------------------------------------

/**
 * Roof interface. This is the qualifier that actually decides which roof-rack set
 * fits, and it is the one a customer most often cannot answer from memory — so the
 * selector must never guess it when a generation offers more than one.
 */
export const ROOF_TYPES = [
	"naked-roof",
	"raised-rails",
	"flush-rails",
	"fixpoint",
	"rain-gutter",
	"t-track",
] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const BODY_TYPES = [
	"hatchback",
	"estate",
	"saloon",
	"suv",
	"mpv",
	"van",
	"coupe",
	"convertible",
	"pickup",
] as const;
export type BodyType = (typeof BODY_TYPES)[number];

/**
 * The qualifiers a single application row constrains. An ABSENT key means
 * "this application does not care about that qualifier" — not "no values".
 * An empty array is a data error and is rejected by the validator.
 */
export type FitmentQualifiers = {
	roofTypes?: RoofType[];
	bodyTypes?: BodyType[];
	doors?: number[];
};

// ---------------------------------------------------------------------------
// Vehicle tree
// ---------------------------------------------------------------------------

export type VehicleMake = {
	id: string;
	name: string;
};

export type VehicleModel = {
	id: string;
	makeId: string;
	name: string;
};

export type VehicleGeneration = {
	id: string;
	modelId: string;
	name: string;
	/** Production window of the generation. NOT an application window — see file header. */
	productionYearFrom: number;
	/** `null` = still in production. */
	productionYearTo: number | null;
	/** Qualifiers this generation is available in. Drives which questions the selector asks. */
	qualifiers: FitmentQualifiers;
};

/**
 * A customer's answer. `year`, `roofType`, `bodyType` and `doors` are the qualifying
 * answers; anything the generation does not vary in is left undefined by the selector
 * rather than defaulted.
 */
export type VehicleSelection = {
	makeId: string;
	modelId: string;
	generationId: string;
	year: number;
	roofType?: RoofType;
	bodyType?: BodyType;
	doors?: number;
};

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/**
 * Why a row is (or is not) trustworthy.
 * - `verified`   — source-confirmed for the whole stated window and qualifier set.
 * - `provisional`— derived or inferred; usable, but never renders as a green badge.
 * - `year-hold`  — the application window itself is disputed upstream. Never promotes
 *                  to verified, no matter how the UI is asked to render it.
 * - `conflict`   — two source rows disagree for the same selection.
 */
export const VERIFICATION_STATUSES = ["verified", "provisional", "year-hold", "conflict"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * A mounting condition or caveat. `code` is stable and machine-readable; `text` carries
 * source-authored copy per locale.
 *
 * Rendering rule: prefer `text[locale]`; else an i18n message for `code`; else render
 * NOTHING and downgrade coverage. Never show a Slovak condition on a German page, and
 * never invent a condition that the data did not carry.
 */
export type FitmentCondition = {
	code: string;
	text?: Record<string, string>;
};

export type FitmentProductRef = {
	/** `cfm:product:<id>` — stable across re-imports. */
	externalReference: string;
	/** Bound to `FitmentDataset.saleorInstance`. Required: bulk lookup needs `ids:`. */
	saleorProductId: string;
	/** The exact variant that is purchasable. Never inferred from the product. */
	saleorVariantId: string;
	/**
	 * Present when this reference is a complete roof-rack set. `includes` are stable
	 * component codes (bars / feet / kit), rendered through i18n — the storefront does
	 * not author set contents.
	 */
	completeSet?: {
		includes: string[];
	};
	/**
	 * Normalized, comparable properties for configurator filtering and comparison.
	 * These come from the CFM index, NOT from Saleor attributes: 39 of the 79 Saleor
	 * attributes are PLAIN_TEXT and cannot be filtered by value.
	 */
	facets?: Record<string, string | number | boolean>;
};

export type FitmentApplication = {
	applicationId: string;
	generationId: string;
	/** Application window. Independent of the generation's production window. */
	yearFrom: number;
	/** `null` = open-ended. */
	yearTo: number | null;
	qualifiers: FitmentQualifiers;
	conditions: FitmentCondition[];
	verificationStatus: VerificationStatus;
	/**
	 * `true` marks EXPLICIT negative evidence: the source states this does not fit.
	 * This is the only thing besides guaranteed complete coverage that may produce
	 * a NO_FIT verdict.
	 */
	negative?: boolean;
	products: FitmentProductRef[];
};

// ---------------------------------------------------------------------------
// Dataset envelope
// ---------------------------------------------------------------------------

/**
 * What the dataset claims to cover COMPLETELY. Inside this scope, absence of a row is
 * meaningful and yields NO_FIT. Outside it, absence yields UNKNOWN.
 *
 * A dataset that declares nothing complete can never produce NO_FIT from absence, which
 * is the correct default for a partial index.
 */
export type FitmentCoverage = {
	/** Make ids for which the source guarantees every application row is present. */
	completeForMakeIds: string[];
	/** Free-text provenance note shown in diagnostics, never to a customer. */
	note?: string;
};

export type FitmentDataset = {
	schemaVersion: string;
	datasetVersion: string;
	/** Content hash of the payload, for change detection and cache keying. */
	datasetHash: string;
	/** ISO-8601. Drives staleness. */
	generatedAt: string;
	source: {
		system: string;
		note?: string;
	};
	/**
	 * The Saleor instance every `saleorProductId` / `saleorVariantId` belongs to.
	 * A dataset generated against a different instance must be REJECTED, not merged —
	 * the ids would silently point at other products.
	 */
	saleorInstance: string;
	validity: {
		/** ISO-8601 or `null` for no hard expiry. */
		validUntil: string | null;
		/** Beyond this age the verdict degrades to STALE. */
		staleAfterDays: number;
	};
	coverage: FitmentCoverage;
	makes: VehicleMake[];
	models: VehicleModel[];
	generations: VehicleGeneration[];
	applications: FitmentApplication[];
};

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

/**
 * The complete set of answers the UI may render. Deliberately includes the two
 * "not a compatibility answer at all" states so no surface has to invent them.
 *
 * Only VERIFIED_FIT may render as a positive/green state.
 */
export const FITMENT_VERDICTS = [
	"VERIFIED_FIT",
	"NO_FIT",
	"UNKNOWN",
	"AMBIGUOUS",
	"STALE",
	"PROVIDER_UNAVAILABLE",
	"UNIVERSAL",
	"NO_VEHICLE_SELECTED",
] as const;
export type FitmentVerdict = (typeof FITMENT_VERDICTS)[number];

/** Whether the answer was drawn from a scope the dataset claims to cover completely. */
export type FitmentCoverageLevel = "complete" | "partial";

export type FitmentResult = {
	verdict: FitmentVerdict;
	coverage: FitmentCoverageLevel;
	/** Applications that matched the selection. Empty for every non-fitting verdict. */
	matched: FitmentApplication[];
	/** Union of conditions across matched applications, de-duplicated by code. */
	conditions: FitmentCondition[];
	/** Dataset provenance, so a surface can render "checked against …" truthfully. */
	dataset: {
		datasetVersion: string;
		generatedAt: string;
		schemaVersion: string;
	} | null;
	/** Machine-readable reason, for diagnostics and tests. Never rendered raw. */
	reason: string;
};

/** The only verdict that may render as a confirmed, positive state. */
export function isPositiveVerdict(verdict: FitmentVerdict): boolean {
	return verdict === "VERIFIED_FIT";
}

/**
 * Whether a verdict means "we could not answer" as opposed to "the answer is no".
 * A provider outage, a partial index and an ambiguous selection are all NOT a no.
 */
export function isInconclusiveVerdict(verdict: FitmentVerdict): boolean {
	return (
		verdict === "UNKNOWN" ||
		verdict === "AMBIGUOUS" ||
		verdict === "STALE" ||
		verdict === "PROVIDER_UNAVAILABLE"
	);
}
