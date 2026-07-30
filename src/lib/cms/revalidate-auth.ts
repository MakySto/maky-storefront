import { timingSafeEqual } from "crypto";

/**
 * Authentication for the Payload revalidation endpoint.
 *
 * Deliberately separate from `src/lib/api-auth.ts`, which holds the Saleor webhook
 * secret. The two endpoints invalidate different entities on behalf of different
 * producers holding different secrets; keeping the verifiers apart means a change
 * to one cannot widen the other. The cost is a duplicated ten-line compare, which
 * is cheaper than the coupling.
 *
 * The secret is read at call time, not at module scope. `api-auth.ts` reads its
 * secrets at module scope, so a secret added to .env there does nothing until the
 * process restarts — a trap worth not repeating.
 */

/**
 * Read the secret from `Authorization: Bearer` and from nowhere else.
 *
 * `api-auth.ts` exports `extractBearerToken`, which also accepts `?secret=` and an
 * `x-revalidate-secret` header. That helper is deliberately NOT reused here. A secret
 * in a query string is a secret in nginx access logs, in proxy logs, in APM traces,
 * in `Referer` headers and in browser history — it leaks by being transported, and no
 * amount of care at the endpoint takes it back. Payload sends a Bearer header, so
 * accepting anything else buys nothing and costs that.
 *
 * The header is matched case-insensitively on the scheme, because RFC 7235 says the
 * scheme is case-insensitive and a client that sends `bearer` is not an attacker.
 * Everything after the single space is the token, untrimmed: a secret is bytes, and
 * quietly trimming whitespace would make two different secrets compare equal.
 */
export function readBearerToken(request: { headers: { get(name: string): string | null } }): string | null {
	const header = request.headers.get("authorization");
	if (!header) return null;

	const match = /^Bearer (.+)$/i.exec(header);
	return match?.[1] ?? null;
}

/** Fail-closed: with no secret configured, nothing authenticates. */
export function verifyPayloadRevalidateSecret(provided: string | null | undefined): boolean {
	const expected = process.env.PAYLOAD_REVALIDATE_SECRET;
	if (!provided || !expected) return false;

	try {
		const a = new Uint8Array(Buffer.from(provided));
		const b = new Uint8Array(Buffer.from(expected));
		// timingSafeEqual throws on a length mismatch, so compare lengths first. The
		// length of a rejected guess is not a useful oracle.
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

/** True when the CMS revalidation secret is configured at all. */
export function isPayloadRevalidateConfigured(): boolean {
	return Boolean(process.env.PAYLOAD_REVALIDATE_SECRET);
}
