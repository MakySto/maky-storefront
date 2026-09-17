import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	executeAuthenticatedGraphQL: vi.fn(),
	revalidateStorefrontBrowsePath: vi.fn(),
	revalidateStorefrontChrome: vi.fn(),
	clearCheckoutCookieByValue: vi.fn(),
}));

vi.mock("@/lib/graphql", () => ({
	executeAuthenticatedGraphQL: mocks.executeAuthenticatedGraphQL,
}));

vi.mock("@/lib/auth/revalidate-storefront-chrome", () => ({
	revalidateStorefrontBrowsePath: mocks.revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome: mocks.revalidateStorefrontChrome,
}));

vi.mock("@/lib/checkout", () => ({
	clearCheckoutCookieByValue: mocks.clearCheckoutCookieByValue,
}));

import { deleteCartLine, updateCartLineQuantity } from "./actions";

const checkout = (lines: Array<{ id: string }> = [{ id: "line-1" }]) => ({
	id: "checkout-1",
	lines,
	channel: { slug: "sk-eur" },
});

describe("cart line actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not revalidate or report success after a transport failure", async () => {
		mocks.executeAuthenticatedGraphQL.mockResolvedValue({
			ok: false,
			error: { type: "network", message: "offline", isRetryable: true },
		});

		await expect(updateCartLineQuantity("sk-eur", "checkout-1", "line-1", 2)).resolves.toEqual({
			ok: false,
		});
		expect(mocks.revalidateStorefrontBrowsePath).not.toHaveBeenCalled();
		expect(mocks.revalidateStorefrontChrome).not.toHaveBeenCalled();
	});

	it("does not revalidate a Saleor domain rejection", async () => {
		mocks.executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: {
				checkoutLinesUpdate: {
					checkout: checkout(),
					errors: [{ field: "quantity", message: "Only one left", code: "INSUFFICIENT_STOCK" }],
				},
			},
		});

		await expect(updateCartLineQuantity("sk-eur", "checkout-1", "line-1", 2)).resolves.toEqual({
			ok: false,
		});
		expect(mocks.revalidateStorefrontBrowsePath).not.toHaveBeenCalled();
	});

	it("revalidates both cart content and storefront chrome after a confirmed update", async () => {
		mocks.executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: { checkoutLinesUpdate: { checkout: checkout(), errors: [] } },
		});

		await expect(updateCartLineQuantity("sk-eur", "checkout-1", "line-1", 2)).resolves.toEqual({
			ok: true,
		});
		expect(mocks.revalidateStorefrontBrowsePath).toHaveBeenCalledWith("sk-eur", "/cart");
		expect(mocks.revalidateStorefrontChrome).toHaveBeenCalledWith("sk-eur");
	});

	it("clears the checkout cookie only after a confirmed deletion empties the cart", async () => {
		mocks.executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: { checkoutLinesDelete: { checkout: checkout([]), errors: [] } },
		});

		await expect(deleteCartLine("sk-eur", "checkout-1", "line-1")).resolves.toEqual({ ok: true });
		expect(mocks.clearCheckoutCookieByValue).toHaveBeenCalledWith("checkout-1");
		expect(mocks.revalidateStorefrontBrowsePath).toHaveBeenCalledWith("sk-eur", "/cart");
	});

	it("keeps the checkout cookie and cache intact after a rejected deletion", async () => {
		mocks.executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: {
				checkoutLinesDelete: {
					checkout: checkout(),
					errors: [{ field: "linesIds", message: "Line not found", code: "GRAPHQL_ERROR" }],
				},
			},
		});

		await expect(deleteCartLine("sk-eur", "checkout-1", "line-1")).resolves.toEqual({ ok: false });
		expect(mocks.clearCheckoutCookieByValue).not.toHaveBeenCalled();
		expect(mocks.revalidateStorefrontBrowsePath).not.toHaveBeenCalled();
	});
});
