import { type BodyType, type RoofType } from "./contract";

/**
 * Types and constants for the vehicle selector.
 *
 * Separate from `selector-actions.ts` because a `"use server"` module may export
 * nothing but async functions — a constant there is a build error ("can only export
 * async functions, found object"), and Next reports it while still exiting 0.
 */

export type SelectorOption = { id: string; name: string };

export type SelectorQualifiers = {
	/** Present only when the generation genuinely varies — one option is not a question. */
	roofTypes: RoofType[] | null;
	bodyTypes: BodyType[] | null;
	doors: number[] | null;
};

export type SelectorStep = {
	makes: SelectorOption[];
	models: SelectorOption[] | null;
	generations: SelectorOption[] | null;
	years: number[] | null;
	qualifiers: SelectorQualifiers | null;
	/** True when the dataset is committed test data rather than a CFM export. */
	isFixture: boolean;
	/** True when there is no dataset at all. The UI must say so, not render an empty list. */
	unavailable: boolean;
};

export const EMPTY_STEP: SelectorStep = {
	makes: [],
	models: null,
	generations: null,
	years: null,
	qualifiers: null,
	isFixture: false,
	unavailable: true,
};
