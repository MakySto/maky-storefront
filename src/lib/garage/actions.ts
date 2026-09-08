"use server";

/**
 * Garage mutations.
 *
 * A server component render cannot write a cookie (`src/lib/auth/server.ts:35-37`), so
 * every change to the garage arrives here.
 *
 * The signature is NOT the validation. A signature proves this server wrote the value;
 * it says nothing about whether the ids inside still name a real vehicle, whether the
 * year falls inside the generation, or whether the shopper answered a qualifier the
 * generation actually varies in. All of that is re-checked here against the live
 * dataset, on every write, and a selection that fails is refused rather than stored —
 * a stored selection is later used to answer "does this fit?", and garbage in is a
 * wrong answer out.
 */

import { cookies } from "next/headers";

import { type VehicleSelection } from "@/lib/fitment/contract";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { resolveQualifier, resolveRoofAnswer, roofOptionsFor } from "./selection";
import { resolveGarageMode } from "./config";
import {
	encodeGarageCookie,
	fromVehicleSelection,
	GARAGE_COOKIE_MAX_AGE,
	GARAGE_COOKIE_NAME,
	GARAGE_MAX_VEHICLES,
	type GaragePayload,
	sameVehicle,
} from "./cookie";
import { readGaragePayload } from "./state";

export type GarageActionResult =
	| { ok: true; activeIndex: number; count: number }
	| { ok: false; error: GarageActionError };

export type GarageActionError =
	| "garage-disabled"
	| "provider-unavailable"
	| "unknown-vehicle"
	| "invalid-qualifier"
	| "year-out-of-range"
	| "limit-reached"
	| "not-found"
	| "write-failed";

/**
 * Cookie options.
 *
 * Deliberately not copied from either place the handoff points at:
 * `auth/server.ts` sets `httpOnly: false` because the auth SDK reads its tokens from
 * page JS — copying it would hand the garage payload to any script on the page. And
 * `proxy.ts` omits `secure` and `httpOnly` entirely. What is worth taking from them is
 * the union: an explicit path, a long Max-Age, and lax same-site.
 *
 * `secure` follows the storefront URL rather than being hardcoded, so local http dev
 * still works — a `Secure` cookie is silently dropped over plain http, which looks
 * exactly like "the feature is broken".
 */
function cookieOptions() {
	const isSecure = process.env.NEXT_PUBLIC_STOREFRONT_URL?.startsWith("https") ?? false;
	return {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: isSecure,
		path: "/",
		maxAge: GARAGE_COOKIE_MAX_AGE,
	};
}

async function writeGarage(payload: GaragePayload): Promise<boolean> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return false;
	const value = encodeGarageCookie(payload, mode.kind === "signed" ? mode.secret : null);
	try {
		(await cookies()).set(GARAGE_COOKIE_NAME, value, cookieOptions());
		return true;
	} catch {
		return false;
	}
}

/**
 * Re-check a selection against the dataset, and return it normalized.
 *
 * The qualifier rule is the subtle one, and it has two halves:
 *
 *   - A qualifier the generation VARIES in must be answered. Accepting a Golf without
 *     knowing whether it has a naked roof or fixpoints stores a car we cannot answer
 *     questions about, and the resolver would have to call it AMBIGUOUS forever.
 *   - `bodyType` and `doors` with exactly one possible value are filled in rather than
 *     asked. That is not guessing: they are properties of the generation the shopper has
 *     already chosen.
 *   - `roofType` is the exception, and it used to be handled by the rule above. It must
 *     never be filled in: our record of the roofs a generation came with describes what
 *     CFM mapped, not what is bolted to the shopper's car. See `selection.ts`.
 */
async function validateSelection(
	selection: VehicleSelection,
): Promise<{ ok: true; selection: VehicleSelection } | { ok: false; error: GarageActionError }> {
	const { dataset } = await loadFitmentDataset();
	if (!dataset) return { ok: false, error: "provider-unavailable" };

	const make = dataset.makes.find((m) => m.id === selection.makeId);
	const model = dataset.models.find((m) => m.id === selection.modelId);
	const generation = dataset.generations.find((g) => g.id === selection.generationId);

	if (!make || !model || !generation) return { ok: false, error: "unknown-vehicle" };
	if (model.makeId !== make.id || generation.modelId !== model.id) {
		return { ok: false, error: "unknown-vehicle" };
	}

	// Bounded by the generation's production window only because a car cannot be a model
	// year it was never built in. This is NOT the fitment year check — that lives in the
	// resolver, is narrower, and must not be widened by this one.
	const upper = generation.productionYearTo ?? new Date().getUTCFullYear() + 1;
	if (
		!Number.isInteger(selection.year) ||
		selection.year < generation.productionYearFrom ||
		selection.year > upper
	) {
		return { ok: false, error: "year-out-of-range" };
	}

	const q = generation.qualifiers;
	const normalized: VehicleSelection = {
		makeId: make.id,
		modelId: model.id,
		generationId: generation.id,
		year: selection.year,
	};

	// The roof is the one qualifier that is NEVER settled by having a single value.
	//
	// `resolveQualifier` below fills a single-valued qualifier in, which is right for a
	// property of the generation the shopper already chose — a generation sold only as an
	// estate IS an estate. It is wrong for the roof, and measurably so: with
	// `q.roofTypes = ["raised-rails"]` and no answer it returned "raised-rails", so a
	// vehicle was stored carrying a roof type nobody had confirmed, and every surface
	// downstream then reported a verified fit on it. That is not a missing question, it
	// is an answer we made up on the shopper's behalf, about the part that decides
	// whether the feet attach to their car at all.
	//
	// Unanswered now stores nothing. The resolver reports that it cannot confirm, which
	// is true, and the shopper is asked rather than told.
	// The SAME list the selector offered. Validating against the generation's list alone
	// would refuse a roof that only an application knows about — a roof the shopper was
	// shown and legitimately picked.
	const roof = resolveRoofAnswer(roofOptionsFor(dataset, generation), selection.roofType);
	if (roof === "invalid") return { ok: false, error: "invalid-qualifier" };
	if (roof !== undefined) normalized.roofType = roof;

	const body = resolveQualifier(q.bodyTypes, selection.bodyType);
	if (body === "invalid") return { ok: false, error: "invalid-qualifier" };
	if (body !== undefined) normalized.bodyType = body;

	const doors = resolveQualifier(q.doors, selection.doors);
	if (doors === "invalid") return { ok: false, error: "invalid-qualifier" };
	if (doors !== undefined) normalized.doors = doors;

	// The month of MANUFACTURE, when the shopper gave one. Optional by contract and it
	// must stay optional — not every supplier states months, and a window that gave only
	// a year cannot be narrowed by one. It was being dropped here, which made the whole
	// month step decorative: the shopper answered and nothing downstream ever saw it.
	if (selection.manufactureMonth !== undefined) {
		if (
			!Number.isInteger(selection.manufactureMonth) ||
			selection.manufactureMonth < 1 ||
			selection.manufactureMonth > 12
		) {
			return { ok: false, error: "invalid-qualifier" };
		}
		normalized.manufactureMonth = selection.manufactureMonth;
	}

	return { ok: true, selection: normalized };
}

/**
 * One qualifier: `"invalid"` to refuse, `undefined` to omit, or the value to store.
 * A generation that does not constrain the qualifier at all stores nothing for it.
 */
/**
 * Choose a vehicle to shop with: make it active WITHOUT adding it to the garage.
 *
 * Named `chooseVehicle`, not `useVehicle`: a `use*` export is read as a React hook by
 * `react-hooks/rules-of-hooks`, and this is a server action called from a callback.
 *
 * This is what "Potvrdiť vozidlo" calls, and the split is the whole point. Choosing a car
 * to shop with and keeping a car are different intentions; merging them meant every
 * selection wrote to the saved list, so a shopper trying a fourth car hit the
 * three-vehicle limit and was refused — they could not even look at it. Marek hit that,
 * and could not find the garage to clear it either.
 *
 * It therefore CANNOT fail on the limit: the limit governs how many cars are kept, and
 * this keeps none. Nothing is lost by not saving — `u` lives in the same year-long
 * cookie, so a one-car shopper's car is remembered across visits with no button pressed.
 *
 * Re-selecting a car that IS saved activates the saved copy instead of shadowing it, so
 * one car is never in two places.
 */
export async function chooseVehicle(selection: VehicleSelection): Promise<GarageActionResult> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { ok: false, error: "garage-disabled" };

	const validation = await validateSelection(selection);
	if (!validation.ok) return { ok: false, error: validation.error };

	const { payload } = await readGaragePayload();
	const stored = fromVehicleSelection(validation.selection);
	const existing = payload.c.findIndex((v) => sameVehicle(v, stored));

	const { dataset } = await loadFitmentDataset();
	const next: GaragePayload =
		existing >= 0
			? { v: payload.v, a: existing, c: payload.c, ...(dataset ? { dv: dataset.datasetVersion } : {}) }
			: {
					v: payload.v,
					a: payload.a,
					c: payload.c,
					u: stored,
					...(dataset ? { dv: dataset.datasetVersion } : {}),
				};

	if (!(await writeGarage(next))) return { ok: false, error: "write-failed" };
	return { ok: true, activeIndex: existing >= 0 ? existing : -1, count: payload.c.length };
}

/**
 * Keep the vehicle currently in use — the explicit half of the split above.
 *
 * Takes no argument on purpose: the car being saved is the one on screen, and passing a
 * selection from the client would let the two disagree. Failing on the limit is correct
 * here and only here, because this is the request to KEEP a car.
 */
export async function saveActiveVehicle(): Promise<GarageActionResult> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { ok: false, error: "garage-disabled" };

	const { payload } = await readGaragePayload();
	const stored = payload.u;
	// Already saved, or nothing in use: the shopper's intent is already satisfied.
	if (!stored) return { ok: true, activeIndex: payload.a, count: payload.c.length };

	const existing = payload.c.findIndex((v) => sameVehicle(v, stored));
	if (existing >= 0) {
		const next: GaragePayload = { ...payload, a: existing, u: undefined };
		delete next.u;
		if (!(await writeGarage(next))) return { ok: false, error: "write-failed" };
		return { ok: true, activeIndex: existing, count: payload.c.length };
	}

	if (payload.c.length >= GARAGE_MAX_VEHICLES) return { ok: false, error: "limit-reached" };

	const vehicles = [...payload.c, stored];
	const next: GaragePayload = {
		v: payload.v,
		a: vehicles.length - 1,
		c: vehicles,
		...(payload.dv ? { dv: payload.dv } : {}),
	};
	if (!(await writeGarage(next))) return { ok: false, error: "write-failed" };
	return { ok: true, activeIndex: vehicles.length - 1, count: vehicles.length };
}

export async function removeVehicle(index: number): Promise<GarageActionResult> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { ok: false, error: "garage-disabled" };

	const { payload } = await readGaragePayload();
	if (!Number.isInteger(index) || index < 0 || index >= payload.c.length) {
		return { ok: false, error: "not-found" };
	}

	const vehicles = payload.c.filter((_, i) => i !== index);
	// Keep pointing at the same car where possible; clamp rather than reset, so removing
	// the first of three does not silently change which car the shopper is shopping for.
	const activeIndex =
		vehicles.length === 0 ? 0 : Math.min(payload.a > index ? payload.a - 1 : payload.a, vehicles.length - 1);

	const next: GaragePayload = { ...payload, a: activeIndex, c: vehicles };
	if (!(await writeGarage(next))) return { ok: false, error: "write-failed" };
	return { ok: true, activeIndex, count: vehicles.length };
}

export async function setActiveVehicle(index: number): Promise<GarageActionResult> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { ok: false, error: "garage-disabled" };

	const { payload } = await readGaragePayload();
	if (!Number.isInteger(index) || index < 0 || index >= payload.c.length) {
		return { ok: false, error: "not-found" };
	}
	// Picking a saved car stops using the unsaved one — otherwise `u` would keep winning
	// in `readGarage` and the click would appear to do nothing.
	const next: GaragePayload = { ...payload, a: index };
	delete next.u;
	if (!(await writeGarage(next))) return { ok: false, error: "write-failed" };
	return { ok: true, activeIndex: index, count: payload.c.length };
}

export async function clearGarage(): Promise<GarageActionResult> {
	const mode = resolveGarageMode();
	if (mode.kind === "disabled") return { ok: false, error: "garage-disabled" };
	try {
		(await cookies()).delete(GARAGE_COOKIE_NAME);
	} catch {
		return { ok: false, error: "write-failed" };
	}
	return { ok: true, activeIndex: 0, count: 0 };
}

/*
 * Deliberately NO revalidatePath / revalidateTag here.
 *
 * Everything that depends on the active vehicle is read behind `await connection()` in
 * its own Suspense boundary, so it is uncached and re-runs on the next request anyway —
 * a server action already refreshes the current route's payload. The cached layer
 * (`getProductOutcomeCached`) is keyed on (slug, channel, locale) and carries no vehicle,
 * which is exactly right: one shopper picking a Kodiaq must never write anything into a
 * cache entry another shopper reads.
 */
