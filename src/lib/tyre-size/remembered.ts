import "server-only";

import { cookies } from "next/headers";

import { entryFor, decodeTyreMemory, hasOwnEntry, TYRE_MEMORY_COOKIE, type TyreMemory } from "./memory";
import type { TyreAnswers } from "./choice";
import { isAnswerTo, tyreQuestionOf } from "./questions";
import { tyreSizeIndex } from "./size-index";
import { isRememberableTyreSize } from "./size-lookup";
import { readActiveVehicleKey } from "./vehicle-context";

/**
 * The tyres this shopper has told the shop about, for the car in use, or `null`.
 *
 * Read on the server, behind the same rule as the garage (`lib/garage/state.ts`): under cacheComponents a cookie
 * read inside a prerendered scope throws, and the right answer there is "nothing remembered", exactly what a
 * shopper who never said anything gets. A caller inside a prerendered shell still puts this behind its own
 * `connection()` in its own Suspense boundary; the guard here stops a crash, it does not make a static shell dynamic.
 *
 * Nothing is taken on the cookie's word. The size must be a size the list holds or a well-formed one (anything else,
 * a hand-made or damaged value, is "nothing remembered"), and an answer survives only when it answers a question the
 * list really asks.
 */
export interface RememberedTyre {
	/** The size, as the list spells it, or a well-formed one the list does not hold (the page then says it cannot verify it). */
	readonly size: string;
	/** What the shopper said about their tyres, by question key. */
	readonly answers: TyreAnswers;
	/** True when the size was given for the car in use; false when it was given with no car and is borrowed. */
	readonly forThisVehicle: boolean;
}

let questions: ReadonlyMap<string, ReturnType<typeof tyreQuestionOf>> | null = null;
function knownQuestions() {
	if (questions) return questions;
	const map = new Map<string, ReturnType<typeof tyreQuestionOf>>();
	for (const condition of Object.values(tyreSizeIndex().conditions)) {
		const question = tyreQuestionOf(condition);
		map.set(question.key, question);
	}
	questions = map;
	return map;
}

/** Only the answers that answer a question the list asks. */
export function validAnswers(raw: Readonly<Record<string, string>>): TyreAnswers {
	const kept: Record<string, string> = {};
	for (const [key, answer] of Object.entries(raw)) {
		const question = knownQuestions().get(key);
		if (question && isAnswerTo(question, answer)) kept[key] = answer;
	}
	return kept;
}

/** The raw memory, never throwing. */
export async function readTyreMemory(): Promise<TyreMemory> {
	try {
		return decodeTyreMemory((await cookies()).get(TYRE_MEMORY_COOKIE)?.value);
	} catch {
		return decodeTyreMemory(undefined);
	}
}

export async function readRememberedTyre(): Promise<RememberedTyre | null> {
	let memory: TyreMemory;
	try {
		memory = decodeTyreMemory((await cookies()).get(TYRE_MEMORY_COOKIE)?.value);
	} catch {
		return null;
	}
	const vehicleKey = await readActiveVehicleKey();
	const entry = entryFor(memory, vehicleKey);
	if (!entry || !isRememberableTyreSize(entry.size)) return null;
	return {
		size: entry.size,
		answers: validAnswers(entry.answers),
		forThisVehicle: vehicleKey !== null && hasOwnEntry(memory, vehicleKey),
	};
}

/** The size alone, for the surfaces that only need to name it (the header button). */
export async function readRememberedTyreSize(): Promise<string | null> {
	return (await readRememberedTyre())?.size ?? null;
}
