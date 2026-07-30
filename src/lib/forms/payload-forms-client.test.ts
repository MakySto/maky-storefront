import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContractSchemaValidator } from "./contract-schema-validator";

import {
	PRIVACY_NOTICE_VERSION,
	LEGAL_NOTICE_VERSION,
	type PayloadNoticeSnapshot,
	type WithdrawalSubmission,
} from "../withdrawal/contract";
import { submitWithdrawalToPayload } from "./payload-forms-client";
import { verifyFormsSignature } from "./signature";

const contractValidator = new ContractSchemaValidator(
	JSON.parse(
		readFileSync(
			join(
				fileURLToPath(new URL(".", import.meta.url)),
				"__fixtures__/forms-backend-v1/withdrawal.schema.json",
			),
			"utf8",
		),
	) as Record<string, unknown>,
);

const SECRET = "forms-hmac-secret-for-tests";
const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const SUBMISSION: WithdrawalSubmission = {
	submissionId: VALID_UUID,
	source: "guest",
	market: "SK",
	locale: "sk",
	customer: { name: "Jana Nováková", email: "jana@example.sk", phone: null },
	contract: { orderNumber: "ORD-1042", saleorOrderId: null, saleorCustomerId: null },
	scope: "wholeOrder",
	items: [],
	note: null,
	legalNoticeVersion: LEGAL_NOTICE_VERSION,
	privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};

const SNAPSHOT: PayloadNoticeSnapshot = {
	schemaVersion: 1,
	source: "guest",
	market: "SK",
	locale: "sk",
	customer: { name: "Jana Nováková", email: "jana@example.sk", phone: null },
	contract: { orderNumber: "ORD-1042" },
	scope: "wholeOrder",
	items: [],
	note: null,
	legalNoticeVersion: LEGAL_NOTICE_VERSION,
	privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};

const ACCEPTED_BODY = {
	ok: true,
	duplicate: false,
	submission: {
		id: "018f1000-0000-7000-8000-000000000001",
		submissionId: VALID_UUID,
		submissionNumber: "ODS-2026-000042",
		submittedAt: "2026-07-30T09:12:33.123Z",
		noticeSnapshot: SNAPSHOT,
	},
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ORIGINAL_ENV = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	process.env.PAYLOAD_CMS_URL = "https://cms.example.test/";
	process.env.PAYLOAD_CF_ACCESS_CLIENT_ID = "cf-client-id";
	process.env.PAYLOAD_CF_ACCESS_CLIENT_SECRET = "cf-client-secret";
	process.env.MAKY_FORMS_HMAC_SECRET = SECRET;
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function lastRequest(): { url: string; init: RequestInit; headers: Record<string, string> } {
	const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
	return { url, init, headers: init.headers as Record<string, string> };
}

describe("submitWithdrawalToPayload — the wire contract", () => {
	it("posts to the signed forms endpoint, never to the raw collection", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const { url, init } = lastRequest();
		expect(url).toBe("https://cms.example.test/api/forms/withdrawal");
		// Raw REST create is refused by the collection even for an authenticated admin.
		expect(url).not.toContain("/api/withdrawal-requests");
		expect(init.method).toBe("POST");
		expect(url).not.toContain("//api/");
	});

	it("sends the timestamp in SECONDS, ten digits", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);
		expect(lastRequest().headers["X-Maky-Forms-Timestamp"]).toMatch(/^\d{10}$/);
	});

	it("signs the EXACT bytes it sends, with no second serialisation", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const { init, headers } = lastRequest();
		const sentBytes = init.body as string;

		// The whole point: verifying against the body that actually went out, not
		// against a re-stringified object that might order keys differently.
		expect(
			verifyFormsSignature({
				secret: SECRET,
				timestamp: headers["X-Maky-Forms-Timestamp"] as string,
				rawBody: sentBytes,
				signature: headers["X-Maky-Forms-Signature"] as string,
				nowSeconds: Math.floor(Date.now() / 1000),
			}),
		).toEqual({ ok: true });

		// And a re-serialisation of the same object must be byte-identical, or the
		// signature would have been over something else.
		expect(sentBytes).toBe(JSON.stringify(SUBMISSION));
	});

	it("sends NO noticeSnapshot — Payload builds and owns it", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const body = JSON.parse(lastRequest().init.body as string) as Record<string, unknown>;
		expect(body).not.toHaveProperty("noticeSnapshot");
	});

	it("sends a body the vendored contract accepts, byte for byte", async () => {
		// Asserted against the schema Payload published, not against a list written here.
		// A hand-kept allowlist is a second copy of the rules, and a second copy is what
		// let three mismatches through a green suite.
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const sentBytes = lastRequest().init.body as string;
		const violations = contractValidator
			.validate(JSON.parse(sentBytes))
			.map((v) => `${v.path} [${v.keyword}] ${v.message}`);
		expect(violations).toEqual([]);
	});

	it("sends exactly the keys on Payload's allowlist and nothing else", async () => {
		// Kept alongside the schema check because it names the keys in the failure output,
		// which is what someone reading a red CI log actually needs.
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const body = JSON.parse(lastRequest().init.body as string) as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual([
			"contract",
			"customer",
			"items",
			"legalNoticeVersion",
			"locale",
			"market",
			"note",
			"privacyNoticeVersion",
			"scope",
			"source",
			"submissionId",
		]);
		// `phone` joined the allowlist in contract 1.1.0 — optional, but always sent, as
		// an explicit `null` when the customer gave none.
		expect(Object.keys(body.customer as object).sort()).toEqual(["email", "name", "phone"]);
		expect(Object.keys(body.contract as object).sort()).toEqual([
			"orderNumber",
			"saleorCustomerId",
			"saleorOrderId",
		]);
	});

	it("carries the CF Access token and the submission-id header, and no Payload auth", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const { headers } = lastRequest();
		expect(headers["CF-Access-Client-Id"]).toBe("cf-client-id");
		expect(headers["CF-Access-Client-Secret"]).toBe("cf-client-secret");
		expect(headers["X-Maky-Forms-Submission-Id"]).toBe(VALID_UUID);
		expect(headers.Authorization ?? headers.authorization).toBeUndefined();
	});

	it("never follows a redirect, because Access answers 302 with an HTML login page", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);
		expect(lastRequest().init.redirect).toBe("manual");
	});

	it("refuses a body over 64 KiB locally rather than spending a round trip on a 413", async () => {
		const huge = { ...SUBMISSION, note: "x".repeat(70_000) };
		const result = await submitWithdrawalToPayload(huge);
		expect(result).toEqual({ status: "rejected", httpStatus: 413, code: "BODY_TOO_LARGE" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("submitWithdrawalToPayload — the response is authoritative", () => {
	it("returns Payload's id, number, timestamp and stored snapshot", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.value.id).toBe("018f1000-0000-7000-8000-000000000001");
		expect(result.value.submissionNumber).toBe("ODS-2026-000042");
		expect(result.value.submittedAt).toBe("2026-07-30T09:12:33.123Z");
		expect(result.value.noticeSnapshot).toEqual(SNAPSHOT);
		expect(result.value.duplicate).toBe(false);
		expect(result.value.emailDelivery).toBeNull();
	});

	it("treats a 200 as the idempotent replay, preserving the ORIGINAL time and snapshot", async () => {
		const original = {
			...ACCEPTED_BODY,
			duplicate: true,
			submission: {
				...ACCEPTED_BODY.submission,
				submittedAt: "2026-07-30T08:00:00.000Z",
				noticeSnapshot: { ...SNAPSHOT, note: "pôvodná poznámka" },
			},
		};
		fetchMock.mockResolvedValue(jsonResponse(200, original));

		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.value.duplicate).toBe(true);
		expect(result.value.submittedAt).toBe("2026-07-30T08:00:00.000Z");
		expect(result.value.noticeSnapshot.note).toBe("pôvodná poznámka");
	});

	it("reads delivery status when present, and leaves it null when absent", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(201, {
				...ACCEPTED_BODY,
				submission: {
					...ACCEPTED_BODY.submission,
					emailDelivery: {
						customerStatus: "sent",
						customerSentAt: "2026-07-30T12:00:01.000Z",
						customerAttemptCount: 1,
						customerLastAttemptAt: "2026-07-30T12:00:00.500Z",
						internalStatus: "failed",
						internalSentAt: null,
						internalAttemptCount: 2,
						internalLastAttemptAt: "2026-07-30T12:00:02.000Z",
					},
				},
			}),
		);
		const sent = await submitWithdrawalToPayload(SUBMISSION);
		expect(sent.status === "ok" && sent.value.emailDelivery).toEqual({
			customerStatus: "sent",
			customerSentAt: "2026-07-30T12:00:01.000Z",
			customerAttemptCount: 1,
			customerLastAttemptAt: "2026-07-30T12:00:00.500Z",
			internalStatus: "failed",
			internalSentAt: null,
			internalAttemptCount: 2,
			internalLastAttemptAt: "2026-07-30T12:00:02.000Z",
		});

		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		const absent = await submitWithdrawalToPayload(SUBMISSION);
		// Absent means "not known". It must never be read as "failed".
		expect(absent.status === "ok" && absent.value.emailDelivery).toBeNull();
	});

	it("keeps an `unknown` delivery status instead of discarding the whole object", async () => {
		// Contract 1.1.0 added `unknown` — an SMTP attempt with an ambiguous outcome. The
		// parser used to return null for the entire delivery object when it met a status it
		// did not recognise, which downgraded a CONFIRMED-sent customer e-mail to
		// "unreported" and hid the one case the contract says needs reconciliation.
		fetchMock.mockResolvedValue(
			jsonResponse(201, {
				...ACCEPTED_BODY,
				submission: {
					...ACCEPTED_BODY.submission,
					emailDelivery: {
						customerStatus: "sent",
						customerSentAt: "2026-07-30T12:00:01.000Z",
						customerAttemptCount: 1,
						customerLastAttemptAt: "2026-07-30T12:00:00.500Z",
						internalStatus: "unknown",
						internalSentAt: null,
						internalAttemptCount: 1,
						internalLastAttemptAt: "2026-07-30T12:00:02.000Z",
					},
				},
			}),
		);

		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.value.emailDelivery?.customerStatus).toBe("sent");
		expect(result.value.emailDelivery?.internalStatus).toBe("unknown");
	});

	it("still refuses a delivery status that is not in the contract at all", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(201, {
				...ACCEPTED_BODY,
				submission: {
					...ACCEPTED_BODY.submission,
					emailDelivery: { customerStatus: "teleported", internalStatus: "sent" },
				},
			}),
		);
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status === "ok" && result.value.emailDelivery).toBeNull();
	});

	it("degrades missing attempt metadata to null rather than to zero", async () => {
		// Zero attempts and "nobody told us" are different facts, and an operator reading
		// the admin needs them to stay different.
		fetchMock.mockResolvedValue(
			jsonResponse(201, {
				...ACCEPTED_BODY,
				submission: {
					...ACCEPTED_BODY.submission,
					emailDelivery: { customerStatus: "pending", internalStatus: "pending" },
				},
			}),
		);
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status === "ok" && result.value.emailDelivery?.customerAttemptCount).toBeNull();
		expect(result.status === "ok" && result.value.emailDelivery?.customerSentAt).toBeNull();
	});

	it("refuses a success whose snapshot is missing or malformed", async () => {
		// A receipt with nothing behind it would be worse than an error.
		for (const submission of [
			{ ...ACCEPTED_BODY.submission, noticeSnapshot: undefined },
			{ ...ACCEPTED_BODY.submission, noticeSnapshot: {} },
			{ ...ACCEPTED_BODY.submission, id: undefined },
		]) {
			fetchMock.mockResolvedValue(jsonResponse(200, { ...ACCEPTED_BODY, submission }));
			expect((await submitWithdrawalToPayload(SUBMISSION)).status).toBe("unavailable");
		}
	});
});

describe("submitWithdrawalToPayload — outcome classification", () => {
	it.each([
		["a 302 from Cloudflare Access", 302],
		["a 500 with no contract body", 500],
		["a 502 from a proxy", 502],
	])("classifies %s as unavailable, so the caller may retry", async (_label, status) => {
		fetchMock.mockResolvedValue(new Response("<html>Sign in</html>", { status }));
		expect((await submitWithdrawalToPayload(SUBMISSION)).status).toBe("unavailable");
	});

	it("treats FORMS_INTERNAL_ERROR as transient rather than as a refusal", async () => {
		fetchMock.mockResolvedValue(jsonResponse(500, { ok: false, error: { code: "FORMS_INTERNAL_ERROR" } }));
		expect((await submitWithdrawalToPayload(SUBMISSION)).status).toBe("unavailable");
	});

	it.each([
		[400, "INVALID_REQUEST"],
		[401, "INVALID_TIMESTAMP"],
		[401, "STALE_TIMESTAMP"],
		[401, "INVALID_SIGNATURE"],
		[409, "SUBMISSION_ID_CONFLICT"],
		[413, "BODY_TOO_LARGE"],
		[503, "FORMS_AUTH_UNAVAILABLE"],
	])("maps HTTP %s %s to a rejected outcome carrying the code", async (status, code) => {
		fetchMock.mockResolvedValue(jsonResponse(status, { ok: false, error: { code, message: "…" } }));
		expect(await submitWithdrawalToPayload(SUBMISSION)).toEqual({
			status: "rejected",
			httpStatus: status,
			code,
		});
	});

	it("normalises an unrecognised code rather than passing it through", async () => {
		fetchMock.mockResolvedValue(jsonResponse(400, { ok: false, error: { code: "SOMETHING_NEW" } }));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status === "rejected" && result.code).toBe("UNKNOWN");
	});

	it("classifies a timeout and a network error as unavailable", async () => {
		fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
		const timeout = await submitWithdrawalToPayload(SUBMISSION);
		expect(timeout.status === "unavailable" && timeout.reason).toContain("timeout");

		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		expect(await submitWithdrawalToPayload(SUBMISSION)).toEqual({
			status: "unavailable",
			reason: "network error",
		});
	});

	it("reports missing settings distinctly, because retrying will not help", async () => {
		delete process.env.MAKY_FORMS_HMAC_SECRET;
		expect(await submitWithdrawalToPayload(SUBMISSION)).toEqual({
			status: "notConfigured",
			missing: ["MAKY_FORMS_HMAC_SECRET"],
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("submitWithdrawalToPayload — logs", () => {
	it("never writes a secret, the notice or the customer into a log line", async () => {
		fetchMock.mockResolvedValue(jsonResponse(500, {}));
		await submitWithdrawalToPayload(SUBMISSION);

		const logged = logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
		expect(logged).not.toContain(SECRET);
		expect(logged).not.toContain("cf-client-secret");
		expect(logged).not.toContain("jana@example.sk");
		expect(logged).not.toContain("Jana Nováková");
		// It still says enough to act on: which submission, and why.
		expect(logged).toContain(VALID_UUID);
		expect(logged).toMatch(/\[forms\] (rejected|upstream-status|fetch-failed)/);
	});

	it("logs Payload's error CODE and never its message text", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(400, {
				ok: false,
				error: { code: "INVALID_REQUEST", message: "customer.phone is not allowed for jana@example.sk" },
			}),
		);
		await submitWithdrawalToPayload(SUBMISSION);

		const logged = logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
		expect(logged).toContain("INVALID_REQUEST");
		expect(logged).not.toContain("is not allowed");
		expect(logged).not.toContain("jana@example.sk");
	});
});
