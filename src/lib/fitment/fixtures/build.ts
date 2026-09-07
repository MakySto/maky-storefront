import {
	type FitmentApplication,
	type FitmentProductRef,
	type FitmentWindow,
	type QaStatus,
	type VerificationLevel,
	type EvidenceKind,
} from "../contract";

/**
 * Builders for test datasets.
 *
 * Schema 3.0.0 made an application row wide: a window with two precisions, and four
 * evidence fields on every product. Repeating all of that inline turned the tests into
 * transcription, and transcription hides the one field a case is actually about.
 *
 * The defaults are deliberately the PERMISSIVE ones — an open, year-precise window and
 * an accepted, sellable product — so that a test which narrows nothing is testing the
 * happy path, and a test about a refusal has to say which refusal, in one line.
 *
 * Nothing here describes a real vehicle or a real product. These are harnesses.
 */

export function aWindow(over: Partial<FitmentWindow> = {}): FitmentWindow {
	return {
		from: { year: 2015 },
		to: null,
		startPrecision: "year",
		endPrecision: "open",
		reconciledToGeneration: false,
		...over,
	};
}

/** A window from `from` to `to`, each `[year, month?]`. Precision follows the month. */
export function windowOf(from: [number, number?], to: [number, number?] | null): FitmentWindow {
	const point = ([year, month]: [number, number?]) => (month === undefined ? { year } : { year, month });
	return {
		from: point(from),
		to: to === null ? null : point(to),
		startPrecision: from[1] === undefined ? "year" : "month",
		endPrecision: to === null ? "open" : to[1] === undefined ? "year" : "month",
		reconciledToGeneration: false,
	};
}

export function aProduct(over: Partial<FitmentProductRef> = {}): FitmentProductRef {
	return {
		externalReference: "test:product:set-a",
		saleorProductId: "test-product-set-a",
		saleorVariantId: "test-variant-set-a",
		productKind: "roof-rack-set",
		evidence: { kind: "manufacturer-application", supplier: "test" },
		qaStatus: "accepted",
		verification: "cfm-verified",
		eligibility: { sellable: true, reasons: [] },
		...over,
	};
}

/** The state the real catalogue is in today: the manufacturer's word, nothing more. */
export function aDeclaredProduct(over: Partial<FitmentProductRef> = {}): FitmentProductRef {
	return aProduct({ verification: "not-independently-verified", ...over });
}

/** A product the source will not stand behind. `reasons` must not be empty. */
export function aHeldProduct(reason = "known_mapping_suspect", over: Partial<FitmentProductRef> = {}) {
	return aProduct({
		qaStatus: "hold",
		verification: "not-independently-verified",
		eligibility: { sellable: false, reasons: [reason] },
		...over,
	});
}

export function anApplication(over: Partial<FitmentApplication> = {}): FitmentApplication {
	return {
		applicationId: "app-1",
		generationId: "gen-1",
		window: aWindow(),
		qualifiers: {},
		conditions: [],
		products: [aProduct()],
		...over,
	};
}

export const withEvidence = (
	kind: EvidenceKind,
	qaStatus: QaStatus,
	verification: VerificationLevel,
): Partial<FitmentProductRef> => ({
	evidence: { kind, supplier: "test" },
	qaStatus,
	verification,
	eligibility: {
		sellable: qaStatus === "accepted",
		reasons: qaStatus === "accepted" ? [] : [`qa_${qaStatus}`],
	},
});
