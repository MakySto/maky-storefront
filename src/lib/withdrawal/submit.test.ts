import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type EmailDeliveryState, type PayloadNoticeSnapshot, type WithdrawalAccepted } from "./contract";
import { renderNoticeFromSnapshot } from "./notice";
import { submitWithdrawal, type PersistPort, type SubmitDeps } from "./submit";
import { type RawWithdrawalInput } from "./validate";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/**
 * The six attempt fields contract 1.1.0 added, defaulted so a test can state only the
 * statuses it cares about. Nullable on purpose: absent metadata means "not reported",
 * which is not the same as zero attempts.
 */
function DELIVERY(statuses: {
	customerStatus: EmailDeliveryState["customerStatus"];
	internalStatus: EmailDeliveryState["internalStatus"];
}): EmailDeliveryState {
	return {
		customerSentAt: null,
		customerAttemptCount: null,
		customerLastAttemptAt: null,
		internalSentAt: null,
		internalAttemptCount: null,
		internalLastAttemptAt: null,
		...statuses,
	};
}

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
	legalNoticeVersion: "withdrawal-sk-2026-07-30-v0-DRAFT",
	privacyNoticeVersion: "privacy-sk-2026-07-30-v0-DRAFT",
};

const ACCEPTED: WithdrawalAccepted = {
	id: "018f1000-0000-7000-8000-000000000001",
	submissionId: VALID_UUID,
	submissionNumber: "ODS-2026-000042",
	submittedAt: "2026-07-30T09:12:33.123Z",
	noticeSnapshot: SNAPSHOT,
	orderMatchStatus: "matched",
	duplicate: false,
	emailDelivery: null,
};

function raw(overrides: Partial<RawWithdrawalInput> = {}): RawWithdrawalInput {
	return {
		submissionId: VALID_UUID,
		source: "guest",
		market: "SK",
		locale: "sk",
		name: "Jana Nováková",
		email: "jana@example.sk",
		phone: null,
		orderNumber: "ORD-1042",
		scope: "wholeOrder",
		items: [],
		note: null,
		...overrides,
	};
}

function deps(overrides: Partial<SubmitDeps> = {}): SubmitDeps {
	return {
		persist: (async () => ({ status: "ok", value: ACCEPTED })) as PersistPort,
		...overrides,
	};
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	errorSpy.mockRestore();
});

describe("submitWithdrawal — the body sent to Payload", () => {
	it("contains exactly the allowed keys, and never a server-owned one", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(raw(), deps({ persist }));

		const body = persist.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
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
		// Payload builds these four and rejects them in a create request.
		for (const serverOwned of ["noticeSnapshot", "submittedAt", "submissionNumber", "emailDelivery"]) {
			expect(body).not.toHaveProperty(serverOwned);
		}
		expect(Object.keys(body.customer as object).sort()).toEqual(["email", "name", "phone"]);
	});

	it("takes Saleor ids only from the server, never from the request", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));

		await submitWithdrawal(raw(), deps({ persist }));
		expect(persist.mock.calls[0]?.[0].contract).toEqual({
			orderNumber: "ORD-1042",
			saleorOrderId: null,
			saleorCustomerId: null,
		});

		persist.mockClear();
		await submitWithdrawal(
			raw(),
			deps({ persist, verifiedOrder: { saleorOrderId: "T3JkZXI6MQ==", saleorCustomerId: null } }),
		);
		expect(persist.mock.calls[0]?.[0].contract.saleorOrderId).toBe("T3JkZXI6MQ==");
	});

	it("carries structured items for a guest partial withdrawal", async () => {
		// A note is not a substitute: Payload requires items[] when the scope is
		// selectedItems, so without these a guest could not withdraw from part of an
		// order at all — a right that does not depend on having an account.
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(
			raw({
				scope: "selectedItems",
				items: [
					{ orderLineId: null, productName: "Strešný box Thule", sku: "TH-6299", quantity: 2 },
					{ orderLineId: null, productName: "Nosič bicyklov", quantity: 1 },
				],
			}),
			deps({ persist }),
		);

		expect(persist.mock.calls[0]?.[0].items).toEqual([
			{ orderLineId: null, productName: "Strešný box Thule", sku: "TH-6299", quantity: 2 },
			{ orderLineId: null, productName: "Nosič bicyklov", sku: null, quantity: 1 },
		]);
	});
});

describe("submitWithdrawal — persistence failed, so nothing was received", () => {
	it.each([
		["timeout", { status: "unavailable", reason: "timeout after 8000ms" }, "unavailable", null],
		["5xx", { status: "unavailable", reason: "upstream HTTP 502" }, "unavailable", null],
		["4xx", { status: "rejected", httpStatus: 400, code: "INVALID_REQUEST" }, "rejected", "INVALID_REQUEST"],
		[
			"conflict",
			{ status: "rejected", httpStatus: 409, code: "SUBMISSION_ID_CONFLICT" },
			"rejected",
			"SUBMISSION_ID_CONFLICT",
		],
		[
			"auth unavailable",
			{ status: "rejected", httpStatus: 503, code: "FORMS_AUTH_UNAVAILABLE" },
			"rejected",
			"FORMS_AUTH_UNAVAILABLE",
		],
		[
			"not configured",
			{ status: "notConfigured", missing: ["MAKY_FORMS_HMAC_SECRET"] },
			"notConfigured",
			null,
		],
	])("reports %s as not received, carrying the code", async (_label, persisted, reason, code) => {
		const result = await submitWithdrawal(
			raw(),
			deps({ persist: (async () => persisted) as unknown as PersistPort }),
		);
		expect(result.status).toBe("notReceived");
		if (result.status !== "notReceived") return;
		expect(result.reason).toBe(reason);
		expect(result.code).toBe(code);
	});
});

describe("submitWithdrawal — received", () => {
	it("returns the server's own number, timestamp and snapshot", async () => {
		const result = await submitWithdrawal(raw(), deps());
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.submissionNumber).toBe("ODS-2026-000042");
		expect(result.accepted.submittedAt).toBe("2026-07-30T09:12:33.123Z");
		expect(result.accepted.noticeSnapshot).toEqual(SNAPSHOT);
	});

	it("stays received when the confirmation e-mail failed, and says so in a log", async () => {
		// A withdrawal is effective when it is given, not when an SMTP server cooperates.
		const result = await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => ({
					status: "ok",
					value: {
						...ACCEPTED,
						emailDelivery: DELIVERY({ customerStatus: "failed", internalStatus: "sent" }),
					},
				})) as PersistPort,
			}),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.emailDelivery?.customerStatus).toBe("failed");

		expect(errorSpy).toHaveBeenCalledWith("[withdrawal] delivery-degraded", expect.any(String));
		const [, body] = errorSpy.mock.calls[0] as [string, string];
		// An on-call log is not a place for the notice or the customer's details.
		expect(body).not.toContain("jana@example.sk");
		expect(body).not.toContain("Jana Nováková");
	});

	it("says nothing when the e-mail was sent, or when delivery is simply unreported", async () => {
		await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => ({
					status: "ok",
					value: { ...ACCEPTED, emailDelivery: DELIVERY({ customerStatus: "sent", internalStatus: "sent" }) },
				})) as PersistPort,
			}),
		);
		expect(errorSpy).not.toHaveBeenCalled();

		// Unreported is not failed — the create response does not carry delivery yet.
		await submitWithdrawal(raw(), deps());
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("passes a duplicate through as a success with the ORIGINAL time and snapshot", async () => {
		const original: WithdrawalAccepted = {
			...ACCEPTED,
			duplicate: true,
			submittedAt: "2026-07-30T08:00:00.000Z",
			noticeSnapshot: { ...SNAPSHOT, note: "pôvodná poznámka" },
		};
		const result = await submitWithdrawal(
			raw({ note: "iná poznámka" }),
			deps({ persist: (async () => ({ status: "ok", value: original })) as PersistPort }),
		);

		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.duplicate).toBe(true);
		expect(result.accepted.submittedAt).toBe("2026-07-30T08:00:00.000Z");
		// The stored notice wins over what was just typed — that is the whole point of
		// the record being authoritative.
		const rendered = renderNoticeFromSnapshot(result.accepted.noticeSnapshot);
		expect(rendered).toContain("pôvodná poznámka");
		expect(rendered).not.toContain("iná poznámka");
	});
});

describe("submitWithdrawal — invalid input", () => {
	it("stops before touching any transport", async () => {
		const persist = vi.fn<PersistPort>();
		const result = await submitWithdrawal(raw({ email: "nope" }), deps({ persist }));
		expect(result.status).toBe("invalid");
		expect(persist).not.toHaveBeenCalled();
	});
});

describe("renderNoticeFromSnapshot", () => {
	it("is a pure projection of the stored snapshot", () => {
		const text = renderNoticeFromSnapshot({
			...SNAPSHOT,
			scope: "selectedItems",
			items: [{ orderLineId: null, productName: "Strešný box", sku: "TH-6299", quantity: 2 }],
			note: "Tovar mi ešte nebol doručený.",
		});

		expect(text).toContain("Jana Nováková");
		expect(text).toContain("ORD-1042");
		expect(text).toContain("Rozsah odstúpenia: vybrané položky");
		expect(text).toContain("Strešný box (SKU TH-6299) — počet: 2");
		expect(text).toContain("Tovar mi ešte nebol doručený.");
		expect(text).toContain("withdrawal-sk-2026-07-30-v0-DRAFT");
	});

	it("carries no timestamp — the record owns the time the notice was given", () => {
		expect(renderNoticeFromSnapshot(SNAPSHOT)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
	});

	it("renders sentences rather than the raw JSON a customer should never be shown", () => {
		const text = renderNoticeFromSnapshot(SNAPSHOT);
		expect(text).not.toContain("schemaVersion");
		expect(text).toContain("Týmto oznamujem, že odstupujem od zmluvy uzavretej na diaľku.");
	});
});
