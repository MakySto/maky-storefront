import { createHmac, timingSafeEqual } from "crypto";

/**
 * Timestamped HMAC for the Payload forms endpoints.
 *
 * Cloudflare Access is the network gate: it proves the request came from a machine
 * holding the service token. It says nothing about *which* application sent it or
 * whether the body was tampered with, so it cannot be the authorisation for writing a
 * legally significant record. This signature is that authorisation, and it is the
 * reason the Payload collection itself can refuse anonymous creates outright.
 *
 * Signed value is `timestamp + "." + rawBody`, so the timestamp is inside the MAC. A
 * signature over the body alone would be replayable forever; binding the two means a
 * captured request expires.
 *
 * The timestamp is Unix SECONDS. Payload accepts 10-11 digits, so a millisecond value
 * is refused outright — and since `Date.now()` returns milliseconds, that mistake is
 * one keystroke away and produces code that looks right and never succeeds once.
 *
 * Both sides sign the RAW body string, never a re-serialised object — two JSON
 * encoders will eventually disagree about key order or unicode escaping, and the
 * failure looks like a mysterious signature mismatch.
 */

/**
 * How far apart the two clocks may be before a request is treated as replayed.
 *
 * Payload's window is 300 seconds, symmetric, with exactly 300 still valid. Matching it
 * here means the storefront's own tests fail for the same reason the endpoint would,
 * rather than passing locally and failing on the wire.
 */
export const SIGNATURE_MAX_SKEW_SECONDS = 300;

export function signedPayload(timestamp: string, rawBody: string): string {
	return `${timestamp}.${rawBody}`;
}

export function signFormsRequest(secret: string, timestamp: string, rawBody: string): string {
	return createHmac("sha256", secret).update(signedPayload(timestamp, rawBody), "utf8").digest("hex");
}

/**
 * Constant-time verification, including the freshness window.
 *
 * Exported mainly so the storefront's own tests can prove the wire format is what the
 * Payload side will verify — the storefront signs, it does not verify. Keeping a
 * verifier next to the signer is what makes "invalid signature", "stale timestamp" and
 * "replayed request" testable here rather than only in the other repository.
 */
export function verifyFormsSignature(options: {
	secret: string;
	timestamp: string;
	rawBody: string;
	signature: string;
	/** Unix SECONDS, matching the header. */
	nowSeconds: number;
	maxSkewSeconds?: number;
}): { ok: true } | { ok: false; reason: "badTimestamp" | "stale" | "badSignature" } {
	const {
		secret,
		timestamp,
		rawBody,
		signature,
		nowSeconds,
		maxSkewSeconds = SIGNATURE_MAX_SKEW_SECONDS,
	} = options;

	// 10-11 digits, so a millisecond timestamp (13 digits) is rejected by shape rather
	// than sliding through as a clock a few thousand years in the future.
	if (!/^\d{10,11}$/.test(timestamp)) return { ok: false, reason: "badTimestamp" };

	const sentAt = Number(timestamp);
	if (!Number.isFinite(sentAt)) return { ok: false, reason: "badTimestamp" };

	// Symmetric window: a clock ahead of ours is as suspicious as one behind.
	if (Math.abs(nowSeconds - sentAt) > maxSkewSeconds) return { ok: false, reason: "stale" };

	const expected = signFormsRequest(secret, timestamp, rawBody);
	const a = new Uint8Array(Buffer.from(expected, "utf8"));
	const b = new Uint8Array(Buffer.from(signature, "utf8"));
	// timingSafeEqual throws on a length mismatch; the length of a wrong signature is
	// not a useful oracle, so compare it first and fail the same way.
	if (a.length !== b.length) return { ok: false, reason: "badSignature" };

	return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "badSignature" };
}
