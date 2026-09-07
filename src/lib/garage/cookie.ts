/**
 * The garage cookie — codec only. No I/O, no next/headers, so it is unit-testable and
 * safe to import from anywhere.
 *
 * Wire format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 *
 * base64url rather than raw JSON is a measured decision, not taste. Next percent-encodes
 * cookie VALUES on write and decodes them on read, so a raw JSON value pays for every
 * brace, quote and comma twice over on the wire. base64url's alphabet is untouched by
 * that encoding, so it costs nothing. It also sidesteps a sharper edge: Next's cookie
 * parser wraps `decodeURIComponent` in a try/catch with an EMPTY body, so a value
 * containing a stray `%` is dropped from the map silently — no error, no cookie, no
 * clue. A value that cannot contain `%` cannot hit that path.
 *
 * The name is `maky-garage`: the `maky-` family (see `maky-market`), and deliberately
 * NOT anything beginning `checkoutId-`, which `src/lib/checkout.ts` matches by PREFIX
 * and would sweep away.
 *
 * Keys are short because three vehicles must fit comfortably inside the 4096-byte
 * per-cookie limit — but see `garage.limits.test.ts`: the real constraint is the vehicle
 * COUNT chosen for usability, not the byte budget, which has room to spare.
 */

import { type RoofType, type BodyType, type VehicleSelection } from "@/lib/fitment/contract";
import { fromBase64Url, signValue, toBase64Url, verifyValue } from "./signature";

export const GARAGE_COOKIE_NAME = "maky-garage";

/** One year, matching `COOKIE_MAX_AGE` for the market cookie. */
export const GARAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** v1 stores three. A limit the UI enforces visibly, never by silently dropping. */
export const GARAGE_MAX_VEHICLES = 3;

export const GARAGE_PAYLOAD_VERSION = 2;

/**
 * Versions a stored cookie may be written in and still be read.
 *
 * v1 → v2 added the optional month of manufacture. Nothing was removed and nothing
 * changed meaning, so a v1 garage migrates by being re-stamped: the shopper keeps their
 * cars instead of finding the garage empty for a reason no page can explain. There are no
 * real users of this feature yet, but every browser that has tested it holds a v1 cookie
 * — including the ones this work is verified in.
 */
export const SUPPORTED_PAYLOAD_VERSIONS = [1, 2] as const;

/**
 * Stored per vehicle. IDENTIFIERS AND QUALIFIERS ONLY.
 *
 * No VIN, no registration plate, no translated labels: a VIN or plate would turn a
 * convenience cookie into personal data with nothing gained, and a stored label would be
 * stale copy in the wrong language the moment the shopper switches market. Names are
 * always looked up from the dataset at render time.
 */
export type StoredVehicle = {
	/** makeId */ k: string;
	/** modelId */ m: string;
	/** generationId */ g: string;
	/** application year */ y: number;
	/** roofType — ABSENT when the shopper could not confirm it. Never inferred. */ r?: RoofType;
	/** bodyType */ b?: BodyType;
	/** doors */ d?: number;
	/**
	 * Month of MANUFACTURE, 1-12. Optional and must stay optional: not every supplier
	 * states months, and a window that gave only a year cannot be narrowed by one.
	 * Absent means "not asked" or "asked and not known" — both are the same instruction
	 * to the resolver, which is to leave the boundary unresolved.
	 *
	 * It is NOT the month of first registration. Those differ, often across a year end.
	 */
	mo?: number;
};

/**
 * What is deliberately NOT in here, and why it must stay out:
 *
 *   - No `compatible` flag, ever. Compatibility is re-derived against the CURRENT dataset
 *     on every use. A stored yes would survive CFM withdrawing the row that justified it,
 *     and the shopper would go on being told a rack fits after we stopped believing it.
 *   - No database keys. The ids here are the dataset's own public identities (`veh:mk:…`,
 *     `veh:md:…`, `veh:gn:…`), which survive a CFM rebuild; a local primary key would
 *     name a different car after one.
 *   - No VIN, plate or translated label. The first two are personal data for no gain; a
 *     label would be stale copy in the wrong language the moment the market changes.
 */

export type GaragePayload = {
	/** payload version */ v: number;
	/** active index into `c` */ a: number;
	/** vehicles */ c: StoredVehicle[];
	/**
	 * The dataset version the ids were chosen against. Not a signature and not trusted —
	 * it is the hint that lets a read re-check ids after CFM ships a new dataset and ask
	 * the shopper to re-pick, rather than quietly matching the wrong car.
	 */
	dv?: string;
};

export type DecodeFailure =
	| "absent"
	| "malformed"
	| "bad-signature"
	| "unsupported-version"
	| "schema-invalid";

export type DecodeResult =
	| { ok: true; payload: GaragePayload; signed: boolean }
	| { ok: false; reason: DecodeFailure };

export function toVehicleSelection(vehicle: StoredVehicle): VehicleSelection {
	return {
		makeId: vehicle.k,
		modelId: vehicle.m,
		generationId: vehicle.g,
		year: vehicle.y,
		...(vehicle.r ? { roofType: vehicle.r } : {}),
		...(vehicle.b ? { bodyType: vehicle.b } : {}),
		...(vehicle.d !== undefined ? { doors: vehicle.d } : {}),
		...(vehicle.mo !== undefined ? { manufactureMonth: vehicle.mo } : {}),
	};
}

export function fromVehicleSelection(selection: VehicleSelection): StoredVehicle {
	return {
		k: selection.makeId,
		m: selection.modelId,
		g: selection.generationId,
		y: selection.year,
		...(selection.roofType ? { r: selection.roofType } : {}),
		...(selection.bodyType ? { b: selection.bodyType } : {}),
		...(selection.doors !== undefined ? { d: selection.doors } : {}),
		...(selection.manufactureMonth !== undefined ? { mo: selection.manufactureMonth } : {}),
	};
}

/** Two vehicles are the same car when every identifying answer matches. */
export function sameVehicle(a: StoredVehicle, b: StoredVehicle): boolean {
	return (
		a.k === b.k &&
		a.m === b.m &&
		a.g === b.g &&
		a.y === b.y &&
		a.r === b.r &&
		a.b === b.b &&
		a.d === b.d &&
		a.mo === b.mo
	);
}

function isStoredVehicle(value: unknown): value is StoredVehicle {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.k !== "string" || v.k === "") return false;
	if (typeof v.m !== "string" || v.m === "") return false;
	if (typeof v.g !== "string" || v.g === "") return false;
	if (typeof v.y !== "number" || !Number.isInteger(v.y)) return false;
	if (v.r !== undefined && typeof v.r !== "string") return false;
	if (v.b !== undefined && typeof v.b !== "string") return false;
	if (v.d !== undefined && (typeof v.d !== "number" || !Number.isInteger(v.d))) return false;
	// The month is validated in `stripInvalidMonth` instead of here, so that a bad month
	// costs the month rather than the whole car.
	return true;
}

/** 1-12, or nothing. */
function isMonth(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

/**
 * Remove a month that is not a month, and keep the car.
 *
 * Dropping the whole vehicle over a bad optional field would be harsher than the mistake:
 * a car with no month is a state the resolver already handles correctly (the boundary
 * stays unresolved, the verdict is NEEDS_DETAIL), whereas a missing car is a garage the
 * shopper has to rebuild.
 */
function stripInvalidMonth(value: unknown): unknown {
	if (typeof value !== "object" || value === null) return value;
	const v = value as Record<string, unknown>;
	if (v.mo === undefined || isMonth(v.mo)) return v;
	const { mo: _dropped, ...rest } = v;
	return rest;
}

/**
 * Schema validation of a DECODED payload.
 *
 * Runs whether or not the value was signed, because a signature proves origin, not
 * sanity: a payload this server wrote last year under an older shape is authentic and
 * still wrong. Signature and schema answer different questions and both are asked.
 */
export function normalizePayload(raw: unknown): GaragePayload | null {
	if (typeof raw !== "object" || raw === null) return null;
	const value = raw as Record<string, unknown>;
	// A v1 payload is read and RE-STAMPED as v2. v2 only added an optional field, so
	// every v1 vehicle is already a valid v2 vehicle — the shopper keeps their cars.
	if (typeof value.v !== "number" || !SUPPORTED_PAYLOAD_VERSIONS.includes(value.v as 1 | 2)) return null;
	if (!Array.isArray(value.c)) return null;

	const vehicles = value.c.map(stripInvalidMonth).filter(isStoredVehicle).slice(0, GARAGE_MAX_VEHICLES);
	// An over-long or partly corrupt list is truncated rather than rejected: losing a
	// third car is a smaller harm than losing the whole garage, and the shopper can see
	// what survived.
	const active =
		typeof value.a === "number" && Number.isInteger(value.a) && value.a >= 0 && value.a < vehicles.length
			? value.a
			: 0;

	return {
		v: GARAGE_PAYLOAD_VERSION,
		a: vehicles.length === 0 ? 0 : active,
		c: vehicles,
		...(typeof value.dv === "string" ? { dv: value.dv } : {}),
	};
}

export function encodeGarageCookie(payload: GaragePayload, secret: string | null): string {
	const encoded = toBase64Url(JSON.stringify(payload));
	if (!secret) return encoded;
	return `${encoded}.${signValue(secret, encoded)}`;
}

/**
 * Decode and verify.
 *
 * `requireSignature: false` is the development mode described in `config.ts`. Even then
 * a value that CARRIES a signature must still have a valid one — accepting a bad
 * signature because signatures are optional would make the dev path meaningfully
 * different from the production path, which defeats the point of having a dev path.
 */
export function decodeGarageCookie(
	value: string | undefined | null,
	options: { secret: string | null; requireSignature: boolean },
): DecodeResult {
	if (!value) return { ok: false, reason: "absent" };

	const separator = value.lastIndexOf(".");
	const hasSignature = separator > 0;
	const encoded = hasSignature ? value.slice(0, separator) : value;
	const signature = hasSignature ? value.slice(separator + 1) : null;

	if (options.requireSignature && !hasSignature) return { ok: false, reason: "bad-signature" };
	if (hasSignature && options.secret) {
		if (!verifyValue(options.secret, encoded, signature!)) return { ok: false, reason: "bad-signature" };
	} else if (options.requireSignature) {
		return { ok: false, reason: "bad-signature" };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(fromBase64Url(encoded).toString("utf8"));
	} catch {
		return { ok: false, reason: "malformed" };
	}

	if (typeof parsed === "object" && parsed !== null) {
		const version = (parsed as { v?: unknown }).v;
		if (typeof version !== "number" || !SUPPORTED_PAYLOAD_VERSIONS.includes(version as 1 | 2)) {
			return { ok: false, reason: "unsupported-version" };
		}
	}

	const payload = normalizePayload(parsed);
	if (!payload) return { ok: false, reason: "schema-invalid" };

	return { ok: true, payload, signed: hasSignature };
}

export const EMPTY_GARAGE: GaragePayload = { v: GARAGE_PAYLOAD_VERSION, a: 0, c: [] };
