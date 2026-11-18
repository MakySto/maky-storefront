import { type StoredVehicle } from "@/lib/garage/cookie";
import { type Draft } from "./vehicle-selector-sheet";

/**
 * The selector's starting point for the car already in use: everything the shopper has said about it,
 * so that opening the window to answer ONE missing question (a glass roof asked after the car was
 * saved) does not make them pick the make and the model again.
 *
 * Only stated answers are carried. A roof, a body or a glass-roof answer the cookie does not hold is
 * left open, and the window asks it: a default here would be a fit nobody confirmed.
 */
export function draftFromVehicle(vehicle: {
	stored: StoredVehicle;
	makeName: string | null;
	modelName: string | null;
}): Draft {
	const { stored } = vehicle;
	return {
		makeId: stored.k,
		...(vehicle.makeName ? { makeName: vehicle.makeName } : {}),
		modelId: stored.m,
		...(vehicle.modelName ? { modelName: vehicle.modelName } : {}),
		year: stored.y,
		generationId: stored.g,
		...(stored.r ? { roofAnswer: { kind: "confirmed", roofType: stored.r } as const } : {}),
		...(stored.b ? { bodyType: stored.b } : {}),
		...(stored.d !== undefined ? { doors: stored.d } : {}),
		...(stored.gr ? { glassRoofAnswer: { kind: "value", value: stored.gr } as const } : {}),
		...(stored.rh ? { roofHeightAnswer: { kind: "value", value: stored.rh } as const } : {}),
	};
}
