import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the customer reads when `checkoutComplete` refuses a B2B checkout (contract MAKY-B2B-V1 revision 2, §8).
 * MOCKS: the Saleor transport and the translator (it answers with the key); nothing leaves the process.
 */

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL, executeAuthenticatedGraphQL: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/checkout/lib/server/resolve-fallback-locale", () => ({
	resolveFallbackLocale: async () => "sk-SK",
}));

const { runCheckoutCompleteAction } = await import("./actions");

const ID = "Q2hlY2tvdXQ6MTIzNDU2Nzg=";
const refusal = (code: string) => ({
	ok: true,
	data: {
		checkoutComplete: {
			order: null,
			confirmationNeeded: false,
			errors: [{ field: null, code, message: null }],
		},
	},
});

let savedFlag: string | undefined;
beforeEach(() => {
	savedFlag = process.env.B2B_CHECKOUT_UI_ENABLED;
	// Off: a paid checkout goes straight to `checkoutComplete`, which is the answer under test.
	process.env.B2B_CHECKOUT_UI_ENABLED = "false";
	executePublicGraphQL.mockReset();
});
afterEach(() => {
	if (savedFlag === undefined) delete process.env.B2B_CHECKOUT_UI_ENABLED;
	else process.env.B2B_CHECKOUT_UI_ENABLED = savedFlag;
});

describe("runCheckoutCompleteAction with a B2B refusal", () => {
	it("an order that would differ from the paid offer: no order, the money is released, no new payment asked for", async () => {
		executePublicGraphQL.mockResolvedValue(refusal("B2B_TAX_CONTEXT_CHANGED"));
		expect(await runCheckoutCompleteAction(ID, "sk")).toMatchObject({
			ok: false,
			code: "B2B_CONTEXT_CHANGED",
			error: "checkout.payment.completeOfferChanged",
		});
	});

	it("a payment state keeps the message that never asks for a new payment", async () => {
		executePublicGraphQL.mockResolvedValue(refusal("B2B_CHECKOUT_LOCKED"));
		expect(await runCheckoutCompleteAction(ID, "sk")).toMatchObject({
			ok: false,
			code: "CHECKOUT_LOCKED",
			error: "checkout.payment.completeBlockedNoNewPayment",
		});
	});

	it("completes once, and starts nothing else", async () => {
		executePublicGraphQL.mockResolvedValue(refusal("B2B_TAX_CONTEXT_CHANGED"));
		await runCheckoutCompleteAction(ID, "sk");
		expect(executePublicGraphQL).toHaveBeenCalledTimes(1);
	});
});
