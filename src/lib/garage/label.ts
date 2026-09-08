/**
 * One place that turns a resolved garage vehicle into the string a shopper reads.
 *
 * The header, the configurator's summary and the garage list all print the same car.
 * Three inline `[make, model, generation].join(" ")` expressions are three chances for
 * them to drift, and a header saying "Škoda Octavia" above a garage saying
 * "Škoda Octavia IV (NX)" is the same shopper being told two things about one car.
 *
 * An unresolved vehicle returns null rather than a partial name: its ids mean nothing to
 * the current dataset, so any name assembled from them would be a guess.
 */

import { type RoofType } from "@/lib/fitment/contract";

export type VehicleNameParts = {
	makeName: string | null;
	modelName: string | null;
	generationName: string | null;
	unresolved: boolean;
};

/** Identity plus the two things that change the answer: the year and the roof. */
export type VehicleSpec = VehicleNameParts & {
	year?: number | null;
	roofType?: RoofType | null;
	/** Only ever set when the shopper actually stated it. */
	manufactureMonth?: number | null;
};

/** The separator between a vehicle's parts. One place, so six surfaces cannot drift. */
const SEPARATOR = " · ";

export function vehicleDisplayName(vehicle: VehicleNameParts | null | undefined): string | null {
	if (!vehicle || vehicle.unresolved) return null;
	const label = [vehicle.makeName, vehicle.modelName, vehicle.generationName]
		.filter((part): part is string => Boolean(part && part.trim()))
		.join(" ");
	return label.length > 0 ? label : null;
}

/**
 * The short form: identity and year — "ŠKODA Octavia Combi NX · 2024".
 *
 * The year belongs in the SHORT form, not the long one, because it is not decoration: a
 * 2018 Octavia and a 2024 Octavia are different generations with different roofs, and a
 * header naming only "ŠKODA Octavia Combi" gives the shopper no way to notice that the
 * results on screen are for the other one. The identity alone was what every surface
 * printed before.
 *
 * Falls back to the bare identity when no year is known rather than printing a dangling
 * separator.
 */
export function vehicleShortLabel(vehicle: VehicleSpec | null | undefined): string | null {
	const identity = vehicleDisplayName(vehicle);
	if (!identity) return null;
	const year = vehicle?.year;
	return typeof year === "number" && Number.isFinite(year) ? `${identity}${SEPARATOR}${year}` : identity;
}

/**
 * The pieces of the second line, for a caller that can translate them.
 *
 * It returns data rather than a sentence because the roof label and the month name are
 * localised, and `src/lib` must not reach into the UI layer to translate. Every surface
 * therefore renders the same FACTS with its own translator, which is the drift this
 * module exists to stop.
 *
 * `roofConfirmed: false` is a real state and must be shown as one — "Typ strechy
 * nepotvrdený" with a way to fix it. It must never be filled in with a guess: the roof
 * decides which feet fit, and substituting the common one is precisely the error the
 * selector's "Iný typ" and "Neviem rozpoznať" answers exist to prevent.
 *
 * The month appears only when the shopper stated it. An absent month is not "January".
 */
export function vehicleDetailParts(vehicle: VehicleSpec | null | undefined): {
	roofType: RoofType | null;
	roofConfirmed: boolean;
	month: number | null;
} {
	const roofType = vehicle?.roofType ?? null;
	const month = vehicle?.manufactureMonth;
	return {
		roofType,
		roofConfirmed: roofType !== null,
		month: typeof month === "number" && month >= 1 && month <= 12 ? month : null,
	};
}

/** Join already-translated detail pieces with the shared separator, dropping the empty ones. */
export function joinVehicleDetail(parts: readonly (string | null | undefined)[]): string {
	return parts.filter((part): part is string => Boolean(part && part.trim())).join(SEPARATOR);
}
