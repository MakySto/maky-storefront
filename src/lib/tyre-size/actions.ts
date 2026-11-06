"use server";

/**
 * The tyre size in the vehicle selector: what its second tab asks the server, and the one write.
 *
 * A server component render cannot write a cookie, so remembering (and forgetting) a size arrives here, like every
 * change to the garage (`lib/garage/actions.ts`). Everything a client sends is attacker-shaped and is checked
 * against the sealed list before anything is stored or answered.
 */

import { cookies } from "next/headers";

import {
	encodeTyreMemory,
	hasOwnEntry,
	isEmptyTyreMemory,
	TYRE_MEMORY_COOKIE,
	TYRE_MEMORY_MAX_AGE,
	withEntry,
	entryFor,
} from "./memory";
import { isAnswerTo, tyreQuestionOf } from "./questions";
import { readRememberedTyre, readTyreMemory, validAnswers } from "./remembered";
import { tyreSizeIndex } from "./size-index";
import {
	isRememberableTyreSize,
	resolveTyreInput,
	tyreLabelFromSteps,
	tyreSteps,
	type TyreSteps,
} from "./size-lookup";
import { readActiveVehicleKey } from "./vehicle-context";

export type TyreStepInput = {
	/** What the shopper typed or pasted. Matched to the list, never converted. */
	text?: unknown;
	/** The steps: width in mm, profile in %, rim as the list writes it ("16"). */
	width?: unknown;
	profile?: unknown;
	rim?: unknown;
};

export type TyreStepResult = {
	/** The size already remembered for the car in use, as the list spells it. */
	current: string | null;
	/** A car is in use: the size the shopper gives now is remembered for it. */
	vehicleInUse: boolean;
	steps: TyreSteps;
	/** The size the input names, or null. */
	match: string | null;
	/** `match` is a size the shop's lists hold. False for a well-formed size they do not: it is remembered, not verified. */
	listed: boolean;
	/** Something was typed and it is no size at all. */
	unknownText: boolean;
};

const wholeNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isInteger(value) && value > 0 && value < 10_000 ? value : undefined;

/**
 * What the selector's tyre tab shows next: the remembered size, the choices the steps offer, and the size the
 * input names so far. The list never leaves the server; the browser gets a few dozen numbers at a time, like the
 * vehicle selector's steps.
 */
export async function loadTyreStep(input: TyreStepInput = {}): Promise<TyreStepResult> {
	const [remembered, vehicleKey] = await Promise.all([readRememberedTyre(), readActiveVehicleKey()]);
	const current = remembered?.size ?? null;
	const vehicleInUse = vehicleKey !== null;
	const width = wholeNumber(input.width);
	const profile = wholeNumber(input.profile);
	const steps = tyreSteps(width, width === undefined ? undefined : profile);

	if (typeof input.text === "string" && input.text.trim() !== "") {
		const resolved = resolveTyreInput(input.text);
		return {
			current,
			vehicleInUse,
			steps,
			match: resolved?.label ?? null,
			listed: resolved?.listed ?? false,
			unknownText: resolved === null,
		};
	}

	const match = tyreLabelFromSteps(width, profile, input.rim);
	return { current, vehicleInUse, steps, match, listed: match !== null, unknownText: false };
}

export type RememberTyreResult =
	| { ok: true; size: string }
	| { ok: false; error: "unknown-size" | "write-failed" };

/**
 * Cookie options, the garage's (`lib/garage/actions.ts`): `secure` follows the storefront URL so local http still
 * works (a `Secure` cookie is dropped over plain http, which looks exactly like a broken feature), lax same-site,
 * an explicit path, a long Max-Age. HttpOnly: no script on the page has a reason to read it.
 */
function cookieOptions() {
	return {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: process.env.NEXT_PUBLIC_STOREFRONT_URL?.startsWith("https") ?? false,
		path: "/",
		maxAge: TYRE_MEMORY_MAX_AGE,
	};
}

type Memory = Awaited<ReturnType<typeof readTyreMemory>>;

async function write(memory: Memory): Promise<boolean> {
	try {
		const jar = await cookies();
		if (isEmptyTyreMemory(memory)) jar.delete(TYRE_MEMORY_COOKIE);
		else jar.set(TYRE_MEMORY_COOKIE, encodeTyreMemory(memory), cookieOptions());
		return true;
	} catch {
		return false;
	}
}

/**
 * Remember this size for the car in use (or for no car, when none is): a size of the list, exactly, or a well-formed
 * size the list does not hold. Anything else is refused, not stored. A new size starts without answers: they were
 * about the old tyres.
 */
export async function rememberTyreSize(size: unknown): Promise<RememberTyreResult> {
	if (!isRememberableTyreSize(size)) return { ok: false, error: "unknown-size" };
	const [memory, vehicleKey] = await Promise.all([readTyreMemory(), readActiveVehicleKey()]);
	const existing = entryFor(memory, vehicleKey);
	// The same size again keeps what was said about it.
	const answers = existing?.size === size && hasOwnEntry(memory, vehicleKey) ? existing.answers : {};
	const ok = await write(withEntry(memory, vehicleKey, { size, answers }));
	return ok ? { ok: true, size } : { ok: false, error: "write-failed" };
}

export type RememberAnswerResult =
	| { ok: true }
	| { ok: false; error: "no-size" | "not-an-answer" | "write-failed" };

/**
 * Remember what the shopper said about their tyres in answer to a question of the list. Refused when there is no size
 * to hang it on, or when it is not an answer to a question the list asks (everything a client sends is attacker-shaped).
 */
export async function rememberTyreAnswer(
	questionKey: unknown,
	answer: unknown,
): Promise<RememberAnswerResult> {
	const question =
		typeof questionKey === "string"
			? Object.values(tyreSizeIndex().conditions)
					.map(tyreQuestionOf)
					.find((candidate) => candidate.key === questionKey)
			: undefined;
	if (!question || !isAnswerTo(question, answer)) return { ok: false, error: "not-an-answer" };

	const [memory, vehicleKey, remembered] = await Promise.all([
		readTyreMemory(),
		readActiveVehicleKey(),
		readRememberedTyre(),
	]);
	if (!remembered) return { ok: false, error: "no-size" };
	// The answer is about the tyres the shopper is looking at: it is written into that car's entry, and when that
	// entry is only borrowed (the size was given with no car), into a copy of it for this car.
	const answers = { ...validAnswers(entryFor(memory, vehicleKey)?.answers ?? {}), [question.key]: answer };
	const ok = await write(withEntry(memory, vehicleKey, { size: remembered.size, answers }));
	return ok ? { ok: true } : { ok: false, error: "write-failed" };
}

/** Forget the size for the car in use: the shopper takes it back, and every page stops narrowing by it. */
export async function forgetTyreSize(): Promise<{ ok: boolean }> {
	const [memory, vehicleKey] = await Promise.all([readTyreMemory(), readActiveVehicleKey()]);
	// With a car in use, "forget" removes what was said for it and, when that is only the borrowed one, the free size.
	const own = hasOwnEntry(memory, vehicleKey);
	const next =
		own || vehicleKey === null ? withEntry(memory, vehicleKey, null) : withEntry(memory, null, null);
	return { ok: await write(next) };
}
