/**
 * The tyre size the shopper told the shop, remembered like the vehicle is.
 *
 * Codec only: no I/O, no `next/headers`, so it is unit-testable and safe to import from anywhere. The reading
 * and the writing are `remembered.ts` and `actions.ts`.
 *
 * ## What is stored, and why it is not signed
 *
 * One size, spelled exactly as the sealed list spells it (`205/55 R16`), in a small versioned envelope, base64url
 * so that Next's cookie encoding costs nothing and a stray `%` cannot make the cookie vanish (the same reasoning as
 * the garage cookie, `lib/garage/cookie.ts`). Unlike the garage it is NOT signed, on purpose: the garage signs a
 * value that later answers "does this fit your car", and a forged car would be taken at its word. Here a forged or
 * stale value is worth nothing, because it is never taken at its word: every reader checks it against the list
 * (`readRememberedTyreSize`), and the add-to-cart check (`selection.ts`) asks the list again whatever the cookie
 * said. The worst a hand-made cookie achieves is a listing narrowed to a size its owner chose to claim.
 *
 * The name is `maky-tyres`: the `maky-` family (`maky-garage`, `maky-market`), and deliberately NOT anything
 * beginning `checkoutId-`, which `lib/checkout.ts` matches by prefix and would sweep away.
 */

export const TYRE_MEMORY_COOKIE = "maky-tyres";

/** One year, like the garage and the market cookie. */
export const TYRE_MEMORY_MAX_AGE = 60 * 60 * 24 * 365;

const VERSION = 1;

/** No size in the list is longer than this; a longer value is not a size, whatever it claims to be. */
const MAX_SIZE_LENGTH = 40;

export function encodeTyreMemory(size: string): string {
	return Buffer.from(JSON.stringify({ v: VERSION, s: size }), "utf8").toString("base64url");
}

/**
 * The size the cookie carries, or `null`. Says nothing about whether the LIST holds that size: the reader asks it.
 * Never throws: a damaged cookie is no remembered size.
 */
export function decodeTyreMemory(value: string | null | undefined): string | null {
	if (!value || value.length > 200) return null;
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (typeof parsed !== "object" || parsed === null) return null;
		const { v, s } = parsed as { v?: unknown; s?: unknown };
		return v === VERSION && typeof s === "string" && s !== "" && s.length <= MAX_SIZE_LENGTH ? s : null;
	} catch {
		return null;
	}
}
