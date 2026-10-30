"use server";

/**
 * Paged, searchable vehicle applications for one product.
 *
 * A roof-bar family can fit thousands of vehicles. Rendering that list into the initial
 * HTML would bloat every product page for the small fraction of visitors who open it, so
 * the page ships a first page and this action serves the rest on demand.
 *
 * Search is server-side over the resolved LABELS, because that is what the shopper types:
 * they search "Octavia", not a generation id.
 */

import { loadFitmentDataset } from "./provider";
import { collectApplicationsForProduct } from "./resolve";
import { type FitmentApplication, type FitmentProductRef, vehicleNodeName } from "./contract";
import { pickConditionText } from "./conditions";
import {
	APPLICATIONS_PAGE_SIZE,
	EMPTY_APPLICATION_PAGE,
	type ApplicationPage,
	type ApplicationRow,
} from "./application-types";

/** The application's conditions in the reader's words, each one once (same code and same text is one). */
function rowConditions(
	application: FitmentApplication,
	locale: string | undefined,
): ApplicationRow["conditions"] {
	const seen = new Set<string>();
	const out: ApplicationRow["conditions"] = [];
	for (const condition of application.conditions) {
		const text = locale ? pickConditionText(condition.text, locale) : null;
		const key = `${condition.code}::${text ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ code: condition.code, text });
	}
	return out;
}

function toRow(
	application: FitmentApplication,
	names: { make: string; model: string; generation: string },
	/** This product's own row inside the application. Status is never the group's. */
	ref: FitmentProductRef | undefined,
	locale: string | undefined,
): ApplicationRow {
	return {
		applicationId: application.applicationId,
		makeName: names.make,
		modelName: names.model,
		generationName: names.generation,
		// Years only. This list answers "which cars is this for?", where a month would be
		// noise; the month matters where it decides a purchase, and that is the resolver.
		yearFrom: application.window.from.year,
		yearTo: application.window.to?.year ?? null,
		roofTypes: application.qualifiers.roofTypes ?? null,
		bodyTypes: application.qualifiers.bodyTypes ?? null,
		doors: application.qualifiers.doors ?? null,
		conditionCodes: application.conditions.map((c) => c.code),
		conditions: rowConditions(application, locale),
		// "The source accepted this row." Not "somebody checked the car" — nothing in the
		// catalogue is `cfm-verified` yet, and the list must not imply otherwise.
		accepted: ref?.qaStatus === "accepted",
	};
}

function conditionSortKey(row: ApplicationRow): string {
	return row.conditions.map((c) => c.text ?? c.code).join("|");
}

export async function listProductApplications(
	saleorProductId: string,
	options: {
		query?: string;
		offset?: number;
		limit?: number;
		/** The reading language: vehicles are named as CFM states them for it (`displayNames`). */
		language?: string;
		/** The full locale ("sk-SK"): the dataset states its condition texts per locale, not per language. */
		locale?: string;
	} = {},
): Promise<ApplicationPage> {
	const { dataset, status } = await loadFitmentDataset();
	if (!dataset) return { ...EMPTY_APPLICATION_PAGE, isFixture: status.isFixture };

	const generationById = new Map(dataset.generations.map((g) => [g.id, g]));
	const modelById = new Map(dataset.models.map((m) => [m.id, m]));
	const makeById = new Map(dataset.makes.map((m) => [m.id, m]));

	const rows: ApplicationRow[] = [];
	for (const application of collectApplicationsForProduct(dataset, saleorProductId)) {
		const generation = generationById.get(application.generationId);
		const model = generation ? modelById.get(generation.modelId) : undefined;
		const make = model ? makeById.get(model.makeId) : undefined;
		// A row whose vehicle cannot be named is dropped rather than shown as blanks —
		// an unlabelled row tells the shopper nothing and looks like a defect.
		if (!generation || !model || !make) continue;
		rows.push(
			toRow(
				application,
				{
					make: vehicleNodeName(make, options.language),
					model: vehicleNodeName(model, options.language),
					generation: vehicleNodeName(generation, options.language),
				},
				application.products.find((p) => p.saleorProductId === saleorProductId),
				options.locale,
			),
		);
	}

	const needle = options.query?.trim().toLowerCase();
	const filtered = needle
		? rows.filter((r) => `${r.makeName} ${r.modelName} ${r.generationName}`.toLowerCase().includes(needle))
		: rows;

	// Stable, human order: make, then model, then newest generation first.
	filtered.sort(
		(a, b) =>
			a.makeName.localeCompare(b.makeName) ||
			a.modelName.localeCompare(b.modelName) ||
			b.yearFrom - a.yearFrom ||
			// One car, several versions: they keep the order the source gave them, however many pages are asked for.
			conditionSortKey(a).localeCompare(conditionSortKey(b)),
	);

	const offset = Math.max(0, options.offset ?? 0);
	const limit = Math.min(Math.max(1, options.limit ?? APPLICATIONS_PAGE_SIZE), 100);
	const page = filtered.slice(offset, offset + limit);

	return {
		rows: page,
		total: filtered.length,
		hasMore: offset + page.length < filtered.length,
		unavailable: false,
		isFixture: status.isFixture,
	};
}
