/**
 * A saved car whose generation CFM has since merged: where it goes, and what is asked.
 *
 * The garage cookie holds public ids only (`cookie.ts`), so a merge leaves old ids in browsers we
 * cannot reach. This module is the one place that decides what such a car becomes, and the garage
 * reads (`state.ts`) and writes (`actions.ts`) both go through it, so the header, the garage, the
 * configurator, the product page and the cart can never disagree about which car the shopper has.
 *
 * ## The rules
 *
 *   - A generation that was MERGED into another moves there. The shopper is not asked: it is the
 *     same car, filed under the row that remained.
 *   - A summary LABEL that was dissolved is settled by the car's year when the year falls inside
 *     exactly one candidate's production window, and by the shopper otherwise. Never by a name.
 *   - The model and the make come from the generation that remained, not from the cookie.
 *   - Qualifiers (roof, body, doors) are kept only where the generation that remained still offers
 *     them. A roof is never filled in (`selection.ts`); a body or door count the new generation
 *     settles by having one value is filled in, as the selector does.
 *   - A year the remaining generation was never built in is not carried over: the shopper is asked.
 *   - Compatibility is not carried at all. It is never stored (`cookie.ts`); the resolver answers
 *     it against the current dataset, for the car this returns, as for any other.
 *
 * Nothing here guesses. When it cannot settle a car it says so (`choose`, `gone`), and the car is
 * kept and shown, flagged, exactly as an id the dataset never knew has always been.
 *
 * PURE: no I/O.
 */

import {
	type FitmentDataset,
	type RoofType,
	type VehicleGeneration,
	type BodyType,
} from "@/lib/fitment/contract";
import { generationFate, modelFate } from "@/lib/fitment/retired-ids";
import { type GaragePayload, sameVehicle, type StoredVehicle } from "./cookie";
import { roofOptionsFor } from "./selection";

export type StoredVehicleUpgrade =
	/** Every id is live: nothing to do. */
	| { kind: "unchanged" }
	/** Moved to the generation that remained. `vehicle` is the car to use from now on. */
	| { kind: "moved"; vehicle: StoredVehicle }
	/**
	 * Cannot be settled without the shopper. `vehicle` keeps the retired generation id (so the
	 * cookie is not rewritten into a guess) with make and model brought up to date;
	 * `candidates` are the live generations to choose between.
	 */
	| { kind: "choose"; vehicle: StoredVehicle; candidates: readonly string[] }
	/** The dataset neither holds the car nor explains it. */
	| { kind: "gone" };

type Subject = Pick<
	FitmentDataset,
	"makes" | "models" | "generations" | "applications" | "retiredVehicleIds"
>;

function openEnd(now: Date): number {
	return now.getUTCFullYear() + 1;
}

function builtIn(generation: VehicleGeneration, year: number, now: Date): boolean {
	return year >= generation.productionYearFrom && year <= (generation.productionYearTo ?? openEnd(now));
}

/** The qualifier the new generation still has room for; `undefined` is "not asked / not known". */
function keepOnly<T>(available: readonly T[] | undefined, held: T | undefined): T | undefined {
	if (!available || available.length === 0) return undefined;
	if (available.length === 1) return available[0];
	return held !== undefined && available.includes(held) ? held : undefined;
}

/**
 * The car on `generation`, carrying over what that generation still stands behind.
 * `null` when the year was never a year of this generation.
 */
function onGeneration(
	dataset: Subject,
	generation: VehicleGeneration,
	vehicle: StoredVehicle,
	now: Date,
): StoredVehicle | null {
	if (!builtIn(generation, vehicle.y, now)) return null;
	const model = dataset.models.find((m) => m.id === generation.modelId);
	if (!model) return null;

	const roofs: RoofType[] = roofOptionsFor(dataset, generation);
	// A roof is kept only if the shopper gave it AND it is still on offer. It is not filled in when
	// there is one: what is bolted to their car is their fact, not our catalogue's.
	const roof = vehicle.r !== undefined && roofs.includes(vehicle.r) ? vehicle.r : undefined;
	const body = keepOnly<BodyType>(generation.qualifiers.bodyTypes, vehicle.b);
	const doors = keepOnly<number>(generation.qualifiers.doors, vehicle.d);

	return {
		k: model.makeId,
		m: model.id,
		g: generation.id,
		y: vehicle.y,
		...(roof ? { r: roof } : {}),
		...(body ? { b: body } : {}),
		...(doors !== undefined ? { d: doors } : {}),
		...(vehicle.mo !== undefined ? { mo: vehicle.mo } : {}),
	};
}

export function upgradeStoredVehicle(
	dataset: Subject,
	vehicle: StoredVehicle,
	now: Date = new Date(),
): StoredVehicleUpgrade {
	const fate = generationFate(dataset, vehicle.g);
	const generationById = (id: string) => dataset.generations.find((g) => g.id === id);

	if (fate.kind === "live") {
		// The generation is the authority for its model and make. A cookie that names a model CFM
		// merged away beside a generation that did not move is repaired from the generation; a cookie
		// whose model is live but not this generation's is left exactly as it was.
		const generation = generationById(vehicle.g)!;
		const model = dataset.models.find((m) => m.id === generation.modelId);
		const modelWas = modelFate(dataset, vehicle.m);
		if (!model || modelWas.kind !== "moved" || modelWas.to !== model.id) return { kind: "unchanged" };
		return { kind: "moved", vehicle: { ...vehicle, k: model.makeId, m: model.id } };
	}

	if (fate.kind === "moved") {
		const generation = generationById(fate.to);
		if (!generation) return { kind: "gone" };
		const moved = onGeneration(dataset, generation, vehicle, now);
		if (moved) return { kind: "moved", vehicle: moved };
		return chooseAmong(dataset, vehicle, [fate.to]);
	}

	if (fate.kind === "split") {
		const candidates = fate.candidates
			.map(generationById)
			.filter((g): g is VehicleGeneration => g !== undefined);
		const byYear = candidates.filter((g) => builtIn(g, vehicle.y, now));
		if (byYear.length === 1) {
			const moved = onGeneration(dataset, byYear[0]!, vehicle, now);
			if (moved) return { kind: "moved", vehicle: moved };
		}
		// The year names two of them, or none: the shopper knows which car they have.
		return chooseAmong(
			dataset,
			vehicle,
			(byYear.length >= 2 ? byYear : candidates).map((g) => g.id),
		);
	}

	return { kind: "gone" };
}

function chooseAmong(dataset: Subject, vehicle: StoredVehicle, candidates: string[]): StoredVehicleUpgrade {
	const first = dataset.generations.find((g) => g.id === candidates[0]);
	const model = first ? dataset.models.find((m) => m.id === first.modelId) : undefined;
	if (!first || !model) return { kind: "gone" };
	return {
		kind: "choose",
		// Make and model come from the candidates (they are one model); the generation stays the
		// retired id on purpose, so nothing is written that the shopper did not choose.
		vehicle: { ...vehicle, k: model.makeId, m: model.id },
		candidates,
	};
}

/** A car that needs the shopper: the live generations to choose between, and its make and model brought up to date. */
export type VehicleChoice = { readonly vehicle: StoredVehicle; readonly candidates: readonly string[] };

export type CanonicalGarage = {
	payload: GaragePayload;
	/** The saved cars that need a choice, by their index in `payload.c`. */
	choices: ReadonlyMap<number, VehicleChoice>;
	/** The same for the car in use (`payload.u`). */
	inUseChoice: VehicleChoice | null;
	changed: boolean;
};

/**
 * The whole garage, brought up to the dataset in hand.
 *
 * Moved cars are rewritten, and cars that became the same car are collapsed into one (the first
 * place wins, and the active car stays the same car). Cars that need a choice, and cars the
 * dataset does not know, stay as stored.
 */
export function canonicalGarage(
	payload: GaragePayload,
	dataset: Subject | null,
	now: Date = new Date(),
): CanonicalGarage {
	if (!dataset) return { payload, choices: new Map(), inUseChoice: null, changed: false };

	let changed = false;
	const choices = new Map<number, VehicleChoice>();
	const rewritten: StoredVehicle[] = [];
	const indexMap = new Map<number, number>();

	payload.c.forEach((stored, index) => {
		const up = upgradeStoredVehicle(dataset, stored, now);
		let next = stored;
		if (up.kind === "moved") {
			next = up.vehicle;
			changed = true;
		}
		const duplicate = rewritten.findIndex((v) => sameVehicle(v, next));
		if (duplicate >= 0) {
			indexMap.set(index, duplicate);
			changed = true;
			return;
		}
		rewritten.push(next);
		indexMap.set(index, rewritten.length - 1);
		if (up.kind === "choose") choices.set(rewritten.length - 1, up);
	});

	let inUse = payload.u;
	let inUseChoice: VehicleChoice | null = null;
	if (inUse) {
		const up = upgradeStoredVehicle(dataset, inUse, now);
		if (up.kind === "moved") {
			inUse = up.vehicle;
			changed = true;
		} else if (up.kind === "choose") {
			inUseChoice = up;
		}
	}

	// `u` that became one of the saved cars collapses onto it, as `normalizePayload` does.
	const savedIndex = inUse ? rewritten.findIndex((v) => sameVehicle(v, inUse!)) : -1;
	const active =
		rewritten.length === 0
			? 0
			: savedIndex >= 0
				? savedIndex
				: Math.min(indexMap.get(payload.a) ?? 0, rewritten.length - 1);

	if (!changed) return { payload, choices, inUseChoice, changed: false };

	const { u: _dropped, ...rest } = payload;
	return {
		payload: {
			...rest,
			a: active,
			c: rewritten,
			...(inUse && savedIndex === -1 ? { u: inUse } : {}),
		},
		choices,
		inUseChoice,
		changed: true,
	};
}
