import { describe, expect, it, vi } from "vitest";

import { type WithdrawalV2Accepted } from "./contract";
import { submitWithdrawal, type PersistPort, type SubmitDeps } from "./submit";
import { type RawWithdrawalInput } from "./validate";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const ACCEPTED: WithdrawalV2Accepted = {
	submissionNumber: "ODS-2026-000042",
	duplicate: false,
	printConfirmationHTML: "<!doctype html><html><body>Potvrdenie</body></html>",
	parcelSlipHTML: "<!doctype html><html><body>ODS-2026-000042</body></html>",
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

describe("submitWithdrawal — the body sent to Payload", () => {
	it("contains exactly the allowed keys, and never a server-owned one", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(raw(), deps({ persist }));

		const body = persist.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual([
			"contract",
			"customer",
			"customerOrderItems",
			"customerStatement",
			"experienceVersion",
			"items",
			"legalNoticeVersion",
			"locale",
			"market",
			"note",
			"privacyNoticeVersion",
			"returnMethod",
			"scope",
			"source",
			"submissionId",
		]);
		// Payload builds these four and rejects them in a create request.
		for (const serverOwned of ["noticeSnapshot", "submittedAt", "submissionNumber", "emailDelivery"]) {
			expect(body).not.toHaveProperty(serverOwned);
		}
		expect(Object.keys(body.customer as object).sort()).toEqual(["email", "name", "phone"]);
		expect(body).toMatchObject({
			experienceVersion: "returns-v2",
			customerStatement: "Odstupujem od zmluvy k objednávke ORD-1042 v celom rozsahu.",
			customerOrderItems: [],
			returnMethod: "merchantPickup",
		});
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
		expect(persist.mock.calls[0]?.[0].customerOrderItems).toEqual([]);
		expect(persist.mock.calls[0]?.[0].customerStatement).toBe(
			"Odstupujem od zmluvy k objednávke ORD-1042 v rozsahu uvedených položiek.",
		);
	});

	it("uses only server-verified whole-order lines for the customer-safe summary", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(
			raw(),
			deps({
				persist,
				verifiedOrder: { saleorOrderId: "T3JkZXI6MQ==", saleorCustomerId: null },
				customerOrderItems: [
					{ name: "  Strešný box\u0085Northline  ", quantity: 1 },
					{ name: "Popruh", quantity: 2 },
				],
			}),
		);
		expect(persist.mock.calls[0]?.[0].customerOrderItems).toEqual([
			{ name: "Strešný box Northline", quantity: 1 },
			{ name: "Popruh", quantity: 2 },
		]);
	});

	it("never accepts a whole-order summary without server-verified ownership", async () => {
		const persist = vi.fn<PersistPort>(async () => ({ status: "ok" as const, value: ACCEPTED }));
		await submitWithdrawal(
			raw(),
			deps({
				persist,
				customerOrderItems: [{ name: "Podvrhnutý názov", quantity: 999 }],
			}),
		);
		expect(persist.mock.calls[0]?.[0].customerOrderItems).toEqual([]);
	});
});

describe("submitWithdrawal — persistence failed, so nothing was received", () => {
	it.each([
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

describe("submitWithdrawal — transport result is ambiguous", () => {
	it.each(["timeout after 8000ms", "upstream HTTP 502", "response did not match the forms contract"])(
		"preserves the submission for an identical retry after %s",
		async (reason) => {
			const result = await submitWithdrawal(
				raw(),
				deps({ persist: (async () => ({ status: "unavailable", reason })) as PersistPort }),
			);
			expect(result).toEqual({ status: "confirmationPending" });
		},
	);
});

describe("submitWithdrawal — received", () => {
	it("returns only the server's customer-safe V2 artifacts", async () => {
		const result = await submitWithdrawal(raw(), deps());
		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.submissionNumber).toBe("ODS-2026-000042");
		expect(result.accepted.printConfirmationHTML).toContain("Potvrdenie");
		expect(result.accepted.parcelSlipHTML).toContain("ODS-2026-000042");
	});

	it("passes a duplicate through with the original immutable artifacts", async () => {
		const original: WithdrawalV2Accepted = {
			...ACCEPTED,
			duplicate: true,
			printConfirmationHTML: "<html><body>pôvodné potvrdenie</body></html>",
		};
		const result = await submitWithdrawal(
			raw(),
			deps({ persist: (async () => ({ status: "ok", value: original })) as PersistPort }),
		);

		expect(result.status).toBe("received");
		if (result.status !== "received") return;
		expect(result.accepted.duplicate).toBe(true);
		expect(result.accepted.printConfirmationHTML).toContain("pôvodné potvrdenie");
	});

	it("keeps confirmation-pending distinct so the same submission can be retried", async () => {
		const result = await submitWithdrawal(
			raw(),
			deps({
				persist: (async () => ({
					status: "rejected",
					httpStatus: 503,
					code: "WITHDRAWAL_CONFIRMATION_PENDING",
				})) as PersistPort,
			}),
		);
		expect(result).toEqual({ status: "confirmationPending" });
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
