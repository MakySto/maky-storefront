import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	CONTACT_ENDPOINT,
	CONTACT_LIMITS,
	CONTACT_MARKET_LOCALES,
	CONTACT_SOURCES,
	CONTACT_TOPICS,
	isAllowedMarketLocale,
	parseContactAccepted,
} from "./contact-contract";
import { signFormsRequest } from "./signature";

/**
 * Our reading of the Contact contract, checked against the provider's own.
 *
 * Every constant in `contact-contract.ts` is read back out of the vendored manifest
 * here instead of being restated. The storefront and Payload previously each held a
 * private idea of the wire format and both suites were green while every real request
 * would have failed; a constant that agrees with a comment rather than with the
 * provider is the same failure in slower motion.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/forms-backend-v1");
const read = (rel: string) => readFileSync(join(PACK, rel));
const readJson = (rel: string) => JSON.parse(read(rel).toString("utf8")) as Record<string, never>;

const manifest = readJson("manifest.json") as unknown as {
	revision: string;
	contactContract: {
		endpoint: string;
		maxBodyBytes: number;
		timestampSkewSeconds: number;
		sourceValues: string[];
		topicValues: string[];
		successCases: { name: string; httpStatus: number; duplicate: boolean; fixture: string }[];
		errorCases: { name: string; httpStatus: number; code: string; fixture: string }[];
		signatureVector: {
			timestamp: string;
			testSecretUtf8: string;
			rawBodyFixture: string;
			rawBodySha256: string;
			expectedSignature: string;
		};
	};
};

const contact = manifest.contactContract;

describe("our constants are the provider's", () => {
	it("targets the endpoint the manifest names", () => {
		expect(`${CONTACT_ENDPOINT}`).toBe(contact.endpoint.replace("POST ", ""));
	});

	it("uses the provider's body limit and clock skew", () => {
		expect(CONTACT_LIMITS.bodyBytes).toBe(contact.maxBodyBytes);
		expect(CONTACT_LIMITS.timestampSkewSeconds).toBe(contact.timestampSkewSeconds);
	});

	it("accepts exactly the provider's sources and topics", () => {
		expect([...CONTACT_SOURCES]).toEqual(contact.sourceValues);
		expect([...CONTACT_TOPICS]).toEqual(contact.topicValues);
	});

	it("accepts exactly the provider's market/locale pairs", () => {
		const fixture = readJson("fixtures/contact-market-locales.json") as unknown as {
			pairs: { market: string; locale: string }[];
		};
		const fromFixture = Object.fromEntries(fixture.pairs.map((p) => [p.market, p.locale]));
		expect(CONTACT_MARKET_LOCALES).toEqual(fromFixture);
		// Twelve markets, ten locales — the two shared pairs are the point.
		expect(Object.keys(fromFixture)).toHaveLength(12);
		expect(new Set(Object.values(fromFixture)).size).toBe(10);
	});

	it("rejects a pair whose halves are each individually valid", () => {
		expect(isAllowedMarketLocale("SK", "sk")).toBe(true);
		expect(isAllowedMarketLocale("AT", "de")).toBe(true);
		expect(isAllowedMarketLocale("CA", "en")).toBe(true);
		// `DE` is a market and `sk` is a locale; together they are not a request.
		expect(isAllowedMarketLocale("DE", "sk")).toBe(false);
		expect(isAllowedMarketLocale("XX", "sk")).toBe(false);
	});
});

describe("the signing vector", () => {
	const vector = contact.signatureVector;

	it("signs the fixture's exact bytes, trailing newline included", () => {
		const raw = read(vector.rawBodyFixture);
		// If the file were reformatted the bytes would change and the vector would be
		// meaningless — which is why the pack is in `.prettierignore`.
		expect(createHash("sha256").update(raw).digest("hex")).toBe(vector.rawBodySha256);
		expect(raw[raw.length - 1]).toBe(0x0a);
	});

	it("reproduces the provider's expected signature", () => {
		const raw = read(vector.rawBodyFixture);
		const preimage = Buffer.concat([Buffer.from(`${vector.timestamp}.`), raw]);
		const signature = createHmac("sha256", Buffer.from(vector.testSecretUtf8, "utf8"))
			.update(preimage)
			.digest("hex");
		expect(signature).toBe(vector.expectedSignature);
	});

	it("and our own signer produces the same value", () => {
		// The shared `signFormsRequest` is what the transport actually calls, so it —
		// not a local re-implementation — has to satisfy the vector.
		const raw = read(vector.rawBodyFixture).toString("utf8");
		expect(signFormsRequest(vector.testSecretUtf8, vector.timestamp, raw)).toBe(vector.expectedSignature);
	});
});

describe("acknowledgements are read as the provider writes them", () => {
	it("accepts the create fixture as a non-duplicate", () => {
		const create = contact.successCases.find((c) => c.name === "create")!;
		const accepted = parseContactAccepted(readJson(create.fixture), false);
		expect(accepted).not.toBeNull();
		expect(accepted?.submissionNumber).toMatch(/^KON-\d{4}-\d{6}$/);
		expect(accepted?.duplicate).toBe(false);
		// Both channels are reported, and both start unattempted.
		expect(accepted?.emailDelivery.customerStatus).toBe("pending");
		expect(accepted?.emailDelivery.internalAttemptCount).toBe(0);
	});

	it("accepts the duplicate fixture as a duplicate", () => {
		const dup = contact.successCases.find((c) => c.name === "idempotentDuplicate")!;
		expect(parseContactAccepted(readJson(dup.fixture), true)?.duplicate).toBe(true);
	});

	it("refuses an acknowledgement whose duplicate flag contradicts the status line", () => {
		const create = contact.successCases.find((c) => c.name === "create")!;
		// A 200 (replay) carrying `duplicate: false` would tell the customer their
		// message was filed now when the provider said it already existed.
		expect(parseContactAccepted(readJson(create.fixture), true)).toBeNull();
	});

	it("refuses an error envelope, however well formed", () => {
		for (const errorCase of contact.errorCases) {
			expect(parseContactAccepted(readJson(errorCase.fixture), false)).toBeNull();
			expect(parseContactAccepted(readJson(errorCase.fixture), true)).toBeNull();
		}
	});

	it("refuses a submission number in the withdrawal series", () => {
		const create = contact.successCases.find((c) => c.name === "create")!;
		const body = readJson(create.fixture) as unknown as {
			submission: { submissionNumber: string };
		};
		body.submission.submissionNumber = "ODS-2026-000001";
		expect(parseContactAccepted(body, false)).toBeNull();
	});
});
