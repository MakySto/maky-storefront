/**
 * What the selector asks, in what order, and — the part that was wrong — what it is
 * allowed to stop asking.
 *
 * Pure and separate from `selector-actions.ts` so the decisions can be tested directly.
 * They are decisions about truthfulness, not about layout.
 *
 * THE ORDER IS make → model → YEAR OF MANUFACTURE. It used to be
 * make → model → generation → year, which asks the shopper for a fact they do not have.
 * Nobody reads "B9" or "939" off a registration document; they read a year. The
 * generation is OUR technical key, so we derive it from the year and only ask a human
 * question when the year genuinely does not settle it.
 *
 * THE RULE THAT WAS BROKEN, stated once:
 *
 *   A question may be skipped when it is genuinely RESOLVED — not when we happen to hold
 *   a single answer to it.
 *
 * Those are different things, and conflating them produced a real defect.
 * `askableQualifiers` dropped every single-valued qualifier as "no need to ask", so for a
 * generation the dataset knows with one roof type the sheet asked nothing, saved nothing,
 * and handed the resolver `roofType: undefined` — which is an unanswered qualifier, which
 * is AMBIGUOUS, which offers the shopper nothing at all. Not a safety hole (nothing was
 * substituted) but a functional one, and with real data it would be the common case.
 *
 * The generation IS resolvable — a year either lands in one generation's production span
 * or it does not, and that is a fact about the data. The roof type is NOT: knowing that
 * we only stock racks for integrated rails says nothing whatsoever about what is on the
 * shopper's roof. So the generation may be derived and the roof type may not.
 */

import { type BodyType, type FitmentApplication, type FitmentDataset, type RoofType } from "./contract";

/** A generation the shopper's year could refer to. */
export type GenerationCandidate = {
	id: string;
	name: string;
	productionYearFrom: number;
	productionYearTo: number | null;
	/** Human-readable discriminators, for when the year alone is not enough. */
	bodyTypes: BodyType[] | null;
	doors: number[] | null;
	/** The roofs this generation was sold with — what the car can have, not what we stock. */
	roofTypes: RoofType[] | null;
};

/** How the year resolved against the model's generations. */
export type GenerationResolution =
	| { kind: "resolved"; generation: GenerationCandidate }
	| { kind: "ambiguous"; candidates: GenerationCandidate[] }
	| { kind: "none" };

type GenerationLike = FitmentDataset["generations"][number];

/** Next calendar year, so an open-ended generation cannot produce an endless list. */
function openEnd(): number {
	return new Date().getUTCFullYear() + 1;
}

function toCandidate(g: GenerationLike): GenerationCandidate {
	return {
		id: g.id,
		name: g.name,
		productionYearFrom: g.productionYearFrom,
		productionYearTo: g.productionYearTo,
		bodyTypes: g.qualifiers?.bodyTypes?.length ? g.qualifiers.bodyTypes : null,
		doors: g.qualifiers?.doors?.length ? g.qualifiers.doors : null,
		roofTypes: g.qualifiers?.roofTypes?.length ? g.qualifiers.roofTypes : null,
	};
}

/**
 * Every year this model was built, newest first.
 *
 * The union across its generations, so the shopper picks a year without ever being shown
 * a generation. Bounded by PRODUCTION years — an application window may not widen this,
 * because a rack listed from 2015 does not mean the car existed in 2015.
 */
export function yearsForModel(generations: GenerationLike[]): number[] {
	const years = new Set<number>();
	for (const g of generations) {
		const to = g.productionYearTo ?? openEnd();
		for (let y = g.productionYearFrom; y <= to; y += 1) years.add(y);
	}
	return [...years].sort((a, b) => b - a);
}

/**
 * Which generation the shopper means, given the year.
 *
 * Overlap is real: manufacturers run the outgoing and incoming generation in the same
 * calendar year, so a year can legitimately name two. When it does we ASK — and the
 * question has to be one a person can answer from looking at their car, which is why the
 * candidates carry body type and door count rather than a bare internal code.
 */
export function resolveGenerationForYear(generations: GenerationLike[], year: number): GenerationResolution {
	const candidates = generations
		.filter((g) => year >= g.productionYearFrom && year <= (g.productionYearTo ?? openEnd()))
		.map(toCandidate);
	if (candidates.length === 0) return { kind: "none" };
	if (candidates.length === 1) return { kind: "resolved", generation: candidates[0]! };
	return { kind: "ambiguous", candidates };
}

/**
 * Does the month of manufacture actually decide anything here?
 *
 * Only ask when BOTH hold:
 *
 *   - the shopper's year sits on a boundary of some application window for this
 *     generation, and
 *   - that boundary is known TO THE MONTH.
 *
 * The second half is the one that is easy to lose. When a window says
 * `startPrecision: "year"` the source told us the year and admitted it does not know the
 * month; the whole boundary year is inside the window and the shopper's month cannot move
 * the answer. Asking anyway would be collecting an answer we have already decided to
 * ignore — and there are 38 such applications in the current candidate export, so this is
 * the ordinary case, not an edge one.
 */
export function monthDecidesFor(
	applications: FitmentApplication[],
	generationId: string,
	year: number,
): boolean {
	return applications.some((app) => {
		if (app.generationId !== generationId) return false;
		if (app.window.startPrecision === "month" && app.window.from.year === year) return true;
		if (app.window.endPrecision === "month" && app.window.to?.year === year) return true;
		return false;
	});
}

/**
 * The roof types the shopper should be choosing between.
 *
 * The GENERATION's list comes first, because that is the set of roofs the car was sold
 * with — a fact about their car. The applications' roof types are unioned in only so a
 * generation with an incomplete list cannot hide an option we do have stock for.
 *
 * Taking this from the applications ALONE would be the same mistake in a new place. That
 * an Octavia IV appears in our data only with flush rails says what we stock, not what is
 * on the roof in the shopper's driveway; offering only that leaves somebody with a naked
 * roof no way to say so, and pushes them at the one answer we wanted to hear.
 *
 * Returned even when there is exactly one — that is the point. An empty list means the
 * dataset expresses no roof constraint anywhere for this generation, and only then is the
 * question genuinely resolved: there is nothing to distinguish.
 */
export function roofChoicesFor(
	applications: FitmentApplication[],
	generation: Pick<GenerationCandidate, "id"> & { roofTypes?: RoofType[] | null },
): RoofType[] {
	const seen = new Set<RoofType>(generation.roofTypes ?? []);
	for (const app of applications) {
		if (app.generationId !== generation.id) continue;
		for (const roof of app.qualifiers.roofTypes ?? []) seen.add(roof);
	}
	return [...seen];
}

/**
 * A qualifier other than the roof type: asked only when the generation genuinely varies.
 *
 * Unlike the roof, these are properties we can already read off the chosen generation —
 * a generation sold only as an estate does not need the shopper to confirm it is an
 * estate — so a single value here IS resolved, and the answer is filled in rather than
 * dropped. That filling-in is the second half of the fix: the old code dropped the
 * question AND the answer, which is what left the resolver with `undefined`.
 */
export function resolveSingleValued<T>(values: T[] | null | undefined): { ask: T[] | null; fill: T | null } {
	if (!values || values.length === 0) return { ask: null, fill: null };
	if (values.length === 1) return { ask: null, fill: values[0]! };
	return { ask: values, fill: null };
}
