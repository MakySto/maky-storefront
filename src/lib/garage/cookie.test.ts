import { describe, expect, it } from "vitest";

import {
	decodeGarageCookie,
	encodeGarageCookie,
	fromVehicleSelection,
	GARAGE_COOKIE_MAX_AGE,
	GARAGE_COOKIE_NAME,
	GARAGE_MAX_VEHICLES,
	type GaragePayload,
	normalizePayload,
	sameVehicle,
	toVehicleSelection,
} from "./cookie";
import { signValue } from "./signature";

const SECRET = "test-secret-not-a-real-one-0123456789";

function payload(count = 3): GaragePayload {
	return {
		v: 1,
		a: 0,
		dv: "fixture-2026-09-04-a",
		c: Array.from({ length: count }, (_, i) => ({
			k: "volkswagen",
			m: `vw-tiguan-${i}`,
			g: `vw-tiguan-2-generation-${i}`,
			y: 2019 + i,
			r: "raised-rails" as const,
			b: "suv" as const,
			d: 5,
		})),
	};
}

describe("round trip", () => {
	it("survives encode and decode with a signature", () => {
		const value = encodeGarageCookie(payload(), SECRET);
		const decoded = decodeGarageCookie(value, { secret: SECRET, requireSignature: true });
		expect(decoded.ok).toBe(true);
		if (decoded.ok) {
			expect(decoded.payload.c).toHaveLength(3);
			expect(decoded.signed).toBe(true);
		}
	});

	it("round-trips a selection without loss", () => {
		const selection = {
			makeId: "skoda",
			modelId: "octavia",
			generationId: "octavia-4",
			year: 2022,
			roofType: "flush-rails" as const,
		};
		expect(toVehicleSelection(fromVehicleSelection(selection))).toEqual(selection);
	});

	it("omits absent qualifiers rather than storing undefined keys", () => {
		const stored = fromVehicleSelection({ makeId: "a", modelId: "b", generationId: "c", year: 2020 });
		expect(Object.keys(stored).sort()).toEqual(["g", "k", "m", "y"]);
	});
});

describe("tampering", () => {
	it("rejects a payload edited after signing", () => {
		const value = encodeGarageCookie(payload(), SECRET);
		const [encoded, signature] = value.split(".");
		const forged = Buffer.from(
			JSON.stringify({ ...payload(), c: [{ k: "x", m: "y", g: "z", y: 2020 }] }),
			"utf8",
		).toString("base64url");
		const result = decodeGarageCookie(`${forged}.${signature}`, { secret: SECRET, requireSignature: true });
		expect(result).toEqual({ ok: false, reason: "bad-signature" });
		expect(encoded).not.toBe(forged);
	});

	it("rejects a value signed with a different secret", () => {
		const value = encodeGarageCookie(payload(), "another-secret-entirely-0123456789");
		expect(decodeGarageCookie(value, { secret: SECRET, requireSignature: true })).toEqual({
			ok: false,
			reason: "bad-signature",
		});
	});

	it("rejects an unsigned value when a signature is required", () => {
		const value = encodeGarageCookie(payload(), null);
		expect(decodeGarageCookie(value, { secret: SECRET, requireSignature: true })).toEqual({
			ok: false,
			reason: "bad-signature",
		});
	});

	it("still rejects a BAD signature in unsigned mode — dev must fail like production", () => {
		const encoded = Buffer.from(JSON.stringify(payload()), "utf8").toString("base64url");
		const result = decodeGarageCookie(`${encoded}.not-the-right-mac`, {
			secret: SECRET,
			requireSignature: false,
		});
		expect(result).toEqual({ ok: false, reason: "bad-signature" });
	});

	it("does not throw on a signature of a wildly different length", () => {
		const encoded = Buffer.from(JSON.stringify(payload()), "utf8").toString("base64url");
		expect(() =>
			decodeGarageCookie(`${encoded}.${"x".repeat(500)}`, { secret: SECRET, requireSignature: true }),
		).not.toThrow();
	});
});

describe("malformed input is a normal state, never a crash", () => {
	it.each([
		["absent", undefined],
		["empty", ""],
		["garbage", "!!!not-base64!!!"],
		["truncated", "eyJ2Ijox"],
	])("handles %s without throwing", (_name, value) => {
		expect(() => decodeGarageCookie(value, { secret: SECRET, requireSignature: false })).not.toThrow();
		const result = decodeGarageCookie(value as string | undefined, {
			secret: SECRET,
			requireSignature: false,
		});
		expect(result.ok).toBe(false);
	});

	it("refuses a payload from a future schema version rather than guessing", () => {
		const encoded = Buffer.from(JSON.stringify({ ...payload(), v: 99 }), "utf8").toString("base64url");
		const value = `${encoded}.${signValue(SECRET, encoded)}`;
		expect(decodeGarageCookie(value, { secret: SECRET, requireSignature: true })).toEqual({
			ok: false,
			reason: "unsupported-version",
		});
	});

	it("validates schema even when the signature is valid — authentic is not the same as sane", () => {
		const encoded = Buffer.from(JSON.stringify({ v: 1, a: 0, c: "not-an-array" }), "utf8").toString(
			"base64url",
		);
		const value = `${encoded}.${signValue(SECRET, encoded)}`;
		expect(decodeGarageCookie(value, { secret: SECRET, requireSignature: true })).toEqual({
			ok: false,
			reason: "schema-invalid",
		});
	});
});

describe("repair rather than discard", () => {
	it("drops malformed entries but keeps the good ones", () => {
		const normalized = normalizePayload({
			v: 1,
			a: 0,
			c: [{ k: "a", m: "b", g: "c", y: 2020 }, { k: "bad" }, { k: "d", m: "e", g: "f", y: 2021 }],
		});
		expect(normalized?.c).toHaveLength(2);
	});

	it("truncates an over-long list to the limit", () => {
		const normalized = normalizePayload({ ...payload(9), c: payload(9).c });
		expect(normalized?.c).toHaveLength(GARAGE_MAX_VEHICLES);
	});

	it("clamps an out-of-range active index instead of pointing at nothing", () => {
		expect(normalizePayload({ v: 1, a: 7, c: payload(2).c })?.a).toBe(0);
		expect(normalizePayload({ v: 1, a: -1, c: payload(2).c })?.a).toBe(0);
	});
});

describe("identity", () => {
	it("treats two identical selections as the same car", () => {
		expect(sameVehicle(payload().c[0]!, payload().c[0]!)).toBe(true);
	});

	it("treats a different roof type as a different car", () => {
		expect(sameVehicle(payload().c[0]!, { ...payload().c[0]!, r: "flush-rails" })).toBe(false);
	});
});

describe("byte budget — measured, not assumed", () => {
	/**
	 * Chromium enforces 4096 bytes over name + value. Next also appends `Expires=` next
	 * to `Max-Age`, so the real Set-Cookie is bigger than the naive sum — that is
	 * included below.
	 *
	 * The point of this test is not the exact number. It is that the limit on saved
	 * vehicles is a USABILITY choice, not a byte constraint, and that a future change
	 * which quietly makes the payload an order of magnitude bigger fails here.
	 */
	const attributes = `; Path=/; Expires=${new Date(
		0,
	).toUTCString()}; Max-Age=${GARAGE_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

	it("keeps a full garage far inside the browser limit", () => {
		const value = encodeGarageCookie(payload(GARAGE_MAX_VEHICLES), SECRET);
		const nameAndValue = Buffer.byteLength(`${GARAGE_COOKIE_NAME}=${value}`, "utf8");
		const fullHeader = nameAndValue + Buffer.byteLength(attributes, "utf8");

		expect(nameAndValue).toBeLessThan(1024);
		expect(fullHeader).toBeLessThan(4096);
	});

	it("uses an encoding that costs nothing on the wire", () => {
		const value = encodeGarageCookie(payload(GARAGE_MAX_VEHICLES), SECRET);
		// base64url's alphabet is untouched by percent-encoding. Raw JSON is not: Next
		// percent-encodes cookie values, which would inflate every brace and quote.
		expect(encodeURIComponent(value)).toBe(value);
		expect(value).not.toContain("=");
	});

	it("has room for several times the vehicle limit, so the limit is a product decision", () => {
		const oversized = encodeGarageCookie({ ...payload(3), c: payload(3).c }, SECRET);
		const perVehicle = Buffer.byteLength(oversized, "utf8") / GARAGE_MAX_VEHICLES;
		expect(perVehicle * 12).toBeLessThan(4096);
	});
});
