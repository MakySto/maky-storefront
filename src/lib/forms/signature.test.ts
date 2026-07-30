import { describe, expect, it } from "vitest";

import {
	SIGNATURE_MAX_SKEW_SECONDS,
	signFormsRequest,
	signedPayload,
	verifyFormsSignature,
} from "./signature";
import { formsTimestampSeconds } from "../withdrawal/contract";

const SECRET = "forms-hmac-secret-for-tests";
/** Unix seconds, ten digits. */
const NOW = 1_785_000_000;
const BODY = '{"submissionId":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","scope":"wholeOrder"}';

function sign(timestamp: number | string, body = BODY, secret = SECRET): string {
	return signFormsRequest(secret, String(timestamp), body);
}

function verify(overrides: Partial<Parameters<typeof verifyFormsSignature>[0]> = {}) {
	return verifyFormsSignature({
		secret: SECRET,
		timestamp: String(NOW),
		rawBody: BODY,
		signature: sign(NOW),
		nowSeconds: NOW,
		...overrides,
	});
}

describe("forms timestamp — seconds, not milliseconds", () => {
	it("converts a millisecond clock to the ten-digit value Payload accepts", () => {
		// The bug this replaces: String(Date.now()) is thirteen digits, Payload accepts
		// ten or eleven, so every single request failed with INVALID_TIMESTAMP while
		// looking perfectly reasonable in the source.
		expect(formsTimestampSeconds(1_785_000_000_123)).toBe("1785000000");
		expect(formsTimestampSeconds(1_785_000_000_123)).toMatch(/^\d{10}$/);
	});

	it("floors rather than rounds, so a timestamp is never in the future", () => {
		expect(formsTimestampSeconds(1_785_000_000_999)).toBe("1785000000");
	});
});

describe("forms signature — wire format", () => {
	it("signs timestamp and body together, not the body alone", () => {
		// If the timestamp were outside the MAC, a captured request would be replayable
		// forever: an attacker could keep the signature and just move the clock forward.
		expect(signedPayload("123", "{}")).toBe("123.{}");
		expect(sign(NOW)).not.toBe(sign(NOW + 1));
	});

	it("is deterministic for the same secret, timestamp and body", () => {
		expect(sign(NOW)).toBe(sign(NOW));
	});

	it("produces exactly 64 lowercase hex characters, as the contract requires", () => {
		expect(sign(NOW)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("forms signature — verification", () => {
	it("accepts a fresh, correctly signed request", () => {
		expect(verify()).toEqual({ ok: true });
	});

	it("REJECTS a millisecond timestamp by shape", () => {
		// Thirteen digits is not "a clock far in the future" — it is the wrong unit, and
		// rejecting it on shape says so instead of blaming skew.
		const ms = 1_785_000_000_123;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(ms),
				rawBody: BODY,
				signature: sign(ms),
				nowSeconds: NOW,
			}),
		).toEqual({ ok: false, reason: "badTimestamp" });
	});

	it("rejects a signature made with a different secret", () => {
		expect(verify({ signature: sign(NOW, BODY, "other-secret") })).toEqual({
			ok: false,
			reason: "badSignature",
		});
	});

	it("rejects a body that changed after signing", () => {
		const tampered = BODY.replace("wholeOrder", "selectedItems");
		expect(verify({ rawBody: tampered })).toEqual({ ok: false, reason: "badSignature" });
	});

	it("rejects a replayed request once it falls outside the 300-second window", () => {
		const old = NOW - SIGNATURE_MAX_SKEW_SECONDS - 1;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(old),
				rawBody: BODY,
				signature: sign(old),
				nowSeconds: NOW,
			}),
		).toEqual({ ok: false, reason: "stale" });
	});

	it("still accepts a request at exactly 300 seconds, matching Payload", () => {
		const edge = NOW - SIGNATURE_MAX_SKEW_SECONDS;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(edge),
				rawBody: BODY,
				signature: sign(edge),
				nowSeconds: NOW,
			}),
		).toEqual({ ok: true });
	});

	it("rejects a timestamp from the future by the same margin", () => {
		// A clock ahead of ours is as suspicious as one behind, and a one-sided window
		// would let an attacker mint a signature valid for as long as they liked.
		const future = NOW + SIGNATURE_MAX_SKEW_SECONDS + 1;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(future),
				rawBody: BODY,
				signature: sign(future),
				nowSeconds: NOW,
			}),
		).toEqual({ ok: false, reason: "stale" });
	});

	it("rejects a timestamp that is not 10–11 plain digits", () => {
		for (const timestamp of ["", "abc", "178500000", "1785000000.5", "1e9", " 1785000000"]) {
			expect(verify({ timestamp }).ok, timestamp).toBe(false);
		}
	});

	it("rejects a truncated signature without letting the length compare throw", () => {
		expect(verify({ signature: sign(NOW).slice(0, 40) })).toEqual({ ok: false, reason: "badSignature" });
		expect(verify({ signature: "" })).toEqual({ ok: false, reason: "badSignature" });
	});
});
