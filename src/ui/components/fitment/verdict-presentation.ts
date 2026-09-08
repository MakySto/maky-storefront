import { type BodyType, type FitmentVerdict, type RoofType } from "@/lib/fitment/contract";

/**
 * How a verdict looks, in one place.
 *
 * The colour family is `fitment-*` (`src/styles/brand.css:208-216`), which was defined
 * for exactly these states and — until now — had never been used by any component.
 *
 * The mapping is deliberately lossy in one direction only: the verdicts that mean "we
 * cannot tell you yet" share the amber treatment, because to a shopper they mean the
 * same thing. Only a fit is green and only NO_FIT is red, so no amount of missing data
 * can ever render as either a promise or a refusal.
 *
 * MANUFACTURER_FIT is green, and that is deliberate: it IS a fit, on the manufacturer's
 * own application data, and it is offerable. What separates it from VERIFIED_FIT is the
 * sentence, not the colour — it says whose word it is. Painting it amber would tell a
 * shopper we are unsure when we are not; painting it identically to VERIFIED_FIT would
 * claim a check nobody has done.
 *
 * The fitment tokens have no `-border` variant, unlike `status-*`, so borders here are
 * `border-current` at low opacity rather than a borrowed token from another family.
 */
export type VerdictTone = "fits" | "no-fit" | "unconfirmed" | "universal";

export function toneForVerdict(verdict: FitmentVerdict): VerdictTone {
	switch (verdict) {
		// Both positive, on purpose — see the verdict list in `contract.ts`. Manufacturer
		// application data is what the trade sells roof racks on, and with zero
		// `cfm-verified` rows today (measured, 9,163 of 9,163) demoting it would paint the
		// whole catalogue as unconfirmed for no one's benefit. The distinction lives in
		// the words — "Kompatibilné podľa údajov výrobcu", the supplier named, never
		// "overené" — and later in a badge only `VERIFIED_FIT` can earn.
		case "VERIFIED_FIT":
		case "MANUFACTURER_FIT":
			return "fits";
		case "NO_FIT":
			return "no-fit";
		case "UNIVERSAL":
			return "universal";
		default:
			// UNKNOWN, AMBIGUOUS, STALE, PROVIDER_UNAVAILABLE, NEEDS_DETAIL,
			// NO_VEHICLE_SELECTED.
			return "unconfirmed";
	}
}

export const TONE_CLASSES: Record<VerdictTone, string> = {
	fits: "bg-fitment-fits-bg text-fitment-fits",
	"no-fit": "bg-fitment-no-fit-bg text-fitment-no-fit",
	unconfirmed: "bg-fitment-unconfirmed-bg text-fitment-unconfirmed",
	universal: "bg-fitment-universal-bg text-fitment-universal",
};

/** i18n key for the short badge label. */
export const VERDICT_LABEL_KEY: Record<FitmentVerdict, string> = {
	VERIFIED_FIT: "verdictVerified",
	MANUFACTURER_FIT: "verdictManufacturer",
	NEEDS_DETAIL: "verdictNeedsDetail",
	NO_FIT: "verdictNoFit",
	UNKNOWN: "verdictUnknown",
	AMBIGUOUS: "verdictAmbiguous",
	STALE: "verdictStale",
	PROVIDER_UNAVAILABLE: "verdictUnavailable",
	UNIVERSAL: "verdictUniversal",
	NO_VEHICLE_SELECTED: "verdictSelectVehicle",
};

/** i18n key for the sentence under the badge. */
export const VERDICT_DETAIL_KEY: Record<FitmentVerdict, string> = {
	VERIFIED_FIT: "verdictVerifiedDetail",
	MANUFACTURER_FIT: "verdictManufacturerDetail",
	NEEDS_DETAIL: "verdictNeedsDetailDetail",
	NO_FIT: "verdictNoFitDetail",
	UNKNOWN: "verdictUnknownDetail",
	AMBIGUOUS: "verdictAmbiguousDetail",
	STALE: "verdictStaleDetail",
	PROVIDER_UNAVAILABLE: "verdictUnavailableDetail",
	UNIVERSAL: "verdictUniversalDetail",
	NO_VEHICLE_SELECTED: "verdictSelectVehicleDetail",
};

export const ROOF_LABEL_KEY: Record<RoofType, string> = {
	"naked-roof": "roofNakedRoof",
	"raised-rails": "roofRaisedRails",
	"flush-rails": "roofFlushRails",
	fixpoint: "roofFixpoint",
	"rain-gutter": "roofRainGutter",
	"t-track": "roofTTrack",
};

export const BODY_LABEL_KEY: Record<BodyType, string> = {
	hatchback: "bodyHatchback",
	estate: "bodyEstate",
	saloon: "bodySaloon",
	suv: "bodySuv",
	mpv: "bodyMpv",
	van: "bodyVan",
	coupe: "bodyCoupe",
	convertible: "bodyConvertible",
	pickup: "bodyPickup",
};

/** Known condition codes that ship with a translation. */
export const CONDITION_LABEL_KEY: Record<string, string> = {
	"torque-check-after-100km": "conditionTorqueCheck",
	"rail-spacing-measure": "conditionRailSpacing",
	"panoramic-roof-limit": "conditionPanoramicRoof",
};
