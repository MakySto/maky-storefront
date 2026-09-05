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
 */

import { loadFitmentDataset } from "./provider";
import { type BodyType, type RoofType } from "./contract";
import { type SelectorQualifiers, type SelectorStep, EMPTY_STEP } from "./selector-types";

/**
 * Only offer a qualifier the generation actually varies in.
 *
 * A generation available with one roof type does not need the shopper to confirm it —
 * the server fills it in when the vehicle is saved. Asking a question with a single
 * answer trains people to click through without reading, which is exactly how the roof
 * type ends up wrong on the one generation where it matters.
 */
function askableQualifiers(qualifiers: {
	roofTypes?: RoofType[];
	bodyTypes?: BodyType[];
	doors?: number[];
}): SelectorQualifiers {
	return {
		roofTypes: qualifiers.roofTypes && qualifiers.roofTypes.length > 1 ? qualifiers.roofTypes : null,
		bodyTypes: qualifiers.bodyTypes && qualifiers.bodyTypes.length > 1 ? qualifiers.bodyTypes : null,
		doors: qualifiers.doors && qualifiers.doors.length > 1 ? qualifiers.doors : null,
	};
}

/**
 * Years offered for a generation.
 *
 * Bounded by the PRODUCTION window, never widened by an application window, and capped at
 * next calendar year so a null `productionYearTo` cannot generate an endless list.
 */
function yearsFor(from: number, to: number | null): number[] {
	const upper = to ?? new Date().getUTCFullYear() + 1;
	const years: number[] = [];
	for (let year = upper; year >= from; year--) years.push(year);
	return years;
}

export async function loadSelectorStep(input: {
	makeId?: string;
	modelId?: string;
	generationId?: string;
}): Promise<SelectorStep> {
	const { dataset, status } = await loadFitmentDataset();
	if (!dataset) return { ...EMPTY_STEP, isFixture: status.isFixture };

	const makes = dataset.makes.map((m) => ({ id: m.id, name: m.name }));
	const base = { makes, isFixture: status.isFixture, unavailable: false };

	const make = input.makeId ? dataset.makes.find((m) => m.id === input.makeId) : undefined;
	if (!make) return { ...base, models: null, generations: null, years: null, qualifiers: null };

	const models = dataset.models.filter((m) => m.makeId === make.id).map((m) => ({ id: m.id, name: m.name }));

	const model = input.modelId ? dataset.models.find((m) => m.id === input.modelId) : undefined;
	// A stale modelId under a freshly chosen make must not leak through as a valid step.
	if (!model || model.makeId !== make.id) {
		return { ...base, models, generations: null, years: null, qualifiers: null };
	}

	const generations = dataset.generations
		.filter((g) => g.modelId === model.id)
		.map((g) => ({ id: g.id, name: g.name }));

	const generation = input.generationId
		? dataset.generations.find((g) => g.id === input.generationId)
		: undefined;
	if (!generation || generation.modelId !== model.id) {
		return { ...base, models, generations, years: null, qualifiers: null };
	}

	return {
		...base,
		models,
		generations,
		years: yearsFor(generation.productionYearFrom, generation.productionYearTo),
		qualifiers: askableQualifiers(generation.qualifiers),
	};
}
