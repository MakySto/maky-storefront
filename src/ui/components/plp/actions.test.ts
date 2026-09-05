import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeAuthenticatedGraphQL, findOrCreate, find, getIdFromCookies, saveIdToCookie, revalidatePath } =
	vi.hoisted(() => ({
		executeAuthenticatedGraphQL: vi.fn(),
		findOrCreate: vi.fn(),
		find: vi.fn(),
		getIdFromCookies: vi.fn(),
		saveIdToCookie: vi.fn(),
		revalidatePath: vi.fn(),
	}));

vi.mock("@/lib/graphql", () => ({ executeAuthenticatedGraphQL }));
vi.mock("@/lib/checkout", () => ({ findOrCreate, find, getIdFromCookies, saveIdToCookie }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { addVariantToCart } from "./actions";
import { READ_BACK_BUDGET_MS, READ_BACK_DELAYS_MS } from "./add-to-cart-result";

/**
 * Saleor is mocked entirely and deliberately: this asserts how the action reads
 * an answer, and running it for real would write a line to a live checkout.
 */
const ok = (payload: unknown) => ({ ok: true as const, data: { checkoutLinesAdd: payload } });
const CHECKOUT = { id: "Q2hlY2tvdXQ6MQ==" };
const input = { channel: "sk-eur", variantId: "UHJvZHVjdFZhcmlhbnQ6MQ==", quantity: 1 };

/**
 * `reconcile` sleeps between read-backs. Fake timers keep the suite fast and,
 * more usefully, let a test place a late commit *between* two reads.
 */
beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	getIdFromCookies.mockResolvedValue(null);
	findOrCreate.mockResolvedValue(CHECKOUT);
	find.mockResolvedValue(null);
	saveIdToCookie.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

/** Run the action to completion, driving every pending sleep. */
const settle = async <T>(promise: Promise<T>): Promise<T> => {
	await vi.runAllTimersAsync();
	return promise;
};

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

		await expect(settle(addVariantToCart(input))).resolves.toEqual({
			status: "unconfirmed",
			message: "socket hang up",
		});
	});

	it("calls a thrown transport error unconfirmed too", async () => {
		executeAuthenticatedGraphQL.mockRejectedValue(new Error("aborted"));

		expect((await settle(addVariantToCart(input))).status).toBe("unconfirmed");
	});

	it("treats neither-checkout-nor-error as unconfirmed, not success", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(ok({ checkout: null, errors: [] }));

		expect((await addVariantToCart(input)).status).toBe("unconfirmed");
	});

	it("calls the transport once — the WIRE count is asserted in graphql-retry.test.ts", async () => {
		// This only proves the action does not loop. It says nothing about HTTP
		// attempts, because `fetchWithRetry` sits underneath and used to replay a
		// mutation up to three more times. That is measured against a mocked fetch
		// in src/lib/graphql-retry.test.ts, which is where the duplicate-line risk
		// actually lives.
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: false,
			error: { type: "network", message: "timeout", isRetryable: true },
		});

		await settle(addVariantToCart(input));

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

	it("rejects a malformed variant id cleanly, without reaching Saleor", async () => {
		// `variantId` comes from a hidden input, so it is attacker-shaped, and
		// `decodeURIComponent("%")` throws. The decode used to happen twice in the
		// wrong places: once inside the checkout block, where it was reported as
		// "could not create a checkout", and once in the mutation's argument list
		// inside the post-send block, where it was routed into `reconcile` and so
		// described as a request that might be in flight. Nothing had been sent.
		const result = await settle(addVariantToCart({ ...input, variantId: "%" }));

		expect(result).toMatchObject({ status: "rejected", reason: "invalid" });
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
		expect(findOrCreate).not.toHaveBeenCalled();
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

		await settle(addVariantToCart(input));

		// The MARKET path, not "/cart". The cart lives at /sk/cart, which the proxy
		// rewrites to /sk-eur/cart, so the market-less path this used to pass
		// matched no route at all and the page kept serving its cached copy — right
		// when an unconfirmed add has just told the shopper to go and look at it.
		expect(revalidatePath).toHaveBeenCalledWith("/sk/cart");
		expect(revalidatePath).toHaveBeenCalledWith("/sk-eur/cart");
		expect(revalidatePath).not.toHaveBeenCalledWith("/cart");
	});
});

describe("an unclear result is settled by reading, never by re-sending", () => {
	const line = (variantId: string, quantity: number) => ({
		quantity,
		variant: { id: variantId },
	});
	const timeout = { ok: false, error: { type: "network", message: "socket hang up" } };

	it("reports success when the read shows the line did land", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 1)] });

		await expect(settle(addVariantToCart(input))).resolves.toEqual({ status: "added" });
	});

	it("NEVER calls an unchanged read-back a failure", async () => {
		// The defect this block exists for. A read that comes back unchanged
		// describes this instant, not the future: the mutation whose response was
		// lost may still be in flight. Calling it "nothing was added" invites a
		// second click, and `checkoutLinesAdd` is not idempotent.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [] });

		const result = await settle(addVariantToCart(input));

		expect(result).toMatchObject({ status: "unconfirmed" });
	});

	it("catches a write that commits AFTER the first read said nothing had changed", async () => {
		// The late commit, exactly as reported: the mutation is sent, the response
		// times out, the first read still shows the old quantity, and only then does
		// Saleor finish the write. One read would have called this a failure.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find
			.mockResolvedValueOnce({ ...CHECKOUT, lines: [] })
			.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 1)] });

		await expect(settle(addVariantToCart(input))).resolves.toEqual({ status: "added" });
	});

	it("gives up asking after a bounded number of reads, and stays unconfirmed", async () => {
		// Bounded, so a server action cannot hang; unconfirmed, because the deadline
		// ends the waiting and must not be read as a verdict.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [] });

		const result = await settle(addVariantToCart(input));

		expect(result.status).toBe("unconfirmed");
		expect(find).toHaveBeenCalledTimes(READ_BACK_DELAYS_MS.length + 1);
	});

	it("stops re-reading once the wall clock is spent, not just the attempt count", async () => {
		// A read-back is a query, so it keeps the transport's own retry budget and a
		// single one can take seconds against an unwell Saleor. Bounding attempts
		// alone would leave a shopper waiting far longer than the schedule suggests.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockImplementation(async () => {
			// Each read burns the entire allowance on its own.
			vi.advanceTimersByTime(READ_BACK_BUDGET_MS);
			return { ...CHECKOUT, lines: [] };
		});

		const result = await settle(addVariantToCart(input));

		expect(result.status).toBe("unconfirmed");
		expect(find).toHaveBeenCalledTimes(1);
	});

	it("counts from the quantity that was already in the cart", async () => {
		// The customer already had two. Landing means three, not one.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 2)] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 3)] });

		await expect(settle(addVariantToCart(input))).resolves.toEqual({ status: "added" });
	});

	it("does not turn a concurrent change into an error", async () => {
		// Another tab added some too. What was asked for is in the cart, which is
		// the question being answered — over-shoot is somebody else's write, not a
		// reason to tell this customer their add failed.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 2)] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 5)] });

		await expect(settle(addVariantToCart(input))).resolves.toEqual({ status: "added" });
	});

	it("stays unconfirmed when the line moved by LESS than was asked for", async () => {
		// Partially applied, or changed underneath us. Do not guess, and above all
		// do not add more.
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 2)] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [line(input.variantId, 3)] });

		const result = await settle(addVariantToCart({ ...input, quantity: 4 }));

		expect(result.status).toBe("unconfirmed");
		// A moved line answers the question; asking again cannot disentangle a
		// stock clamp from another tab, so it stops on the first read.
		expect(find).toHaveBeenCalledTimes(1);
	});

	it("stays unconfirmed when the read itself fails", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		find.mockRejectedValue(new Error("also down"));

		const result = await settle(addVariantToCart(input));

		expect(result.status).toBe("unconfirmed");
	});

	it("treats a checkout that reads back as missing as unknown, not as failure", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockResolvedValue(null);

		const result = await settle(addVariantToCart(input));

		expect(result.status).toBe("unconfirmed");
	});

	it("NEVER sends the mutation again while reconciling", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(timeout);
		findOrCreate.mockResolvedValue({ ...CHECKOUT, lines: [] });
		find.mockResolvedValue({ ...CHECKOUT, lines: [] });

		await settle(addVariantToCart(input));

		// Not once per read-back: exactly once, for the whole click.
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});
});
