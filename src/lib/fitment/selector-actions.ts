"use server";

/**
 * Step data for the vehicle selector.
 *
 * One action per step rather than shipping the tree to the browser. The fixture tree is
 * small; a real CFM tree is thousands of models, and a selector that only works because
 * the dataset happens to be small is a selector that breaks on the day the data arrives.
 *
 * It also keeps the boundary honest: the dataset can carry provenance, coverage notes and
 * internal identifiers that have no business in a page bundle. The browser gets exactly
 * the labels it is about to render.
 *
 * The ORDER is make → model → year of manufacture. The generation is derived from the
 * year and asked about only when the year lands in two of them; see `selector-plan.ts`
 * for why that distinction is the whole point.
 */

import { loadFitmentDataset } from "./provider";
import { type FitmentApplication } from "./contract";
import {
	monthDecidesFor,
	resolveGenerationForYear,
	resolveSingleValued,
	roofChoicesFor,
	yearsForModel,
	type GenerationCandidate,
} from "./selector-plan";
import { type SelectorQualifiers, type SelectorStep, EMPTY_STEP } from "./selector-types";

export async function loadSelectorStep(input: {
	makeId?: string;
	modelId?: string;
	year?: number;
	/** Only sent back when the year was ambiguous and the shopper separated the two. */
	generationId?: string;
}): Promise<SelectorStep> {
	const { dataset, status } = await loadFitmentDataset();
	if (!dataset) return { ...EMPTY_STEP, isFixture: status.isFixture };

	const makes = dataset.makes.map((m) => ({ id: m.id, name: m.name }));
	const base = {
		makes,
		isFixture: status.isFixture,
		unavailable: false,
		models: null,
		years: null,
		generationCandidates: null,
		generation: null,
		qualifiers: null,
		monthDecides: false,
	} satisfies SelectorStep;

	const make = input.makeId ? dataset.makes.find((m) => m.id === input.makeId) : undefined;
	if (!make) return base;

	const models = dataset.models.filter((m) => m.makeId === make.id).map((m) => ({ id: m.id, name: m.name }));

	const model = input.modelId ? dataset.models.find((m) => m.id === input.modelId) : undefined;
	// A stale modelId under a freshly chosen make must not leak through as a valid step.
	if (!model || model.makeId !== make.id) return { ...base, models };

	const generations = dataset.generations.filter((g) => g.modelId === model.id);
	const years = yearsForModel(generations);
	if (input.year === undefined) return { ...base, models, years };

	const resolution = resolveGenerationForYear(generations, input.year);
	if (resolution.kind === "none") return { ...base, models, years };

	let generation: GenerationCandidate;
	if (resolution.kind === "resolved") {
		generation = resolution.generation;
	} else {
		// The year names two generations. Until the shopper separates them we return the
		// candidates and nothing else — picking the first would be a coin toss dressed up
		// as an answer.
		const chosen = input.generationId
			? resolution.candidates.find((c) => c.id === input.generationId)
			: undefined;
		if (!chosen) return { ...base, models, years, generationCandidates: resolution.candidates };
		generation = chosen;
	}

	return {
		...base,
		models,
		years,
		generation,
		qualifiers: qualifiersFor(dataset.applications, generation),
		monthDecides: monthDecidesFor(dataset.applications, generation.id, input.year),
	};
}

function qualifiersFor(
	applications: FitmentApplication[],
	generation: GenerationCandidate,
): SelectorQualifiers {
	// The roof is never resolved by having one option, so it is never filled in and never
	// dropped — it is returned whole and confirmed by the shopper every time.
	const roofTypes = roofChoicesFor(applications, generation);
	const body = resolveSingleValued(generation.bodyTypes);
	const doors = resolveSingleValued(generation.doors);

	return {
		roofTypes: roofTypes.length > 0 ? roofTypes : null,
		bodyTypes: body.ask,
		doors: doors.ask,
		resolved: {
			...(body.fill ? { bodyType: body.fill } : {}),
			...(doors.fill !== null ? { doors: doors.fill } : {}),
		},
	};
}
