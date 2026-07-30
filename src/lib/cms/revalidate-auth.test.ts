import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	isPayloadRevalidateConfigured,
	readBearerToken,
	verifyPayloadRevalidateSecret,
} from "./revalidate-auth";

const SECRET = "s3cr3t-payload-revalidate-token";

/** A request carrying exactly the headers given, and nothing else. */
function request(
	headers: Record<string, string>,
	url = "https://maky.store/api/revalidate/payload",
): Request {
	return new Request(url, { method: "POST", headers });
}

describe("readBearerToken — Authorization and nothing else", () => {
	it("reads the token Payload sends", () => {
		expect(readBearerToken(request({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
	});

	it("accepts a lowercase scheme, which RFC 7235 says is the same scheme", () => {
		expect(readBearerToken(request({ authorization: `bearer ${SECRET}` }))).toBe(SECRET);
		expect(readBearerToken(request({ authorization: `BEARER ${SECRET}` }))).toBe(SECRET);
	});

	it("REFUSES a secret in the query string, however valid it is", () => {
		// The regression this guards: `extractBearerToken` in api-auth.ts accepts
		// `?secret=`, and reusing it here would put the CMS secret into nginx access
		// logs, proxy logs, APM traces and Referer headers.
		expect(
			readBearerToken(request({}, `https://maky.store/api/revalidate/payload?secret=${SECRET}`)),
		).toBeNull();
	});

	it("REFUSES the x-revalidate-secret header the Saleor helper also accepts", () => {
		expect(readBearerToken(request({ "x-revalidate-secret": SECRET }))).toBeNull();
	});

	it("refuses other authentication schemes", () => {
		expect(readBearerToken(request({ authorization: `Basic ${SECRET}` }))).toBeNull();
		expect(readBearerToken(request({ authorization: `Token ${SECRET}` }))).toBeNull();
	});

	it("refuses a malformed Authorization header", () => {
		expect(readBearerToken(request({ authorization: SECRET }))).toBeNull();
		expect(readBearerToken(request({ authorization: "Bearer" }))).toBeNull();
		expect(readBearerToken(request({ authorization: "Bearer " }))).toBeNull();
		expect(readBearerToken(request({ authorization: "" }))).toBeNull();
	});

	it("refuses a missing Authorization header", () => {
		expect(readBearerToken(request({}))).toBeNull();
	});

	it("does not trim the token itself — a secret is bytes, not a trimmed string", () => {
		// Only the single space after the scheme is a delimiter; everything after it is
		// the token. The trailing space is absent not because this function trimmed it
		// but because `Headers` normalises leading and trailing whitespace off a header
		// value before anyone can read it — so a secret must never rely on edge
		// whitespace surviving the wire.
		expect(readBearerToken(request({ authorization: "Bearer  padded " }))).toBe(" padded");
		expect(readBearerToken(request({ authorization: "Bearer tok en" }))).toBe("tok en");
	});
});

describe("verifyPayloadRevalidateSecret", () => {
	const original = process.env.PAYLOAD_REVALIDATE_SECRET;

	beforeEach(() => {
		process.env.PAYLOAD_REVALIDATE_SECRET = SECRET;
	});

	afterEach(() => {
		if (original === undefined) delete process.env.PAYLOAD_REVALIDATE_SECRET;
		else process.env.PAYLOAD_REVALIDATE_SECRET = original;
	});

	it("accepts the configured secret", () => {
		expect(verifyPayloadRevalidateSecret(SECRET)).toBe(true);
	});

	it("rejects a wrong secret of the same length", () => {
		expect(verifyPayloadRevalidateSecret("x".repeat(SECRET.length))).toBe(false);
	});

	it("rejects a prefix, without letting the length compare throw", () => {
		expect(verifyPayloadRevalidateSecret(SECRET.slice(0, -1))).toBe(false);
		expect(verifyPayloadRevalidateSecret(`${SECRET}x`)).toBe(false);
	});

	it("rejects null, undefined and the empty string", () => {
		expect(verifyPayloadRevalidateSecret(null)).toBe(false);
		expect(verifyPayloadRevalidateSecret(undefined)).toBe(false);
		expect(verifyPayloadRevalidateSecret("")).toBe(false);
	});

	it("fails closed when no secret is configured — nobody authenticates", () => {
		delete process.env.PAYLOAD_REVALIDATE_SECRET;
		expect(verifyPayloadRevalidateSecret(SECRET)).toBe(false);
		expect(verifyPayloadRevalidateSecret("")).toBe(false);
		expect(isPayloadRevalidateConfigured()).toBe(false);
	});

	it("reads the secret at call time, so .env changes do not need a restart", () => {
		process.env.PAYLOAD_REVALIDATE_SECRET = "rotated-secret";
		expect(verifyPayloadRevalidateSecret("rotated-secret")).toBe(true);
		expect(verifyPayloadRevalidateSecret(SECRET)).toBe(false);
	});
});
