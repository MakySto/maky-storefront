import { createHmac, timingSafeEqual } from "crypto";

/**
 * Detached HMAC for long-lived storefront cookies.
 *
 * Deliberately NOT `src/lib/forms/signature.ts`, for two reasons — only one of which is
 * the obvious one.
 *
 * The obvious one: that helper binds a Unix-seconds timestamp into the MAC so a captured
 * request expires. Its 300-second window is a per-call default rather than a hard
 * constant, so a year-long value could technically be verified by passing a huge
 * `maxSkewSeconds` — but doing that would mean carrying a freshness mechanism precisely
 * in order to defeat it. A cookie's lifetime is `Max-Age`; it does not need a second,
 * contradictory clock.
 *
 * The real one: `MAKY_FORMS_HMAC_SECRET` is the authorisation for writing a legally
 * significant record — a §20a withdrawal notice. A secret that can do that must not also
 * be the thing that says which car a shopper picked. Separate purpose, separate secret,
 * so that rotating one never silently changes what the other can do.
 *
 * What this signature is and is not: it protects INTEGRITY of a value the server itself
 * wrote. It is not an access control. Nothing in the garage is confidential — the worst
 * a forged cookie achieves is choosing a different car — so the point is that decode
 * failures are unambiguous and a malformed value can never be read as a valid selection.
 */

/** Base64url, no padding — URL-safe, so it survives cookie encoding at zero cost. */
export function toBase64Url(input: Buffer | string): string {
	return (typeof input === "string" ? Buffer.from(input, "utf8") : input).toString("base64url");
}

export function fromBase64Url(input: string): Buffer {
	return Buffer.from(input, "base64url");
}

/** Detached MAC over the exact string that will be stored. No timestamp, by design. */
export function signValue(secret: string, encodedPayload: string): string {
	return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("base64url");
}

/**
 * Constant-time comparison.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false, and a
 * forged cookie is the one input guaranteed to have an arbitrary length — so the length
 * check has to come first, and it has to be its own branch.
 */
export function verifyValue(secret: string, encodedPayload: string, signature: string): boolean {
	const expected = Buffer.from(signValue(secret, encodedPayload), "utf8");
	const actual = Buffer.from(signature, "utf8");
	if (expected.length !== actual.length) return false;
	try {
		return timingSafeEqual(expected, actual);
	} catch {
		return false;
	}
}
