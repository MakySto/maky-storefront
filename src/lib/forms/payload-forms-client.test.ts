import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type PayloadNoticeSnapshot, type WithdrawalSubmission } from "../withdrawal/contract";
import { submitWithdrawalToPayload } from "./payload-forms-client";
import { verifyFormsSignature } from "./signature";

const SECRET = "forms-hmac-secret-for-tests";
const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const SUBMISSION: WithdrawalSubmission = {
	submissionId: VALID_UUID,
	source: "guest",
	market: "SK",
	locale: "sk",
	customer: { name: "Jana Nováková", email: "jana@example.sk" },
	contract: { orderNumber: "ORD-1042", saleorOrderId: null, saleorCustomerId: null },
	scope: "wholeOrder",
	items: [],
	note: null,
	legalNoticeVersion: "withdrawal-sk-2026-07-30-v0-DRAFT",
	privacyNoticeVersion: "privacy-sk-2026-07-30-v0-DRAFT",
};

const SNAPSHOT: PayloadNoticeSnapshot = {
	schemaVersion: 1,
	source: "guest",
	market: "SK",
	locale: "sk",
	customer: { name: "Jana Nováková", email: "jana@example.sk" },
	contract: { orderNumber: "ORD-1042" },
	scope: "wholeOrder",
	items: [],
	note: null,
	legalNoticeVersion: "withdrawal-sk-2026-07-30-v0-DRAFT",
	privacyNoticeVersion: "privacy-sk-2026-07-30-v0-DRAFT",
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

	it("sends exactly the keys on Payload's allowlist and nothing else", async () => {
		// The endpoint rejects unknown keys at every level, so one extra field is a 400
		// rather than something it quietly ignores.
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
		// `phone` belongs to the contact endpoint, not this one.
		expect(Object.keys(body.customer as object).sort()).toEqual(["email", "name"]);
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
					emailDelivery: { customerStatus: "sent", internalStatus: "failed" },
				},
			}),
		);
		const sent = await submitWithdrawalToPayload(SUBMISSION);
		expect(sent.status === "ok" && sent.value.emailDelivery).toEqual({
			customerStatus: "sent",
			internalStatus: "failed",
		});

		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		const absent = await submitWithdrawalToPayload(SUBMISSION);
		// Absent means "not known". It must never be read as "failed".
		expect(absent.status === "ok" && absent.value.emailDelivery).toBeNull();
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
