import "server-only";

import { readGaragePayload } from "@/lib/garage/state";
import type { StoredVehicle } from "@/lib/garage/cookie";

/**
 * Which car the shopper is shopping for, as far as their tyres are concerned.
 *
 * A tyre size belongs to a car (`memory.ts`), so the memory is keyed by this. It is the car's identity in the dataset,
 * its make, model, generation and application year; the qualifiers that decide roof fit (roof type, body, doors) say
 * nothing about wheels and are left out, so the same car with a roof rail confirmed later is still the same car.
 */
export const tyreVehicleKeyOf = (vehicle: Pick<StoredVehicle, "k" | "m" | "g" | "y">): string =>
	`${vehicle.k}|${vehicle.m}|${vehicle.g}|${vehicle.y}`;

/** The key of the car in use, or `null` when none is (or the garage is switched off). Never throws. */
export async function readActiveVehicleKey(): Promise<string | null> {
	try {
		const { payload } = await readGaragePayload();
		const active = payload.u ?? payload.c[payload.a] ?? null;
		return active ? tyreVehicleKeyOf(active) : null;
	} catch {
		return null;
	}
}
