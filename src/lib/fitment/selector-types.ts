import { type BodyType, type RoofType } from "./contract";
import { type GenerationCandidate } from "./selector-plan";

/**
 * Types and constants for the vehicle selector.
 *
 * Separate from `selector-actions.ts` because a `"use server"` module may export
 * nothing but async functions — a constant there is a build error ("can only export
 * async functions, found object"), and Next reports it while still exiting 0.
 */

export type SelectorOption = { id: string; name: string };

export type SelectorQualifiers = {
	/**
	 * Roof types this generation is known to appear with — ALWAYS present when the
	 * dataset expresses any, including when there is exactly one. The shopper confirms
	 * the roof every time; a list of what we can offer is not evidence of what the car
	 * has. `null` means the dataset expresses no roof constraint at all.
	 */
	roofTypes: RoofType[] | null;
	/**
	 * Asked only when the chosen generation genuinely varies. A single value is a fact
	 * about the generation the shopper already picked, so it is filled in below rather
	 * than asked — and, crucially, rather than dropped.
	 */
	bodyTypes: BodyType[] | null;
	doors: number[] | null;
	/** Values settled by the generation itself. The client sends these back unchanged. */
	resolved: { bodyType?: BodyType; doors?: number };
};

/**
 * One step of the selector.
 *
 * The order is make → model → YEAR; `generationCandidates` appears only when a year lands
 * in more than one generation and a human-answerable question is needed to separate them.
 */
export type SelectorStep = {
	makes: SelectorOption[];
	models: SelectorOption[] | null;
	/** Every year this model was built, newest first. */
	years: number[] | null;
	/** Present only when the year did not settle the generation on its own. */
	generationCandidates: GenerationCandidate[] | null;
	/** The generation the year (plus any discriminator) settled on. */
	generation: GenerationCandidate | null;
	qualifiers: SelectorQualifiers | null;
	/**
	 * True when a month of MANUFACTURE would change the answer: the year sits on a window
	 * boundary that the source knows to the month. False when no window here is
	 * month-precise, in which case the month is not worth a question.
	 */
	monthDecides: boolean;
	/** True when the dataset is committed test data rather than a CFM export. */
	isFixture: boolean;
	/** True when there is no dataset at all. The UI must say so, not render an empty list. */
	unavailable: boolean;
};

export const EMPTY_STEP: SelectorStep = {
	makes: [],
	models: null,
	years: null,
	generationCandidates: null,
	generation: null,
	qualifiers: null,
	monthDecides: false,
	isFixture: false,
	unavailable: true,
};

/**
 * The shopper's answer to "does your car have this roof?".
 *
 * Three values, and the two that are not a roof type must never collapse into one.
 * "Iný typ" says the roof is not among the ones we hold data for; "Neviem rozpoznať"
 * says they cannot tell. Both leave `roofType` unset, so the resolver reports that it
 * cannot confirm — which is true — instead of a fit derived from the only value we
 * happened to have.
 */
export type RoofAnswer = { kind: "confirmed"; roofType: RoofType } | { kind: "other" } | { kind: "unsure" };

/**
 * The shopper's answer to "which month was it built?".
 *
 * Asked only when a month-precise window boundary falls on their year. "Neviem" is a
 * first-class answer, not a refusal to answer: the resolver reports NEEDS_DETAIL, which
 * is neither a fit nor a rejection, and the shopper is told what would settle it.
 */
export type MonthAnswer = { kind: "month"; month: number } | { kind: "unknown" };
