/**
 * What an offer is MADE FOR — a different question from whether it fits the shopper's car.
 *
 * Pure: no I/O, no translation. The PDP box and the cart lines render from it.
 *
 * ## Why this exists (owner, 2026-09-27)
 *
 * The Nordrive set for the Audi A4 Avant B8, opened with a Passat Variant B9 in the Garage,
 * showed a large amber box: "Kompatibilitu zatiaľ nevieme potvrdiť … Neznamená to, že produkt
 * nepasuje". Every word of it was true and none of it helped. The product IS documented — for
 * the Audi — and the shopper's question is "what is this for, and where is the one for my car".
 *
 * The resolver cannot say that: it looks up the Garage car's generation first and only then the
 * product, so an offer made for another car arrives as UNKNOWN / `absent-under-partial-coverage`,
 * with the offer's own applications nowhere in the result. This module reads them back.
 *
 * ## What it must never become
 *
 * A refusal. Absence of a row for the Passat is not evidence that the Audi set does not fit it:
 * CFM declares no make complete (`coverage.completeForMakeIds` is empty), and the same Nordrive
 * part N15060 is documented for BOTH cars as two separate offers (products 858 and 9168 in the
 * 2026-09-15 export; the code appears in 159 products). So the shopper is told what the offer is
 * for and where the offer for their car is — never "nepasuje". Only an explicit negative row, or
 * complete coverage, may say that, and those stay with the resolver.
 *
 * It replaces only the two answers that said nothing: "we have no row for your car" and "you have
 * not chosen a car". A conflict, a hold, an unanswered roof, a boundary month, stale data and an
 * outage keep their own box — each of them is a statement the shopper needs.
 */

import {
	type BodyType,
	type FitmentApplication,
	type FitmentDataset,
	type FitmentResult,
	type FitmentWindow,
	type RoofType,
} from "./contract";
import { ABSENT_UNDER_PARTIAL_COVERAGE, isDatasetStale } from "./resolve";

export { ABSENT_UNDER_PARTIAL_COVERAGE };

export interface IntendedVehicle {
	readonly applicationId: string;
	readonly generationId: string;
	/**
	 * "AUDI A4 Avant B8" — the dataset's own names, joined the way the header and the Garage
	 * join the saved car (`vehicleDisplayName`), so the two cars on one screen are named alike.
	 */
	readonly name: string;
	readonly window: FitmentWindow;
	readonly roofTypes: readonly RoofType[];
	readonly bodyTypes: readonly BodyType[];
}

type Names = {
	readonly generation: ReadonlyMap<string, { readonly name: string; readonly modelId: string }>;
	readonly model: ReadonlyMap<string, { readonly name: string; readonly makeId: string }>;
	readonly make: ReadonlyMap<string, string>;
};

const NAMES = new WeakMap<FitmentDataset, Names>();

function namesOf(dataset: FitmentDataset): Names {
	let names = NAMES.get(dataset);
	if (!names) {
		names = {
			generation: new Map(dataset.generations.map((g) => [g.id, { name: g.name, modelId: g.modelId }])),
			model: new Map(dataset.models.map((m) => [m.id, { name: m.name, makeId: m.makeId }])),
			make: new Map(dataset.makes.map((m) => [m.id, m.name])),
		};
		NAMES.set(dataset, names);
	}
	return names;
}

function vehicleName(names: Names, generationId: string): string | null {
	const generation = names.generation.get(generationId);
	const model = generation ? names.model.get(generation.modelId) : undefined;
	const make = model ? names.make.get(model.makeId) : undefined;
	// A generation the tree cannot name is not named at all — never by its id.
	if (!generation || !model || !make) return null;
	return [make, model.name, generation.name].filter((part) => part.trim()).join(" ");
}

/**
 * The vehicles this exact offer is documented for: positive rows the source accepts AND will sell
 * against, for this product and — when given — this variant. A held, disputed or unsellable row
 * describes nothing a shopper may rely on, so it is not listed; the resolver's own box speaks
 * for those.
 *
 * Nothing from a dataset past `validUntil` or older than `staleAfterDays` — the resolver's own
 * freshness rule. It matters most with no car saved: the resolver answers NO_VEHICLE_SELECTED
 * BEFORE it looks at freshness, so without this an expired dataset would still name the car an
 * offer is for (Codex review of c5bc471, 2026-09-27). Expired data says only what it said before.
 */
export function intendedVehiclesFor(
	dataset: FitmentDataset | null,
	saleorProductId: string,
	saleorVariantId?: string,
	now: number = Date.now(),
): IntendedVehicle[] {
	if (!dataset || isDatasetStale(dataset, now)) return [];
	const names = namesOf(dataset);
	const out: IntendedVehicle[] = [];
	for (const application of dataset.applications) {
		if (application.negative) continue;
		const ref = application.products.find(
			(p) =>
				p.saleorProductId === saleorProductId &&
				(saleorVariantId === undefined || p.saleorVariantId === saleorVariantId),
		);
		if (!ref || ref.qaStatus !== "accepted" || !ref.eligibility.sellable) continue;
		const name = vehicleName(names, application.generationId);
		if (!name) continue;
		out.push(intended(application, name));
	}
	return out;
}

function intended(application: FitmentApplication, name: string): IntendedVehicle {
	return {
		applicationId: application.applicationId,
		generationId: application.generationId,
		name,
		window: application.window,
		roofTypes: application.qualifiers.roofTypes ?? [],
		bodyTypes: application.qualifiers.bodyTypes ?? [],
	};
}

/**
 * The window as the source knows it: "05/2008" where the month is known, "2008" where only the
 * year is, and `to: null` for a window still open. Never a month the source did not give.
 */
export function windowBounds(window: FitmentWindow): { from: string; to: string | null } {
	const point = (year: number, month: number | undefined, precise: boolean) =>
		precise && month ? `${String(month).padStart(2, "0")}/${year}` : String(year);
	return {
		from: point(window.from.year, window.from.month, window.startPrecision === "month"),
		to:
			window.to === null || window.endPrecision === "open"
				? null
				: point(window.to.year, window.to.month, window.endPrecision === "month"),
	};
}

export type FitmentPresentation =
	| { readonly kind: "verdict" }
	| { readonly kind: "intended-for"; readonly vehicles: readonly IntendedVehicle[] };

/**
 * Which of the two a surface shows for one offer.
 *
 * - A fit, a documented misfit, a question (roof, month), a dispute, stale data, an outage: the
 *   verdict, unchanged.
 * - No row for the saved car while no make is complete: what the offer is for, and the way to the
 *   offers for the saved car.
 * - No car saved: what the offer is for, with the way to check one's own car — not a generic
 *   "Vyberte vozidlo" in front of a fact the page already has.
 *
 * With nothing documented to name, the verdict stays: an empty "Určené pre" is not an answer.
 */
export function presentFitment(
	result: FitmentResult,
	intended: readonly IntendedVehicle[],
): FitmentPresentation {
	if (intended.length === 0) return { kind: "verdict" };
	if (result.verdict === "NO_VEHICLE_SELECTED") return { kind: "intended-for", vehicles: intended };
	if (result.verdict === "UNKNOWN" && result.reason === ABSENT_UNDER_PARTIAL_COVERAGE) {
		return { kind: "intended-for", vehicles: intended };
	}
	return { kind: "verdict" };
}
