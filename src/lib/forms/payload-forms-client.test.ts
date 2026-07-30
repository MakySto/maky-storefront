import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type WithdrawalSubmission } from "../withdrawal/contract";
import { submitWithdrawalToPayload, updateWithdrawalEmailDelivery } from "./payload-forms-client";
import { verifyFormsSignature } from "./signature";

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
	noticeSnapshot: "ODSTÚPENIE OD ZMLUVY\n…",
	legalNoticeVersion: "sk-withdrawal-DRAFT-2026-07-30",
	privacyNoticeVersion: "sk-privacy-DRAFT-2026-07-30",
};

const ACCEPTED_BODY = {
	ok: true,
	duplicate: false,
	submission: {
		submissionId: VALID_UUID,
		submissionNumber: "ODS-2026-000042",
		submittedAt: "2026-07-30T09:12:33.123Z",
		orderMatchStatus: "matched",
	},
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
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

describe("submitWithdrawalToPayload — the request on the wire", () => {
	it("posts to the signed forms endpoint, never to the raw collection", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://cms.example.test/api/forms/withdrawal");
		// The raw REST create is off-limits: the collection refuses anonymous creates
		// and the endpoint is what applies the server-owned rules.
		expect(url).not.toContain("/api/withdrawal-requests");
		expect(init.method).toBe("POST");
	});

	it("strips a trailing slash so Access does not redirect the request away", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);
		expect(fetchMock.mock.calls[0]?.[0]).not.toContain("//api/");
	});

	it("carries both the CF Access token and a signature over exactly the bytes sent", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;

		expect(headers["CF-Access-Client-Id"]).toBe("cf-client-id");
		expect(headers["CF-Access-Client-Secret"]).toBe("cf-client-secret");
		expect(headers["X-Maky-Forms-Submission-Id"]).toBe(VALID_UUID);
		// No Payload Authorization header — this is not an admin session.
		expect(headers.Authorization ?? headers.authorization).toBeUndefined();

		const verified = verifyFormsSignature({
			secret: SECRET,
			timestamp: headers["X-Maky-Forms-Timestamp"] as string,
			rawBody: init.body as string,
			signature: headers["X-Maky-Forms-Signature"] as string,
			now: Date.now(),
		});
		expect(verified).toEqual({ ok: true });
	});

	it("never follows a redirect, because Access answers with 302 and an HTML login page", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		await submitWithdrawalToPayload(SUBMISSION);
		expect((fetchMock.mock.calls[0]?.[1] as RequestInit).redirect).toBe("manual");
	});
});

describe("submitWithdrawalToPayload — outcome classification", () => {
	it("returns the accepted record on 201", async () => {
		fetchMock.mockResolvedValue(jsonResponse(201, ACCEPTED_BODY));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result).toEqual({
			status: "ok",
			value: {
				submissionId: VALID_UUID,
				submissionNumber: "ODS-2026-000042",
				submittedAt: "2026-07-30T09:12:33.123Z",
				orderMatchStatus: "matched",
				duplicate: false,
			},
		});
	});

	it("treats a 200 as the idempotent replay of an existing submission", async () => {
		fetchMock.mockResolvedValue(jsonResponse(200, { ...ACCEPTED_BODY, duplicate: true }));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") return;
		expect(result.value.duplicate).toBe(true);
		expect(result.value.submissionNumber).toBe("ODS-2026-000042");
	});

	it("infers duplicate from the status code when the body omits the flag", async () => {
		const { duplicate: _omitted, ...withoutFlag } = ACCEPTED_BODY;
		fetchMock.mockResolvedValue(jsonResponse(200, withoutFlag));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status === "ok" && result.value.duplicate).toBe(true);
	});

	it.each([
		["a 302 from Cloudflare Access", 302],
		["a 500", 500],
		["a 502", 502],
	])("classifies %s as unavailable, so the caller may retry", async (_label, status) => {
		fetchMock.mockResolvedValue(new Response("<html>Sign in</html>", { status }));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("unavailable");
	});

	it("classifies a 4xx as rejected, which is our bug rather than the customer's", async () => {
		fetchMock.mockResolvedValue(jsonResponse(422, { ok: false, error: { code: "invalidBody" } }));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result).toEqual({ status: "rejected", httpStatus: 422, code: "invalidBody" });
	});

	it("classifies a timeout as unavailable", async () => {
		fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result.status).toBe("unavailable");
		if (result.status !== "unavailable") return;
		expect(result.reason).toContain("timeout");
	});

	it("classifies a network error as unavailable", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result).toEqual({ status: "unavailable", reason: "network error" });
	});

	it("refuses a 200 whose body does not match the contract", async () => {
		// A success we cannot read is not a success: reporting it as stored would hand
		// the customer a receipt with no submission number behind it.
		for (const body of [{ ok: true }, { ok: true, submission: {} }, { ok: false }]) {
			fetchMock.mockResolvedValue(jsonResponse(200, body));
			expect((await submitWithdrawalToPayload(SUBMISSION)).status).toBe("unavailable");
		}
	});

	it("refuses a 200 carrying an unparseable body", async () => {
		fetchMock.mockResolvedValue(new Response("{", { status: 200 }));
		expect((await submitWithdrawalToPayload(SUBMISSION)).status).toBe("unavailable");
	});

	it("reports missing settings distinctly, because retrying will not help", async () => {
		delete process.env.MAKY_FORMS_HMAC_SECRET;
		const result = await submitWithdrawalToPayload(SUBMISSION);
		expect(result).toEqual({ status: "notConfigured", missing: ["MAKY_FORMS_HMAC_SECRET"] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("submitWithdrawalToPayload — logs", () => {
	it("never writes the secret, the notice or the customer into a log line", async () => {
		fetchMock.mockResolvedValue(jsonResponse(500, {}));
		await submitWithdrawalToPayload(SUBMISSION);

		const logged = logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
		expect(logged).not.toContain(SECRET);
		expect(logged).not.toContain("cf-client-secret");
		expect(logged).not.toContain("jana@example.sk");
		expect(logged).not.toContain("Jana Nováková");
		expect(logged).not.toContain("ODSTÚPENIE OD ZMLUVY");
		// It does say enough to act on.
		expect(logged).toContain("upstream-status");
		expect(logged).toContain(VALID_UUID);
	});
});

describe("updateWithdrawalEmailDelivery", () => {
	it("targets the delivery-only endpoint for that submission", async () => {
		fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
		await updateWithdrawalEmailDelivery(VALID_UUID, { customerStatus: "sent", internalStatus: "sent" });

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`https://cms.example.test/api/forms/withdrawal/${VALID_UUID}/email-delivery`);

		// It may only ever carry delivery fields — the submitted notice is immutable.
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual(["emailDelivery", "submissionId"]);
	});

	it("reports failure without throwing, because this step must not undo a receipt", async () => {
		fetchMock.mockResolvedValue(jsonResponse(503, {}));
		const result = await updateWithdrawalEmailDelivery(VALID_UUID, {
			customerStatus: "failed",
			internalStatus: "sent",
		});
		expect(result.status).toBe("unavailable");
	});
});
