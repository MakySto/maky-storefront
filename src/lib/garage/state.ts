import "server-only";

/**
 * Reading the garage on the server.
 *
 * Every read is guarded with try/catch around `cookies()`, matching the established
 * house pattern (`src/lib/checkout.ts:25`, `user-menu-container.tsx:11`). Under
 * cacheComponents a cookie read inside a prerendered scope throws, and the correct
 * behaviour for the garage is unambiguous: an empty garage. A shopper who has saved no
 * car and a page rendering before any request exists should look identical.
 *
 * Callers rendering inside a PRERENDERED shell — the header nav row, a layout — must
 * still put this behind their own `await connection()` in their own Suspense boundary.
 * The guard here stops a crash; it does not make a static shell dynamic, and relying on
 * an incidental cookie read to do that is the exact mistake
 * `odstupenie-od-zmluvy/page.tsx:36-39` warns about.
 */

import { cookies } from "next/headers";

import { type FitmentDataset, type VehicleSelection } from "@/lib/fitment/contract";
import { resolveGarageMode } from "./config";
import {
	decodeGarageCookie,
	EMPTY_GARAGE,
	GARAGE_COOKIE_NAME,
	type GaragePayload,
	type StoredVehicle,
	toVehicleSelection,
} from "./cookie";

export type GarageStatus = "ok" | "disabled" | "absent" | "recovered";

export type ResolvedVehicle = {
	stored: StoredVehicle;
	selection: VehicleSelection;
	/** Human labels, resolved from the dataset at render time — never from the cookie. */
	makeName: string | null;
	modelName: string | null;
	generationName: string | null;
	/**
	 * True when the stored ids no longer exist in the current dataset. The vehicle is
	 * kept and shown, flagged, so the shopper can re-pick it — it is not silently
	 * dropped, and it is never matched to a near-miss.
	 */
	unresolved: boolean;
};

export type GarageState = {
	status: GarageStatus;
	vehicles: ResolvedVehicle[];
	activeIndex: number;
	active: ResolvedVehicle | null;
	/** True when the payload was readable but had to be repaired. */
	repaired: boolean;
	signed: boolean;
};

export const EMPTY_GARAGE_STATE: GarageState = {
	status: "absent",
	vehicles: [],
	activeIndex: 0,
	active: null,
	repaired: false,
	signed: false,
};

/** Raw payload read. Never throws. */
export async function readGaragePayload(): Promise<{
	payload: GaragePayload;
	status: GarageStatus;
	signed: boolean;
}> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { payload: EMPTY_GARAGE, status: "disabled", signed: false };

	let raw: string | undefined;
	try {
		raw = (await cookies()).get(GARAGE_COOKIE_NAME)?.value;
	} catch {
		// Prerendered scope, or a read-only context. An empty garage is the right answer.
		return { payload: EMPTY_GARAGE, status: "absent", signed: false };
	}

	const decoded = decodeGarageCookie(raw, {
		secret: mode.kind === "signed" ? mode.secret : null,
		requireSignature: mode.kind === "signed",
	});

	if (!decoded.ok) {
		// A tampered, truncated or stale-format cookie is not an error condition for the
		// shopper: they simply have no saved cars. Never a 500, never a thrown render.
		return {
			payload: EMPTY_GARAGE,
			status: decoded.reason === "absent" ? "absent" : "recovered",
			signed: false,
		};
	}

	return { payload: decoded.payload, status: "ok", signed: decoded.signed };
}

function labelsFor(dataset: FitmentDataset | null, vehicle: StoredVehicle) {
	if (!dataset) {
		return { makeName: null, modelName: null, generationName: null, unresolved: true };
	}
	const make = dataset.makes.find((m) => m.id === vehicle.k) ?? null;
	const model = dataset.models.find((m) => m.id === vehicle.m) ?? null;
	const generation = dataset.generations.find((g) => g.id === vehicle.g) ?? null;
	return {
		makeName: make?.name ?? null,
		modelName: model?.name ?? null,
		generationName: generation?.name ?? null,
		unresolved: make === null || model === null || generation === null,
	};
}

/**
 * The garage, resolved against the current dataset.
 *
 * `dataset === null` (provider disabled or unreachable) still returns the saved
 * vehicles: the shopper's own cars do not disappear because CFM is down. They are marked
 * `unresolved`, so no surface can print a name it does not have or claim a fit.
 */
export async function readGarage(dataset: FitmentDataset | null): Promise<GarageState> {
	const { payload, status, signed } = await readGaragePayload();
	if (status === "disabled") return { ...EMPTY_GARAGE_STATE, status: "disabled" };

	const vehicles: ResolvedVehicle[] = payload.c.map((stored) => ({
		stored,
		selection: toVehicleSelection(stored),
		...labelsFor(dataset, stored),
	}));

	const activeIndex = vehicles.length === 0 ? 0 : Math.min(payload.a, vehicles.length - 1);

	return {
		status: vehicles.length === 0 && status === "ok" ? "absent" : status,
		vehicles,
		activeIndex,
		active: vehicles[activeIndex] ?? null,
		repaired: status === "recovered",
		signed,
	};
}

/**
 * The active vehicle as a selection, or null.
 *
 * An `unresolved` vehicle returns null: its ids mean nothing to the current dataset, so
 * feeding it to the resolver could only produce a coincidence, and a coincidence
 * presented as a fit is the one outcome this feature must never produce.
 */
export async function readActiveSelection(dataset: FitmentDataset | null): Promise<VehicleSelection | null> {
	const garage = await readGarage(dataset);
	if (!garage.active || garage.active.unresolved) return null;
	return garage.active.selection;
}
