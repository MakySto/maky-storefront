/**
 * The tyre size the shopper told the shop, and what they said about their tyres, remembered like the vehicle is.
 *
 * Codec only: no I/O, no `next/headers`, so it is unit-testable and safe to import from anywhere. The reading
 * and the writing are `remembered.ts` and `actions.ts`.
 *
 * ## What is stored
 *
 * A size is a fact about a SET OF TYRES, and tyres belong to a car. So the cookie holds one entry per car the shopper
 * gave a size for, and one for a size given with no car in use:
 *
 *   `f`  the size given with no car (`free`)
 *   `c`  the size given while this car was in use, by the car's key (`vehicle-context.ts`)
 *
 * A car's own entry wins when that car is in use; a car with none sees the free one, if there is one. A size given
 * for car A is never shown for car B: switching the car in the header used to leave A's tyres under B.
 *
 * An entry is the size, spelled exactly as the sealed list spells it (`205/55 R16`), and the answers the shopper gave
 * to the list's questions about their tyres (`a`: question key → answer, `questions.ts`). Answers belong to the tyres,
 * so a new size starts with none.
 *
 * ## Why it is not signed
 *
 * Unlike the garage it is NOT signed, on purpose: the garage signs a value that later answers "does this fit your
 * car", and a forged car would be taken at its word. Here a forged or stale value is worth nothing, because it is
 * never taken at its word: every reader checks it against the list (`readRememberedTyre`), and the add-to-cart check
 * (`selection.ts`) asks the list again whatever the cookie said. The worst a hand-made cookie achieves is a listing
 * narrowed to a size its owner chose to claim, or a verdict about tyres they say they have.
 *
 * Base64url so that Next's cookie encoding costs nothing and a stray `%` cannot make the cookie vanish (the same
 * reasoning as the garage cookie, `lib/garage/cookie.ts`). The name is `maky-tyres`: the `maky-` family, and
 * deliberately NOT anything beginning `checkoutId-`, which `lib/checkout.ts` matches by prefix and would sweep away.
 */

export const TYRE_MEMORY_COOKIE = "maky-tyres";

/** One year, like the garage and the market cookie. */
export const TYRE_MEMORY_MAX_AGE = 60 * 60 * 24 * 365;

const VERSION = 2;

/** No size in the list is longer than this; a longer value is not a size, whatever it claims to be. */
const MAX_SIZE_LENGTH = 40;
const MAX_ANSWER_LENGTH = 80;
const MAX_KEY_LENGTH = 200;
/** A garage keeps three cars and one more is in use; a few spare make a stale entry harmless. */
const MAX_VEHICLES = 6;
const MAX_ANSWERS = 8;
const MAX_COOKIE_LENGTH = 3000;

export interface TyreEntry {
	/** The size, as the list spells it. Not yet checked against the list: `readRememberedTyre` does that. */
	readonly size: string;
	/** Question key → answer. Not yet checked against the questions: `readRememberedTyre` does that. */
	readonly answers: Readonly<Record<string, string>>;
}

export interface TyreMemory {
	readonly free: TyreEntry | null;
	/** Insertion order is recency: the oldest goes first when there are too many. */
	readonly vehicles: Readonly<Record<string, TyreEntry>>;
}

export const EMPTY_TYRE_MEMORY: TyreMemory = { free: null, vehicles: {} };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A key the cookie may carry: not empty, not long, and not the one name that would reach the object's prototype. */
const isSafeKey = (key: string): boolean => key !== "" && key !== "__proto__" && key.length <= MAX_KEY_LENGTH;

function entryOf(raw: unknown): TyreEntry | null {
	if (!isRecord(raw)) return null;
	const { s, a } = raw;
	if (typeof s !== "string" || s === "" || s.length > MAX_SIZE_LENGTH) return null;
	const answers: Record<string, string> = {};
	if (isRecord(a)) {
		for (const [key, value] of Object.entries(a).slice(0, MAX_ANSWERS)) {
			if (isSafeKey(key) && typeof value === "string" && value.length <= MAX_ANSWER_LENGTH)
				answers[key] = value;
		}
	}
	return { size: s, answers };
}

const wire = (entry: TyreEntry) => ({
	s: entry.size,
	...(Object.keys(entry.answers).length ? { a: entry.answers } : {}),
});

export function encodeTyreMemory(memory: TyreMemory): string {
	const vehicles = Object.entries(memory.vehicles);
	const payload = {
		v: VERSION,
		...(memory.free ? { f: wire(memory.free) } : {}),
		...(vehicles.length ? { c: Object.fromEntries(vehicles.map(([key, entry]) => [key, wire(entry)])) } : {}),
	};
	return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * What the cookie carries. Never throws: a damaged cookie is a shopper who said nothing. A version-1 cookie (one size,
 * no answers, no car) reads as the free entry, so nobody who gave a size loses it.
 */
export function decodeTyreMemory(value: string | null | undefined): TyreMemory {
	if (!value || value.length > MAX_COOKIE_LENGTH) return EMPTY_TYRE_MEMORY;
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (!isRecord(parsed)) return EMPTY_TYRE_MEMORY;
		if (parsed.v === 1) {
			const free = entryOf({ s: parsed.s });
			return free ? { free, vehicles: {} } : EMPTY_TYRE_MEMORY;
		}
		if (parsed.v !== VERSION) return EMPTY_TYRE_MEMORY;
		const vehicles: Record<string, TyreEntry> = {};
		if (isRecord(parsed.c)) {
			for (const [key, raw] of Object.entries(parsed.c).slice(0, MAX_VEHICLES)) {
				const entry = isSafeKey(key) ? entryOf(raw) : null;
				if (entry) vehicles[key] = entry;
			}
		}
		return { free: entryOf(parsed.f), vehicles };
	} catch {
		return EMPTY_TYRE_MEMORY;
	}
}

/** The entry that speaks for this context: the car's own when it has one, else the one given with no car. */
export function entryFor(memory: TyreMemory, vehicleKey: string | null): TyreEntry | null {
	if (vehicleKey !== null && Object.hasOwn(memory.vehicles, vehicleKey)) return memory.vehicles[vehicleKey];
	return memory.free;
}

/** Does this context have an entry of its own (as against borrowing the free one)? */
export function hasOwnEntry(memory: TyreMemory, vehicleKey: string | null): boolean {
	return vehicleKey === null ? memory.free !== null : Object.hasOwn(memory.vehicles, vehicleKey);
}

/** The memory with this context's entry set, or removed when `entry` is `null`. The context's entry becomes the newest. */
export function withEntry(
	memory: TyreMemory,
	vehicleKey: string | null,
	entry: TyreEntry | null,
): TyreMemory {
	if (vehicleKey === null) return { free: entry, vehicles: memory.vehicles };
	const rest = Object.entries(memory.vehicles).filter(([key]) => key !== vehicleKey);
	const next = entry ? [...rest, [vehicleKey, entry] as const] : rest;
	return { free: memory.free, vehicles: Object.fromEntries(next.slice(-MAX_VEHICLES)) };
}

export const isEmptyTyreMemory = (memory: TyreMemory): boolean =>
	memory.free === null && Object.keys(memory.vehicles).length === 0;
