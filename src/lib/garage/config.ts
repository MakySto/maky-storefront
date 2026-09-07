import "server-only";

/**
 * How the garage decides whether it may store anything.
 *
 * `MAKY_GARAGE_COOKIE_SECRET` is not set in production today. That is a deploy step, not
 * a bug to be coded around, and the shape of the fallback matters more than it looks:
 *
 *   - Silently writing UNSIGNED cookies in production would mean the one environment
 *     nobody tests by hand is the one running the untested code path. Refused.
 *   - Silently disabling the garage in production while it works perfectly in dev is the
 *     failure mode the withdrawal form already hit once: a feature that is "done" for
 *     months and reaches nobody. So `disabled` is REPORTED, not just returned, and every
 *     garage surface renders a visible unconfigured state instead of an empty one.
 *
 * The dev fallback keys off NODE_ENV, which is a weak signal — the same weak signal that
 * caused trouble elsewhere in this codebase. It is acceptable here only because of what
 * it actually gates: whether an unsigned cookie may record which car someone drives. If
 * NODE_ENV were ever wrong in production the worst outcome is that a shopper could
 * hand-craft a cookie selecting a different car for themselves. Nothing is authorised by
 * this value, no price depends on it, and no fit claim is derived from it alone — the
 * dataset is still consulted server-side for every verdict.
 */

export type GarageMode =
	| { kind: "signed"; secret: string }
	| { kind: "unsigned"; reason: string }
	| { kind: "disabled"; reason: string };

/** Matches the warning threshold `src/lib/api-auth.ts` applies to its own secrets. */
const MIN_SECRET_LENGTH = 32;

let warned = false;

/** Read at call time, not at module scope, so a restart can change the answer. */
export function resolveGarageMode(): GarageMode {
	const secret = process.env.MAKY_GARAGE_COOKIE_SECRET?.trim();

	if (secret) {
		if (secret.length < MIN_SECRET_LENGTH && !warned) {
			warned = true;
			console.warn(`[garage] MAKY_GARAGE_COOKIE_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`);
		}
		return { kind: "signed", secret };
	}

	if (process.env.NODE_ENV === "production") {
		if (!warned) {
			warned = true;
			console.warn(
				"[garage] MAKY_GARAGE_COOKIE_SECRET is not set — the garage is DISABLED. " +
					"Set it to enable saved vehicles; see .env.example.",
			);
		}
		return { kind: "disabled", reason: "missing-MAKY_GARAGE_COOKIE_SECRET" };
	}

	return { kind: "unsigned", reason: "no-secret-outside-production" };
}

export function isGarageEnabled(mode: GarageMode = resolveGarageMode()): boolean {
	return mode.kind !== "disabled";
}
