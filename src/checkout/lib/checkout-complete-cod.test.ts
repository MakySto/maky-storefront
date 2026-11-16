import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who may create an order without a payment once the channel accepts unpaid orders for cash on delivery
 * (`lib/cod.ts`). With that switch on Saleor no longer refuses a card checkout whose payment does not cover it,
 * so the two server actions decide.
 * MOCKS: the Saleor transport (answers by the document asked) and the translator (it answers with the key);
 * nothing leaves the process.
 */

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL, executeAuthenticatedGraphQL: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/checkout/lib/server/resolve-fallback-locale", () => ({
	resolveFallbackLocale: async () => "sk-SK",
}));

const { runCheckoutCompleteAction, runCodCheckoutCompleteAction } = await import("./actions");

const ID = "Q2hlY2tvdXQ6MTIzNDU2Nzg=";
type Method = {
	id: string;
	name: string;
	price: { amount: number; currency: string };
	metadata: Array<{ key: string; value: string }>;
};
const BASE: Method = {
	id: "method-small",
	name: "Kuriér",
	price: { amount: 3.99, currency: "EUR" },
	metadata: [],
};
const COD: Method = {
	id: "method-small-cod",
	name: "Kuriér, dobierka",
	price: { amount: 6.99, currency: "EUR" },
	metadata: [
		{ key: "maky_cod_for", value: BASE.id },
		{ key: "maky_cod_max", value: "500" },
	],
};

type Checkout = {
	total: number;
	on: string;
	authorizeStatus?: "NONE" | "PARTIAL" | "FULL";
	methods?: Method[];
};
const checkout = ({ total, on, authorizeStatus = "NONE", methods = [BASE, COD] }: Checkout) => ({
	id: ID,
	channel: { slug: "sk-eur" },
	authorizeStatus,
	chargeStatus: "NONE",
	totalPrice: { gross: { amount: total, currency: "EUR" } },
	subtotalPrice: { gross: { amount: total, currency: "EUR" } },
	deliveryMethod: { __typename: "ShippingMethod", id: on },
	shippingMethods: methods,
	lines: [],
});

const isComplete = (document: unknown) => String(document).includes("checkoutComplete");
const completions = () => executePublicGraphQL.mock.calls.filter(([document]) => isComplete(document));

/** Saleor answers each read with the next checkout given (the last one from then on) and completes any order. */
function saleorHolds(...reads: Array<ReturnType<typeof checkout>>) {
	let read = 0;
	executePublicGraphQL.mockImplementation(async (document: unknown) => {
		if (isComplete(document)) {
			return {
				ok: true,
				data: { checkoutComplete: { order: { id: "order-1" }, confirmationNeeded: false, errors: [] } },
			};
		}
		const current = reads[Math.min(read, reads.length - 1)];
		read += 1;
		return { ok: true, data: { checkout: current } };
	});
}

let savedFlag: string | undefined;
beforeEach(() => {
	savedFlag = process.env.B2B_CHECKOUT_UI_ENABLED;
	process.env.B2B_CHECKOUT_UI_ENABLED = "false";
	executePublicGraphQL.mockReset();
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	if (savedFlag === undefined) delete process.env.B2B_CHECKOUT_UI_ENABLED;
	else process.env.B2B_CHECKOUT_UI_ENABLED = savedFlag;
});

/** Runs an action through the moment it waits for a payment to show on the checkout. */
async function settled<T>(action: Promise<T>): Promise<T> {
	await vi.advanceTimersByTimeAsync(5000);
	return action;
}

describe("runCheckoutCompleteAction where cash on delivery is on offer", () => {
	it("creates no order for a card checkout that is not paid", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id }));
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toEqual({
			ok: false,
			error: "checkout.payment.notFullyPaid",
		});
		expect(completions()).toHaveLength(0);
	});

	it("creates none for an unpaid checkout that is on cash on delivery either: that has its own action", async () => {
		saleorHolds(checkout({ total: 106.99, on: COD.id }));
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toMatchObject({ ok: false });
		expect(completions()).toHaveLength(0);
	});

	it("creates none for a payment that covers only a part", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id, authorizeStatus: "PARTIAL" }));
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toMatchObject({ ok: false });
		expect(completions()).toHaveLength(0);
	});

	it("completes a paid checkout, once", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id, authorizeStatus: "FULL" }));
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toEqual({ ok: true, orderId: "order-1" });
		expect(completions()).toHaveLength(1);
	});

	it("gives a payment that has just been confirmed a moment to show before calling it unpaid", async () => {
		saleorHolds(
			checkout({ total: 103.99, on: BASE.id }),
			checkout({ total: 103.99, on: BASE.id, authorizeStatus: "FULL" }),
		);
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toEqual({ ok: true, orderId: "order-1" });
		expect(completions()).toHaveLength(1);
	});

	it("completes an order with nothing to pay", async () => {
		saleorHolds(checkout({ total: 0, on: BASE.id }));
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toEqual({ ok: true, orderId: "order-1" });
	});
});

describe("runCheckoutCompleteAction where no cash on delivery is offered", () => {
	it("leaves the decision to Saleor, as before", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id, methods: [BASE] }));
		expect(await settled(runCheckoutCompleteAction(ID, "de"))).toEqual({ ok: true, orderId: "order-1" });
		expect(completions()).toHaveLength(1);
	});

	it("does the same when the checkout cannot be read", async () => {
		executePublicGraphQL.mockImplementation(async (document: unknown) =>
			isComplete(document)
				? {
						ok: true,
						data: { checkoutComplete: { order: { id: "order-1" }, confirmationNeeded: false, errors: [] } },
					}
				: { ok: false, error: { type: "network", message: "down" } },
		);
		expect(await settled(runCheckoutCompleteAction(ID, "sk"))).toEqual({ ok: true, orderId: "order-1" });
	});
});

describe("runCodCheckoutCompleteAction", () => {
	it("creates the order for a checkout on cash on delivery, at the total the customer was shown", async () => {
		saleorHolds(checkout({ total: 106.99, on: COD.id }));
		expect(await settled(runCodCheckoutCompleteAction(ID, 106.99, "sk"))).toEqual({
			ok: true,
			orderId: "order-1",
		});
		expect(completions()).toHaveLength(1);
	});

	it("creates none for a checkout that is not on cash on delivery, whatever the browser asked for", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id }));
		expect(await settled(runCodCheckoutCompleteAction(ID, 103.99, "sk"))).toMatchObject({
			ok: false,
			error: "checkout.payment.codUnavailable",
		});
		expect(completions()).toHaveLength(0);
	});

	it("creates none where the delivery has no cash-on-delivery version", async () => {
		saleorHolds(checkout({ total: 103.99, on: BASE.id, methods: [BASE] }));
		expect(await settled(runCodCheckoutCompleteAction(ID, 103.99, "de"))).toMatchObject({
			ok: false,
			error: "checkout.payment.codUnavailable",
		});
		expect(completions()).toHaveLength(0);
	});

	it("creates none above the limit Saleor names", async () => {
		saleorHolds(checkout({ total: 500.01, on: COD.id }));
		expect(await settled(runCodCheckoutCompleteAction(ID, 500.01, "sk"))).toMatchObject({
			ok: false,
			error: "checkout.payment.codUnavailable",
		});
		expect(completions()).toHaveLength(0);
	});

	it("creates none when the total is no longer the one the customer was shown, and hands the new one back", async () => {
		saleorHolds(checkout({ total: 126.99, on: COD.id }));
		const result = await settled(runCodCheckoutCompleteAction(ID, 106.99, "sk"));
		expect(result).toMatchObject({ ok: false, code: "TOTAL_CHANGED" });
		expect(completions()).toHaveLength(0);
	});
});
