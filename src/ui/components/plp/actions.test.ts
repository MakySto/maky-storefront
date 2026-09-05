import { describe, expect, it, vi, beforeEach } from "vitest";

const { executeAuthenticatedGraphQL, findOrCreate, getIdFromCookies, saveIdToCookie, revalidatePath } =
	vi.hoisted(() => ({
		executeAuthenticatedGraphQL: vi.fn(),
		findOrCreate: vi.fn(),
		getIdFromCookies: vi.fn(),
		saveIdToCookie: vi.fn(),
		revalidatePath: vi.fn(),
	}));

vi.mock("@/lib/graphql", () => ({ executeAuthenticatedGraphQL }));
vi.mock("@/lib/checkout", () => ({ findOrCreate, getIdFromCookies, saveIdToCookie }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { addVariantToCart } from "./actions";

/**
 * Saleor is mocked entirely and deliberately: this asserts how the action reads
 * an answer, and running it for real would write a line to a live checkout.
 */
const ok = (payload: unknown) => ({ ok: true as const, data: { checkoutLinesAdd: payload } });
const CHECKOUT = { id: "Q2hlY2tvdXQ6MQ==" };
const input = { channel: "sk-eur", variantId: "UHJvZHVjdFZhcmlhbnQ6MQ==", quantity: 1 };

beforeEach(() => {
	vi.clearAllMocks();
	getIdFromCookies.mockResolvedValue(null);
	findOrCreate.mockResolvedValue(CHECKOUT);
	saveIdToCookie.mockResolvedValue(undefined);
});

describe("addVariantToCart", () => {
	it("confirms an add only when Saleor returned a checkout and no errors", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(ok({ checkout: CHECKOUT, errors: [] }));

		await expect(addVariantToCart(input)).resolves.toEqual({ status: "added" });
	});

	it("does NOT report success when Saleor rejected the line", async () => {
		// The whole bug in one test: HTTP 200, transport ok, errors populated.
		executeAuthenticatedGraphQL.mockResolvedValue(
			ok({ checkout: null, errors: [{ code: "INSUFFICIENT_STOCK", message: "only 2 left" }] }),
		);

		await expect(addVariantToCart(input)).resolves.toEqual({
			status: "rejected",
			reason: "unavailable",
			message: "only 2 left",
		});
	});

	it("reports a rejection even when Saleor also returns the checkout", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(
			ok({ checkout: CHECKOUT, errors: [{ code: "QUANTITY_GREATER_THAN_LIMIT", message: "max 5" }] }),
		);

		expect((await addVariantToCart(input)).status).toBe("rejected");
	});

	it("calls a post-send transport failure unconfirmed, never failed", async () => {
		// The request may have landed. Reporting failure invites a retry, and a
		// retry is how one click becomes two lines.
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: false,
			error: { type: "network", message: "socket hang up", isRetryable: true },
		});

		await expect(addVariantToCart(input)).resolves.toEqual({
			status: "unconfirmed",
			message: "socket hang up",
		});
	});

	it("calls a thrown transport error unconfirmed too", async () => {
		executeAuthenticatedGraphQL.mockRejectedValue(new Error("aborted"));

		expect((await addVariantToCart(input)).status).toBe("unconfirmed");
	});

	it("treats neither-checkout-nor-error as unconfirmed, not success", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(ok({ checkout: null, errors: [] }));

		expect((await addVariantToCart(input)).status).toBe("unconfirmed");
	});

	it("sends the mutation exactly once — no automatic retry", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: false,
			error: { type: "network", message: "timeout", isRetryable: true },
		});

		await addVariantToCart(input);

		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});

	it("fails cleanly, and attempts nothing, when the checkout cannot be made", async () => {
		findOrCreate.mockResolvedValue(null);

		await expect(addVariantToCart(input)).resolves.toEqual({
			status: "rejected",
			reason: "checkout",
			message: "could not create a checkout",
		});
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
	});

	it("treats a throwing checkout lookup as a clean failure — nothing was sent", async () => {
		findOrCreate.mockRejectedValue(new Error("cookie jar on fire"));

		expect(await addVariantToCart(input)).toMatchObject({ status: "rejected", reason: "checkout" });
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
	});

	it("rejects a missing variant without touching Saleor", async () => {
		expect(await addVariantToCart({ ...input, variantId: "" })).toMatchObject({
			status: "rejected",
			reason: "invalid",
		});
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
	});

	it("clamps a tampered quantity to the stated ceiling", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(ok({ checkout: CHECKOUT, errors: [] }));

		await addVariantToCart({ ...input, quantity: 9999, maxQuantity: 3 });

		expect(executeAuthenticatedGraphQL.mock.calls[0][1].variables.quantity).toBe(3);
	});

	it("refreshes the cart even when the outcome is unconfirmed", async () => {
		// The line may be there. A stale cart would hide it.
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: false,
			error: { type: "network", message: "timeout" },
		});

		await addVariantToCart(input);

		expect(revalidatePath).toHaveBeenCalledWith("/cart");
	});
});
