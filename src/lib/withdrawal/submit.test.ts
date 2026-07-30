import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type WithdrawalAccepted } from "./contract";
import { type MailResult, type WithdrawalMailer } from "./mail";
import { submitWithdrawal, type PersistPort, type RecordDeliveryPort, type SubmitDeps } from "./submit";
import { type RawWithdrawalInput } from "./validate";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const ACCEPTED: WithdrawalAccepted = {
	submissionId: VALID_UUID,
	submissionNumber: "ODS-2026-000042",
	submittedAt: "2026-07-30T09:12:33.123Z",
	orderMatchStatus: "matched",
	duplicate: false,
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

function mailer(customer: MailResult, internal: MailResult = customer): WithdrawalMailer {
	return {
		sendCustomerConfirmation: vi.fn(async () => customer),
		sendInternalNotification: vi.fn(async () => internal),
	};
}

function deps(overrides: Partial<SubmitDeps> = {}): SubmitDeps {
	return {
		persist: (async () => ({ status: "ok", value: ACCEPTED })) as PersistPort,
		mailer: mailer({ status: "sent" }),
		recordDelivery: (async () => ({ status: "ok" })) as RecordDeliveryPort,
		returnsPageUrl: "https://maky.store/sk/reklamacie-a-vratenie",
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

describe("submitWithdrawal — order of operations", () => {
	it("persists before it sends anything", async () => {
		const calls: string[] = [];
		const result = await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => {
					calls.push("persist");
					return { status: "ok", value: ACCEPTED };
				}) as PersistPort,
				mailer: {
					sendCustomerConfirmation: async () => {
						calls.push("customer");
						return { status: "sent" };
					},
					sendInternalNotification: async () => {
						calls.push("internal");
						return { status: "sent" };
					},
				},
				recordDelivery: (async () => {
					calls.push("recordDelivery");
					return { status: "ok" };
				}) as RecordDeliveryPort,
			}),
		);

		expect(result.status).toBe("received");
		expect(calls).toEqual(["persist", "customer", "internal", "recordDelivery"]);
	});

	it("sends the server's own submission number and timestamp back, never a local clock", async () => {
		const result = await submitWithdrawal(raw(), deps());
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.submissionNumber).toBe("ODS-2026-000042");
		expect(result.accepted.submittedAt).toBe("2026-07-30T09:12:33.123Z");
	});

	it("stamps a canonical notice snapshot containing what the customer confirmed", async () => {
		const result = await submitWithdrawal(
			raw({
				scope: "selectedItems",
				items: [{ orderLineId: "l1", productName: "Strešný box Thule", quantity: 2 }],
				note: "Tovar mi ešte nebol doručený.",
			}),
			deps(),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;

		const snapshot = result.submission.noticeSnapshot;
		expect(snapshot).toContain("Jana Nováková");
		expect(snapshot).toContain("ORD-1042");
		expect(snapshot).toContain("Strešný box Thule");
		expect(snapshot).toContain("Rozsah odstúpenia: vybrané položky");
		expect(snapshot).toContain("Tovar mi ešte nebol doručený.");
		// No timestamp inside the evidence — the record owns the time it was given.
		expect(snapshot).not.toContain("2026-07-30T09:12:33");
	});
});

describe("submitWithdrawal — persistence failed, so nothing was received", () => {
	it.each([
		["timeout", { status: "unavailable", reason: "timeout after 8000ms" }, "unavailable"],
		["5xx", { status: "unavailable", reason: "upstream HTTP 502" }, "unavailable"],
		["4xx", { status: "rejected", httpStatus: 422, code: "invalidBody" }, "rejected"],
		["not configured", { status: "notConfigured", missing: ["MAKY_FORMS_HMAC_SECRET"] }, "notConfigured"],
	])("reports %s as not received", async (_label, persisted, reason) => {
		const result = await submitWithdrawal(
			raw(),
			deps({ persist: (async () => persisted) as unknown as PersistPort }),
		);
		expect(result.status).toBe("notReceived");
		if (result.status !== "notReceived") return;
		expect(result.reason).toBe(reason);
	});

	it("does not send any e-mail when nothing was stored", async () => {
		// Confirming receipt of a notice that was never recorded is the worst available
		// outcome: the customer stops chasing a right they still have.
		const mail = mailer({ status: "sent" });
		const result = await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => ({ status: "unavailable", reason: "timeout" })) as PersistPort,
				mailer: mail,
			}),
		);
		expect(result.status).toBe("notReceived");
		expect(mail.sendCustomerConfirmation).not.toHaveBeenCalled();
		expect(mail.sendInternalNotification).not.toHaveBeenCalled();
	});
});

describe("submitWithdrawal — stored, but the e-mail did not go out", () => {
	it("still reports the withdrawal as received", async () => {
		const result = await submitWithdrawal(
			raw(),
			deps({ mailer: mailer({ status: "failed", reason: "SMTP 421" }) }),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.email.customer).toEqual({ status: "failed", reason: "SMTP 421" });
	});

	it("treats a missing transport as a delivery failure, not a submission failure", async () => {
		const result = await submitWithdrawal(raw(), deps());
		expect(result.status).toBe("received");

		const { unavailableMailer } = await import("./mail");
		const withReal = await submitWithdrawal(raw(), deps({ mailer: unavailableMailer }));
		expect(withReal.status).toBe("received");
		if (withReal.status !== "received") return;
		expect(withReal.email.customer.status).toBe("unsupported");
	});

	it("survives a mailer that throws instead of returning", async () => {
		const result = await submitWithdrawal(
			raw(),
			deps({
				mailer: {
					sendCustomerConfirmation: async () => {
						throw new TypeError("boom");
					},
					sendInternalNotification: async () => ({ status: "sent" }),
				},
			}),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.email.customer).toEqual({ status: "failed", reason: "TypeError" });
	});

	it("records the delivery outcome against the record", async () => {
		const recordDelivery = vi.fn<RecordDeliveryPort>(async () => ({ status: "ok" }));
		await submitWithdrawal(
			raw(),
			deps({
				mailer: mailer({ status: "failed", reason: "SMTP 421" }, { status: "sent" }),
				recordDelivery,
			}),
		);
		expect(recordDelivery).toHaveBeenCalledWith(VALID_UUID, {
			customerStatus: "failed",
			internalStatus: "sent",
			lastError: "SMTP 421",
		});
	});

	it("stays received even when the delivery status cannot be written back", async () => {
		const result = await submitWithdrawal(
			raw(),
			deps({
				recordDelivery: (async () => {
					throw new Error("payload down");
				}) as unknown as RecordDeliveryPort,
			}),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.email.recorded).toBe(false);
	});

	it("emits one structured alert when delivery is degraded, and none when it is clean", async () => {
		await submitWithdrawal(raw(), deps());
		expect(errorSpy).not.toHaveBeenCalled();

		await submitWithdrawal(raw(), deps({ mailer: mailer({ status: "failed", reason: "SMTP 421" }) }));
		expect(errorSpy).toHaveBeenCalledWith("[withdrawal] delivery-degraded", expect.any(String));

		const [, body] = errorSpy.mock.calls[0] as [string, string];
		const alert = JSON.parse(body) as Record<string, unknown>;
		expect(alert.submissionNumber).toBe("ODS-2026-000042");
		// An on-call log is not a place for the notice or the customer's details.
		expect(body).not.toContain("jana@example.sk");
		expect(body).not.toContain("Jana Nováková");
	});
});

describe("submitWithdrawal — idempotency", () => {
	it("passes a duplicate through as a success, not as an error", async () => {
		// A retry after a timeout must return the original receipt. The database unique
		// index is what decides this; the storefront just reports what came back.
		const result = await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => ({
					status: "ok",
					value: { ...ACCEPTED, duplicate: true },
				})) as PersistPort,
			}),
		);
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.duplicate).toBe(true);
		expect(result.accepted.submissionNumber).toBe("ODS-2026-000042");
	});

	it("sends the same submissionId it was given, so the retry can be recognised", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(raw(), deps({ persist }));
		expect(persist.mock.calls[0]?.[0]).toMatchObject({ submissionId: VALID_UUID });
	});
});

describe("submitWithdrawal — ownership", () => {
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
			deps({
				persist,
				verifiedOrder: { saleorOrderId: "T3JkZXI6MQ==", saleorCustomerId: null },
			}),
		);
		expect(persist.mock.calls[0]?.[0].contract.saleorOrderId).toBe("T3JkZXI6MQ==");
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
