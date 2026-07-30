import { describe, expect, it } from "vitest";

import { signFormsRequest, signedPayload, verifyFormsSignature, SIGNATURE_MAX_SKEW_MS } from "./signature";

const SECRET = "forms-hmac-secret-for-tests";
const NOW = 1_785_000_000_000;
const BODY = '{"submissionId":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","scope":"wholeOrder"}';

function sign(timestamp: number, body = BODY, secret = SECRET): string {
	return signFormsRequest(secret, String(timestamp), body);
}

function verify(overrides: Partial<Parameters<typeof verifyFormsSignature>[0]> = {}) {
	return verifyFormsSignature({
		secret: SECRET,
		timestamp: String(NOW),
		rawBody: BODY,
		signature: sign(NOW),
		now: NOW,
		...overrides,
	});
}

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

	it("produces a hex sha256 digest", () => {
		expect(sign(NOW)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("forms signature — verification", () => {
	it("accepts a fresh, correctly signed request", () => {
		expect(verify()).toEqual({ ok: true });
	});

	it("rejects a signature made with a different secret", () => {
		expect(verify({ signature: sign(NOW, BODY, "other-secret") })).toEqual({
			ok: false,
			reason: "badSignature",
		});
	});

	it("rejects a body that changed after signing", () => {
		// The tamper case that matters: same signature, edited payload.
		const tampered = BODY.replace("wholeOrder", "selectedItems");
		expect(verify({ rawBody: tampered })).toEqual({ ok: false, reason: "badSignature" });
	});

	it("rejects a replayed request once it falls outside the window", () => {
		const old = NOW - SIGNATURE_MAX_SKEW_MS - 1;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(old),
				rawBody: BODY,
				signature: sign(old),
				now: NOW,
			}),
		).toEqual({ ok: false, reason: "stale" });
	});

	it("still accepts a request at the edge of the window", () => {
		const edge = NOW - SIGNATURE_MAX_SKEW_MS;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(edge),
				rawBody: BODY,
				signature: sign(edge),
				now: NOW,
			}),
		).toEqual({ ok: true });
	});

	it("rejects a timestamp from the future by the same margin", () => {
		// A clock ahead of ours is as suspicious as one behind, and a one-sided window
		// would let an attacker mint a signature valid for as long as they liked.
		const future = NOW + SIGNATURE_MAX_SKEW_MS + 1;
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: String(future),
				rawBody: BODY,
				signature: sign(future),
				now: NOW,
			}),
		).toEqual({ ok: false, reason: "stale" });
	});

	it("rejects a timestamp that is not a plain integer", () => {
		for (const timestamp of ["", "abc", "1785000000000.5", "1e12", " 1785000000000"]) {
			expect(verify({ timestamp, signature: sign(NOW) }).ok, timestamp).toBe(false);
		}
	});

	it("rejects a truncated signature without letting the length compare throw", () => {
		expect(verify({ signature: sign(NOW).slice(0, 40) })).toEqual({ ok: false, reason: "badSignature" });
		expect(verify({ signature: "" })).toEqual({ ok: false, reason: "badSignature" });
	});
});
