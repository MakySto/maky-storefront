import { createPublicKey, verify, type KeyObject } from "node:crypto";

/**
 * Verifies the signature Saleor puts on a webhook when the webhook has no `secretKey` (Saleor 3.23:
 * the HMAC with a shared secret is deprecated, the default is a JWS).
 *
 * The header `Saleor-Signature` is `<protected>..<signature>`: a DETACHED JWS (RFC 7515 appendix F) with
 * the unencoded payload option (RFC 7797, `b64: false`), RS256. Because the payload is not base64url
 * encoded, the signature is over `ASCII(<protected> + ".")` followed by the RAW BYTES of the request body.
 * Nothing may re-encode the body before this runs.
 *
 * The key comes from the JWKS of the Saleor this storefront is configured with
 * (`<origin of NEXT_PUBLIC_SALEOR_API_URL>/.well-known/jwks.json`), never from anything the request
 * carries: only that Saleor's key can make a signature valid, so there is no secret to hand over.
 *
 * Answers `unavailable` (not `invalid`) when the key could not be fetched, so the route can answer 5xx and
 * Saleor tries again, instead of 401, which Saleor never repeats.
 */
export type JwsResult =
	| { ok: true }
	| { ok: false; kind: "invalid"; reason: string }
	| { ok: false; kind: "unavailable"; reason: string };

interface Jwk {
	kty?: string;
	kid?: string;
	n?: string;
	e?: string;
	[key: string]: unknown;
}

interface KeyCache {
	keys: Map<string, KeyObject>;
	fetchedAt: number;
	lastAttemptAt: number;
	inflight: Promise<void> | null;
}

/** The JWKS is kept for an hour; an unknown `kid` makes one fresh read, at most once a minute. */
export const JWKS_TTL_MS = 60 * 60_000;
export const JWKS_RETRY_MS = 60_000;
/** The route answers Saleor within a second, so the key read gets well under that. */
export const JWKS_TIMEOUT_MS = 700;

const CACHE = Symbol.for("maky.saleor-jwks");

function cache(): KeyCache {
	const holder = globalThis as unknown as Record<symbol, KeyCache | undefined>;
	return (holder[CACHE] ??= {
		keys: new Map(),
		fetchedAt: -Infinity,
		lastAttemptAt: -Infinity,
		inflight: null,
	});
}

function jwksUrl(): string | null {
	const api = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!api) return null;
	try {
		return new URL("/.well-known/jwks.json", api).toString();
	} catch {
		return null;
	}
}

async function readJwks(url: string): Promise<Map<string, KeyObject>> {
	const response = await fetch(url, {
		cache: "no-store",
		signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
		headers: { accept: "application/json" },
	});
	if (!response.ok) throw new Error(`JWKS answered ${response.status}`);
	const body = (await response.json()) as { keys?: Jwk[] };
	const keys = new Map<string, KeyObject>();
	for (const jwk of body.keys ?? []) {
		if (jwk.kty !== "RSA" || typeof jwk.kid !== "string") continue;
		keys.set(jwk.kid, createPublicKey({ key: jwk as never, format: "jwk" }));
	}
	if (keys.size === 0) throw new Error("JWKS holds no RSA key");
	return keys;
}

/** Reads the JWKS into the cache; calls that arrive while a read runs share it. */
async function refresh(url: string, now: number): Promise<void> {
	const state = cache();
	if (state.inflight) return state.inflight;
	state.lastAttemptAt = now;
	state.inflight = readJwks(url)
		.then((keys) => {
			state.keys = keys;
			state.fetchedAt = now;
		})
		.finally(() => {
			state.inflight = null;
		});
	return state.inflight;
}

async function keyFor(kid: string, now: number): Promise<KeyObject | { unavailable: string } | null> {
	const state = cache();
	const url = jwksUrl();
	if (!url) return { unavailable: "NEXT_PUBLIC_SALEOR_API_URL is not set" };

	const fresh = now - state.fetchedAt < JWKS_TTL_MS;
	const known = state.keys.get(kid);
	if (known && fresh) return known;

	// Stale, or a `kid` we do not hold: read again, but not more than once a minute.
	if (!fresh || now - state.lastAttemptAt >= JWKS_RETRY_MS || state.inflight) {
		try {
			await refresh(url, now);
		} catch (error) {
			// A key we still hold stays usable through a failed refresh; with none, the caller may retry.
			if (known) return known;
			return { unavailable: error instanceof Error ? error.message : "JWKS read failed" };
		}
	}
	return state.keys.get(kid) ?? null;
}

const fromBase64Url = (value: string): Buffer | null =>
	/^[A-Za-z0-9_-]*$/.test(value) ? Buffer.from(value, "base64url") : null;

export async function verifySaleorJws(
	rawBody: Uint8Array,
	header: string | null,
	now: number = Date.now(),
): Promise<JwsResult> {
	if (!header) return { ok: false, kind: "invalid", reason: "no signature header" };
	const parts = header.split(".");
	if (parts.length !== 3 || parts[1] !== "") {
		return { ok: false, kind: "invalid", reason: "not a detached JWS" };
	}
	const [protectedB64, , signatureB64] = parts as [string, string, string];

	let protectedHeader: Record<string, unknown>;
	try {
		const decoded = fromBase64Url(protectedB64);
		if (!decoded) throw new Error("bad base64url");
		protectedHeader = JSON.parse(decoded.toString("utf8")) as Record<string, unknown>;
	} catch {
		return { ok: false, kind: "invalid", reason: "unreadable protected header" };
	}

	if (protectedHeader.alg !== "RS256") {
		return { ok: false, kind: "invalid", reason: `unsupported alg ${String(protectedHeader.alg)}` };
	}
	// The body is signed as it is, not base64url encoded: that is what `b64: false` says. A header that does
	// not say it would make this signing input wrong, so it is refused rather than guessed at.
	const crit = protectedHeader.crit;
	if (protectedHeader.b64 !== false || !Array.isArray(crit) || crit.some((name) => name !== "b64")) {
		return { ok: false, kind: "invalid", reason: "expected an unencoded payload (b64 false, crit b64)" };
	}
	const kid = protectedHeader.kid;
	if (typeof kid !== "string" || kid.length === 0 || kid.length > 200) {
		return { ok: false, kind: "invalid", reason: "no kid" };
	}
	const signature = fromBase64Url(signatureB64);
	if (!signature || signature.length === 0) {
		return { ok: false, kind: "invalid", reason: "unreadable signature" };
	}

	const key = await keyFor(kid, now);
	if (key === null) return { ok: false, kind: "invalid", reason: "unknown kid" };
	if ("unavailable" in key) return { ok: false, kind: "unavailable", reason: key.unavailable };

	const signingInput = Buffer.concat([Buffer.from(`${protectedB64}.`, "ascii"), rawBody]);
	let valid = false;
	try {
		valid = verify("sha256", signingInput, key, signature);
	} catch {
		valid = false;
	}
	return valid ? { ok: true } : { ok: false, kind: "invalid", reason: "signature does not match" };
}

/** For tests. */
export function __resetSaleorJwks(): void {
	const state = cache();
	state.keys = new Map();
	state.fetchedAt = -Infinity;
	state.lastAttemptAt = -Infinity;
	state.inflight = null;
}
