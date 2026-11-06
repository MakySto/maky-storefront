"use server";

/**
 * The tyre size in the vehicle selector: what its second tab asks the server, and the one write.
 *
 * A server component render cannot write a cookie, so remembering (and forgetting) a size arrives here, like every
 * change to the garage (`lib/garage/actions.ts`). Everything a client sends is attacker-shaped and is checked
 * against the sealed list before anything is stored or answered.
 */

import { cookies } from "next/headers";

import { encodeTyreMemory, TYRE_MEMORY_COOKIE, TYRE_MEMORY_MAX_AGE } from "./memory";
import { readRememberedTyreSize } from "./remembered";
import {
	isKnownTyreSize,
	resolveTyreText,
	tyreLabelFromSteps,
	tyreSteps,
	type TyreSteps,
} from "./size-lookup";

export type TyreStepInput = {
	/** What the shopper typed or pasted. Matched to the list, never converted. */
	text?: unknown;
	/** The steps: width in mm, profile in %, rim as the list writes it ("16"). */
	width?: unknown;
	profile?: unknown;
	rim?: unknown;
};

export type TyreStepResult = {
	/** The size already remembered, as the list spells it. */
	current: string | null;
	steps: TyreSteps;
	/** The list's size the input names, or null. */
	match: string | null;
	/** Something was typed and the list holds no such size. */
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
	const current = await readRememberedTyreSize();
	const width = wholeNumber(input.width);
	const profile = wholeNumber(input.profile);
	const steps = tyreSteps(width, width === undefined ? undefined : profile);

	if (typeof input.text === "string" && input.text.trim() !== "") {
		const match = resolveTyreText(input.text);
		return { current, steps, match, unknownText: match === null };
	}

	const match = tyreLabelFromSteps(width, profile, input.rim);
	return { current, steps, match, unknownText: false };
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

/** Remember this size: the list's own label, exactly. A size the list does not hold is refused, not stored. */
export async function rememberTyreSize(size: unknown): Promise<RememberTyreResult> {
	if (!isKnownTyreSize(size)) return { ok: false, error: "unknown-size" };
	try {
		(await cookies()).set(TYRE_MEMORY_COOKIE, encodeTyreMemory(size), cookieOptions());
	} catch {
		return { ok: false, error: "write-failed" };
	}
	return { ok: true, size };
}

/** Forget the size: the shopper takes it back, and every page stops narrowing by it. */
export async function forgetTyreSize(): Promise<{ ok: boolean }> {
	try {
		(await cookies()).delete(TYRE_MEMORY_COOKIE);
		return { ok: true };
	} catch {
		return { ok: false };
	}
}
