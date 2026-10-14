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

import { type FitmentDataset, type VehicleSelection, vehicleNodeName } from "@/lib/fitment/contract";
import { resolveGarageMode } from "./config";
import {
	decodeGarageCookie,
	EMPTY_GARAGE,
	GARAGE_COOKIE_NAME,
	type GaragePayload,
	type StoredVehicle,
	toVehicleSelection,
} from "./cookie";
import { canonicalGarage, type VehicleChoice } from "./retired";

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
	/**
	 * Set when the car's generation was merged or dissolved by CFM and its year does not settle
	 * which of the generations that remain is the shopper's. `unresolved` is true as well, so every
	 * surface that treats an unresolved car as "no car" keeps doing so; the garage uses this to offer
	 * the choice instead of "select again". Make and model are named; the generation is not.
	 */
	choose?: { makeId: string; modelId: string; candidates: GenerationOption[] };
};

export type GenerationOption = {
	id: string;
	name: string;
	productionYearFrom: number;
	productionYearTo: number | null;
};

export type GarageState = {
	status: GarageStatus;
	/** The SAVED vehicles. The car in use is not in here unless it was saved. */
	vehicles: ResolvedVehicle[];
	/** Index into `vehicles`, or -1 when the active car is in use but not saved. */
	activeIndex: number;
	active: ResolvedVehicle | null;
	/**
	 * Is the active car one of the saved ones?
	 *
	 * `false` means the shopper is using a car they have not asked to keep, which is the
	 * normal state after picking one: the garage offers to save it, and nothing else
	 * changes. Every other surface treats the active car identically either way.
	 */
	activeIsSaved: boolean;
	/** True when the payload was readable but had to be repaired. */
	repaired: boolean;
	signed: boolean;
};

export const EMPTY_GARAGE_STATE: GarageState = {
	status: "absent",
	vehicles: [],
	activeIndex: 0,
	active: null,
	activeIsSaved: false,
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

function labelsFor(dataset: FitmentDataset | null, vehicle: StoredVehicle, language?: string | null) {
	if (!dataset) {
		return { makeName: null, modelName: null, generationName: null, unresolved: true };
	}
	const make = dataset.makes.find((m) => m.id === vehicle.k) ?? null;
	const model = dataset.models.find((m) => m.id === vehicle.m) ?? null;
	const generation = dataset.generations.find((g) => g.id === vehicle.g) ?? null;
	return {
		// The name CFM states for the reader's language, the dataset's own `name` otherwise.
		// Resolved here, at render time, from the dataset — the cookie only ever held ids.
		makeName: make ? vehicleNodeName(make, language) : null,
		modelName: model ? vehicleNodeName(model, language) : null,
		generationName: generation ? vehicleNodeName(generation, language) : null,
		unresolved: make === null || model === null || generation === null,
	};
}

function resolveOne(
	dataset: FitmentDataset | null,
	stored: StoredVehicle,
	choice: VehicleChoice | undefined,
	language?: string | null,
): ResolvedVehicle {
	if (!dataset || !choice) {
		return { stored, selection: toVehicleSelection(stored), ...labelsFor(dataset, stored, language) };
	}
	const options = choice.candidates
		.map((id) => dataset.generations.find((g) => g.id === id))
		.filter((g): g is FitmentDataset["generations"][number] => g !== undefined)
		.map((g) => ({
			id: g.id,
			name: vehicleNodeName(g, language),
			productionYearFrom: g.productionYearFrom,
			productionYearTo: g.productionYearTo,
		}));
	return {
		stored,
		selection: toVehicleSelection(stored),
		// The make and the model are known (the candidates are one model); the generation is the
		// open question, so it is not named and the car stays unresolved.
		...labelsFor(dataset, choice.vehicle, language),
		generationName: null,
		unresolved: true,
		choose: { makeId: choice.vehicle.k, modelId: choice.vehicle.m, candidates: options },
	};
}

/**
 * The payload as the dataset in hand reads it: cars whose generation CFM merged moved to the one
 * that remained, cars that became one collapsed. The garage actions work on THIS payload, so an
 * index the page showed means the same car to the action it triggers, and the first write heals
 * the cookie.
 */
export async function readCanonicalGaragePayload(dataset: FitmentDataset | null) {
	const read = await readGaragePayload();
	return { ...read, payload: canonicalGarage(read.payload, dataset).payload };
}

/**
 * The garage, resolved against the current dataset.
 *
 * `dataset === null` (provider disabled or unreachable) still returns the saved
 * vehicles: the shopper's own cars do not disappear because CFM is down. They are marked
 * `unresolved`, so no surface can print a name it does not have or claim a fit.
 */
export async function readGarage(
	dataset: FitmentDataset | null,
	language?: string | null,
): Promise<GarageState> {
	const { payload: stored, status, signed } = await readGaragePayload();
	if (status === "disabled") return { ...EMPTY_GARAGE_STATE, status: "disabled" };

	// A car CFM has since merged into another is read as the other one (`retired.ts`), here and in the
	// garage actions alike. Without a dataset nothing can be explained and the cookie reads as it is.
	const canonical = canonicalGarage(stored, dataset);
	const payload = canonical.payload;

	const vehicles: ResolvedVehicle[] = payload.c.map((vehicle, index) =>
		resolveOne(dataset, vehicle, canonical.choices.get(index), language),
	);

	// The car in use but not saved. `normalizePayload` guarantees it is not also in `c`,
	// so exactly one of these two branches produces the active vehicle.
	const inUse: ResolvedVehicle | null = payload.u
		? resolveOne(dataset, payload.u, canonical.inUseChoice ?? undefined, language)
		: null;

	const savedIndex = vehicles.length === 0 ? 0 : Math.min(payload.a, vehicles.length - 1);
	const activeIndex = inUse ? -1 : savedIndex;
	const active = inUse ?? vehicles[savedIndex] ?? null;

	return {
		// A shopper using a car has a garage worth reading even with nothing saved in it,
		// so "absent" now means no active car AND no saved car — not merely an empty list.
		status: vehicles.length === 0 && !inUse && status === "ok" ? "absent" : status,
		vehicles,
		activeIndex,
		active,
		activeIsSaved: active !== null && inUse === null,
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
export async function readActiveSelection(
	dataset: FitmentDataset | null,
	language?: string | null,
): Promise<VehicleSelection | null> {
	const garage = await readGarage(dataset, language);
	if (!garage.active || garage.active.unresolved) return null;
	return garage.active.selection;
}
