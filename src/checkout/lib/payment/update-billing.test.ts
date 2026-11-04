import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCheckoutTransport, type CheckoutTransport } from "@/checkout/lib/checkout-transport";

import { updateCheckoutBilling } from "./update-billing";

/** MOCKS: the checkout transport is a fake; the B2B error codes are the PROPOSED contract's. */

const updateBillingAddress = vi.fn<CheckoutTransport["updateBillingAddress"]>();

const fakeTransport: CheckoutTransport = {
	fetchCheckout: vi.fn(),
	updateBillingAddress,
	initializePaymentGateways: vi.fn(),
	initializeTransaction: vi.fn(),
	processTransaction: vi.fn(),
	completeCheckout: vi.fn(),
};

const shippingAddress = {
	id: "QWRkcmVzczox",
	firstName: "Max",
	lastName: "Muster",
	companyName: "Delivery Recipient GmbH",
	streetAddress1: "Musterstr. 1",
	streetAddress2: "",
	city: "Berlin",
	postalCode: "10115",
	countryArea: "",
	phone: "",
	country: { code: "DE", country: "Germany" },
} as never;

const base = {
	checkoutId: "Q2hlY2tvdXQ6MQ==",
	sameAsBilling: true,
	hasShippingAddress: true,
	billingData: { formData: {}, countryCode: "DE" } as never,
	shippingAddress,
	userAddresses: [],
	authenticated: false,
};

beforeEach(() => {
	updateBillingAddress.mockReset();
	setCheckoutTransport(fakeTransport);
});

describe("updateCheckoutBilling", () => {
	it("a company purchase keeps the billing address saved in the Information step: no write at all", async () => {
		expect(await updateCheckoutBilling({ ...base, preserveBilling: true })).toEqual({ ok: true });
		expect(updateBillingAddress).not.toHaveBeenCalled();
	});

	it("an ordinary purchase with 'same as delivery' still copies the delivery address", async () => {
		updateBillingAddress.mockResolvedValue({ ok: true } as never);
		expect(await updateCheckoutBilling(base)).toEqual({ ok: true });
		expect(updateBillingAddress).toHaveBeenCalledTimes(1);
		expect(updateBillingAddress.mock.calls[0]![0].billingAddress).toMatchObject({
			city: "Berlin",
			country: "DE",
		});
	});

	it("a lock or a moved tax context is a payment state, not a field error", async () => {
		updateBillingAddress.mockResolvedValue({
			ok: false,
			error: "locked",
			fieldErrors: [{ field: null, code: "B2B_CHECKOUT_LOCKED", message: "Locked" }],
		} as never);
		expect(await updateCheckoutBilling(base)).toMatchObject({ ok: false, code: "CHECKOUT_LOCKED" });

		updateBillingAddress.mockResolvedValue({
			ok: false,
			error: "changed",
			fieldErrors: [{ field: null, code: "B2B_TAX_CONTEXT_CHANGED", message: "Changed" }],
		} as never);
		expect(await updateCheckoutBilling(base)).toMatchObject({ ok: false, code: "B2B_CONTEXT_CHANGED" });
	});
});
