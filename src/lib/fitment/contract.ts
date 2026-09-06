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

/**
 * The ONLY schema version this build understands, and it is matched exactly.
 *
 * It used to accept any `2.x`, which is the kind of leniency that reads as tolerance and
 * behaves as a silent downgrade. CFM 3.0.0 carries month boundaries and a per-product
 * evidence/eligibility block; a build that accepted `2.1` would have taken that file,
 * ignored every field it did not recognise, and gone on deciding compatibility from
 * years alone — with a green validator and a confident wrong answer. Refusing an
 * unknown version is the only behaviour that cannot do that.
 */
export const FITMENT_SCHEMA_VERSION = "3.0.0";

/** Exact-match allow list. Add a version here only once this build can read it. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = [FITMENT_SCHEMA_VERSION];

/** Prefix of the stable CFM integration identity. */
export const CFM_EXTERNAL_REFERENCE_PREFIX = "cfm:product:";

// ---------------------------------------------------------------------------
// What kind of product this is
// ---------------------------------------------------------------------------

/**
 * The product's kind, as classified by the source — NOT inferred by the storefront.
 *
 * This exists because the first version of this module got it wrong in a way that no
 * type could catch: a roof BOX and a ski CARRIER were offered as "complete roof rack
 * sets" simply because a fitment row pointed at them and carried a `completeSet` field.
 * The presence of `completeSet.includes` is not evidence that a product is a roof rack,
 * and neither is its name, its photograph, its category or the word SET inside an
 * external reference.
 *
 * Only `roof-rack-set` may enter the configurator's offer. Boxes, carriers, kits and
 * spares remain perfectly sellable products in the ordinary catalogue — they are simply
 * not answers to "which roof rack fits my car", and they must never inherit a set's
 * compatibility badge.
 */
export const PRODUCT_KINDS = [
	"roof-rack-set",
	"roof-box",
	"ski-carrier",
	"bike-carrier",
	"fitting-kit",
	"spare-part",
	"accessory",
] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** The only kind this wave's configurator offers. */
export const CONFIGURATOR_PRODUCT_KIND: ProductKind = "roof-rack-set";

/**
 * The slice of the catalogue a dataset speaks for.
 *
 * Coverage claims are meaningless without it. "Complete for Škoda" inside a Nordrive
 * roof-rack program means "we know every Nordrive roof-rack set for that make" — it
 * does NOT license the sentence "nothing fits your Škoda", which would also deny every
 * roof box, every carrier and every product from every other brand.
 */
export type FitmentScope = {
	/** e.g. "nordrive-roof-racks". Free-form, owned by the source. */
	programId: string;
	/** The kinds this dataset makes any claim about at all. */
	productKinds: ProductKind[];
};

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
	/**
	 * Month of MANUFACTURE, 1–12. Optional, and asked for only when it decides something
	 * — on a boundary year of a window whose boundary is known to the month.
	 *
	 * It is not the month of first registration. Those differ, often by months and
	 * sometimes across a year end, and accepting one for the other would put a shopper on
	 * the wrong side of a boundary the source was careful about.
	 */
	manufactureMonth?: number;
	roofType?: RoofType;
	bodyType?: BodyType;
	doors?: number;
};

// ---------------------------------------------------------------------------
// Application windows
// ---------------------------------------------------------------------------

/**
 * A point on the calendar, to the month where the source knows it.
 *
 * `month` ABSENT means the month is unknown — it does not mean January, it does not mean
 * December, and it must never be filled in to make a comparison easier. CFM loses it on
 * the rows where reconciliation moved a boundary onto a generation edge (303 of 9,192 in
 * the first real export), and inventing one there would turn "we are not sure" into a
 * date that decides whether somebody's roof rack fits.
 */
export type YearMonth = {
	year: number;
	/** 1–12. Absent = unknown. */
	month?: number;
};

/**
 * How precisely a boundary is known. Stated by the source rather than inferred from
 * whether `month` happens to be present, so a missing month can never be read as an
 * oversight in the exporter.
 */
export const WINDOW_PRECISIONS = ["month", "year", "open"] as const;
export type WindowPrecision = (typeof WINDOW_PRECISIONS)[number];

/**
 * The window an application is valid for — the manufacturer's, not the generation's.
 *
 * A generation built 2015–2021 may carry a roof-rack application only for 2017–2021, so
 * these two must never be conflated. `reconciledToGeneration` says the boundary was
 * pulled onto the generation edge at import; when that happened the month is gone and
 * `startPrecision` says so.
 */
export type FitmentWindow = {
	from: YearMonth;
	/** `null` = still open. Then `endPrecision` is "open". */
	to: YearMonth | null;
	startPrecision: WindowPrecision;
	endPrecision: WindowPrecision;
	reconciledToGeneration: boolean;
	/** The source's own notation, e.g. "03/06>09/13". Diagnostics only, never rendered. */
	sourceWindow?: string;
};

// ---------------------------------------------------------------------------
// Evidence, review and eligibility — three separate questions
// ---------------------------------------------------------------------------

/**
 * Where the claim comes from. NOT how good it is.
 *
 * `manufacturer-application` is Nordrive's own application list: real evidence, and
 * enough to sell against, as long as nothing else disqualifies the row. It is not the
 * same as somebody having checked it, which is why `verification` is a separate field.
 */
export const EVIDENCE_KINDS = ["manufacturer-application", "manual-verification", "derived"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type FitmentEvidence = {
	kind: EvidenceKind;
	/** e.g. "nordrive". */
	supplier?: string;
	/** The source's own reference for the row, e.g. a part number. */
	sourceRef?: string;
	/** The source's untouched window notation, before any reconciliation. */
	sourceWindow?: string;
	/** 0–1, from the source. Never used as a threshold here — it is diagnostics. */
	confidence?: number;
};

/** What review has (or has not) concluded about this row. */
export const QA_STATUSES = ["accepted", "unreviewed", "hold", "conflict", "rejected"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];

/**
 * Whether anyone has independently checked the claim.
 *
 * Today nothing is `cfm-verified` — all 9,192 rows in the first real export are the
 * manufacturer's word. That is worth saying out loud to a shopper, and it is worth
 * keeping the stronger word free for when it is earned.
 */
export const VERIFICATION_LEVELS = ["not-independently-verified", "cfm-verified"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

/**
 * The source's own verdict on whether this product may be offered for this application.
 *
 * Computed by CFM from the evidence, the review status and its exclusions — so the
 * storefront does not re-derive it and cannot disagree with it. `reasons` carries stable
 * codes (`known_mapping_suspect`, …) for diagnostics; they are never rendered raw.
 *
 * It says nothing about price, publication or stock. Those remain Saleor's answer, and
 * both must agree before anything reaches a cart.
 */
export type FitmentEligibility = {
	sellable: boolean;
	reasons: string[];
};

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

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
	 * What this product IS, per the source. Required: the configurator refuses to offer
	 * anything it cannot classify, because the failure mode of guessing is offering a
	 * roof box as a roof rack.
	 */
	productKind: ProductKind;
	/**
	 * Real contents of THIS set, from the source. Never a template.
	 *
	 * Not every roof-rack system needs a fitting kit — a fixpoint system may ship
	 * without one — so "bars + feet + kit" must not be pasted onto every set. An absent
	 * `completeSet` on a `roof-rack-set` means the contents are unknown, and unknown
	 * contents are not printed.
	 */
	completeSet?: {
		includes: string[];
	};
	/**
	 * Normalized, comparable properties for configurator filtering and comparison.
	 * Sourced from the CFM index rather than Saleor attributes — the vehicle attribute
	 * slugs the PLP filter whitelists do not exist in this Saleor instance at all.
	 *
	 * Anything absent is simply not rendered. A load rating in particular is a safety
	 * number and is never defaulted, inferred from a sibling product, or carried over
	 * from another set.
	 */
	facets?: Record<string, string | number | boolean>;
	/**
	 * Where this product's claim comes from, what review said about it, and whether the
	 * source will stand behind selling it.
	 *
	 * Deliberately per PRODUCT, not per application. One application carries many
	 * products, and one of them can be disputed while the rest are sound — 47 products in
	 * the first real export are known-suspect mappings sitting inside otherwise clean
	 * applications. Hanging the status on the group would let the clean products launder
	 * the disputed one.
	 */
	evidence: FitmentEvidence;
	qaStatus: QaStatus;
	verification: VerificationLevel;
	eligibility: FitmentEligibility;
};

export type FitmentApplication = {
	applicationId: string;
	generationId: string;
	/**
	 * The manufacturer's window, to the month where it is known. Replaces the
	 * `yearFrom`/`yearTo` pair of schema 2: a year-only window cannot express
	 * "from December 2019", and rounding it to 2019 silently offers a rack to every
	 * car built that January.
	 */
	window: FitmentWindow;
	qualifiers: FitmentQualifiers;
	conditions: FitmentCondition[];
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
	/** The catalogue slice every claim below is scoped to. */
	scope: FitmentScope;
	/**
	 * Make ids for which the source guarantees every application row **within `scope`**
	 * is present. Absence of a row for such a make means "no set in this program fits",
	 * never "nothing fits".
	 */
	completeForMakeIds: string[];
	/** Free-text provenance note shown in diagnostics, never to a customer. */
	note?: string;
};

/**
 * A self-contained catalogue for DEMO datasets only.
 *
 * Its existence is the fix for the worst defect in v1: a demo dataset used to name real
 * Saleor product ids, so the storefront fetched a real roof box and dressed it in an
 * invented "complete roof rack set" badge with an invented load rating and an invented
 * compatibility claim. A demo dataset now brings its own commerce data and its own
 * synthetic ids, and the offer layer refuses to consult Saleor for it at all.
 */
export type DemoCatalogueEntry = {
	saleorProductId: string;
	saleorVariantId: string;
	name: string;
	categoryName?: string;
	price?: { amount: number; currency: string };
	/** Mirrors `cfm_availability_mode`, so demo and real take the same code path. */
	availabilityMode?: string;
	/** Only a hard zero is meaningful; see `resolveAvailability`. */
	quantityAvailable?: number;
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
	/** Present only on demo datasets. Its presence is what marks one. */
	demoCatalogue?: DemoCatalogueEntry[];
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
	/**
	 * The manufacturer's application list says it fits, and nobody has independently
	 * checked it. Offerable, and it must say so in as many words — "Kompatibilné podľa
	 * aplikačných údajov Nordrive", never "overené".
	 */
	"MANUFACTURER_FIT",
	/**
	 * Everything matches except one answer we do not have — typically the month, on a
	 * boundary year. Not a fit and NOT a refusal: the shopper is asked, not guessed at.
	 */
	"NEEDS_DETAIL",
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
	/**
	 * The evidence block of the PRODUCT this result is about, when it is about one.
	 *
	 * Carried out of the resolver rather than looked up again downstream, so the surface
	 * that renders "according to Nordrive's application data" and the gate that decides
	 * whether the button appears are reading the very same row.
	 */
	product: {
		evidence: FitmentEvidence;
		qaStatus: QaStatus;
		verification: VerificationLevel;
		eligibility: FitmentEligibility;
	} | null;
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

/** The only verdict that may render as an independently confirmed state. */
export function isPositiveVerdict(verdict: FitmentVerdict): boolean {
	return verdict === "VERIFIED_FIT";
}

/**
 * THE decision about whether a fitment answer may be offered for sale.
 *
 * One function, called by the resolver, the configurator, the offer layer, the PLP, the
 * PDP and the server-side cart gate — because six surfaces each deciding this for
 * themselves is six chances to disagree, and the one that disagrees generously is the
 * one that sells the wrong rack.
 *
 * Both halves must hold:
 *
 *   - the VERDICT is a fit (verified, or the manufacturer's word), and
 *   - the SOURCE will stand behind this specific product for it.
 *
 * `NEEDS_DETAIL` is deliberately not offerable: it is a question we have not asked yet.
 * Commercial availability — price, publication, variant, stock — is Saleor's separate
 * answer, and it is checked separately.
 */
export function isFitmentOfferable(input: {
	verdict: FitmentVerdict;
	eligibility?: FitmentEligibility | null;
}): boolean {
	if (input.verdict !== "VERIFIED_FIT" && input.verdict !== "MANUFACTURER_FIT") return false;
	// Absent eligibility is not permission. A row that does not say it may be sold is a
	// row that may not be sold.
	return input.eligibility?.sellable === true;
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
		verdict === "PROVIDER_UNAVAILABLE" ||
		// We know everything except one answer the shopper has not given us yet. That is
		// emphatically not "no" — it is the state in which we are supposed to ask.
		verdict === "NEEDS_DETAIL"
	);
}

// ---------------------------------------------------------------------------
// Window comparison
// ---------------------------------------------------------------------------

/**
 * Does a customer's vehicle fall inside an application window?
 *
 * Boundaries are INCLUSIVE at both ends. The three-valued answer is the whole point:
 * "needs-detail" is what happens when the window knows a month, the shopper's year sits
 * exactly on that boundary, and they have not told us their month. Collapsing that into
 * yes would sell a rack to a car built two months too early; collapsing it into no would
 * refuse a customer whose car very likely fits. Both are worse than asking.
 *
 * An unknown month on the WINDOW side (`startPrecision: "year"`, which is what
 * reconciliation leaves behind) is treated as "the whole boundary year is in" — the
 * source told us the year and admitted it does not know the month, so narrowing it
 * further would be our invention rather than its data.
 *
 * `month` is the month of MANUFACTURE. First registration is a different date and can be
 * a year later; nothing here may quietly accept one for the other.
 */
export type WindowMatch = "in" | "out" | "needs-detail";

function compareBoundary(
	boundary: YearMonth,
	precision: WindowPrecision,
	year: number,
	month: number | undefined,
	side: "start" | "end",
): WindowMatch {
	if (year !== boundary.year) {
		const inside = side === "start" ? year > boundary.year : year < boundary.year;
		return inside ? "in" : "out";
	}
	// Same year as the boundary. Only a known month on BOTH sides can decide it.
	if (precision !== "month" || boundary.month === undefined) return "in";
	if (month === undefined) return "needs-detail";
	const inside = side === "start" ? month >= boundary.month : month <= boundary.month;
	return inside ? "in" : "out";
}

export function matchWindow(window: FitmentWindow, year: number, month?: number): WindowMatch {
	const start = compareBoundary(window.from, window.startPrecision, year, month, "start");
	if (start === "out") return "out";

	if (window.to === null) return start;
	const end = compareBoundary(window.to, window.endPrecision, year, month, "end");
	if (end === "out") return "out";

	// "out" already returned; anything unresolved on either side keeps the whole window
	// unresolved. A definite "in" needs both ends to be definite.
	return start === "needs-detail" || end === "needs-detail" ? "needs-detail" : "in";
}
