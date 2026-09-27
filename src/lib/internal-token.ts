/**
 * A per-process secret for loopback requests the server makes to itself.
 *
 * The proxy's crawler preflight (`lib/bot-preflight.ts`) asks `/api/internal/product-outcome`
 * over 127.0.0.1. That route must not answer anyone else: nginx forwards every public request
 * from 127.0.0.1 too, so the source address proves nothing. So the proxy sends this token and
 * the route compares it.
 *
 * No configured secret. The token is minted once per process and kept on `globalThis` under a
 * registry symbol — the proxy and the route handlers are separate bundles that each load their
 * own copy of this module, but under `next start` they run in one process and one realm, so they
 * share `globalThis` (the same mechanism `route-existence.ts` relies on for its state). Nothing
 * to rotate, nothing in `.env`, nothing that can leak into a commit, and a restart retires it.
 *
 * If the two bundles ever stop sharing a realm, each mints its own token, the route answers 404,
 * and the preflight fails OPEN — the crawler gets the page exactly as before this existed.
 */
const TOKEN_KEY = Symbol.for("maky.internal-loopback-token.v1");

export const INTERNAL_TOKEN_HEADER = "x-maky-internal";

type Registry = typeof globalThis & { [TOKEN_KEY]?: string };

export function internalLoopbackToken(): string {
	const registry = globalThis as Registry;
	registry[TOKEN_KEY] ??= `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
	return registry[TOKEN_KEY];
}

/** Constant-time comparison against this process's token. */
export function isInternalLoopbackToken(candidate: string | null | undefined): boolean {
	if (typeof candidate !== "string") return false;
	const expected = internalLoopbackToken();
	if (candidate.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
	return diff === 0;
}
