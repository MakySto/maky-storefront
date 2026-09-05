import { describe, expect, it } from "vitest";
import {
	classifyCheckoutErrors,
	hasTimeForAnotherRead,
	READ_BACK_BUDGET_MS,
	READ_BACK_DELAYS_MS,
	readBackVerdict,
} from "./add-to-cart-result";

/**
 * `checkoutLinesAdd` answers HTTP 200 with a populated `errors` array when it
 * refuses a line. Both add-to-cart call sites checked only the transport's
 * `result.ok`, so every one of these read as a successful add — and the mutation
 * did not even select `errors.code`, so there was nothing to classify on.
 */
describe("classifyCheckoutErrors", () => {
	it("says nothing when Saleor raised nothing", () => {
		expect(classifyCheckoutErrors([])).toBeNull();
	});

	it.each([
		"INSUFFICIENT_STOCK",
		"PRODUCT_NOT_PUBLISHED",
		"PRODUCT_UNAVAILABLE_FOR_PURCHASE",
		"UNAVAILABLE_VARIANT_IN_CHANNEL",
		"CHANNEL_INACTIVE",
	])("reads %s as unavailable", (code) => {
		const result = classifyCheckoutErrors([{ code, message: "nope" }]);
		expect(result).toEqual({ status: "rejected", reason: "unavailable", message: "nope" });
	});

	it.each(["ZERO_QUANTITY", "QUANTITY_GREATER_THAN_LIMIT", "INVALID", "REQUIRED"])(
		"reads %s as invalid input",
		(code) => {
			expect(classifyCheckoutErrors([{ code, message: "bad" }])?.reason).toBe("invalid");
		},
	);

	it("reads NOT_FOUND as not-found", () => {
		expect(classifyCheckoutErrors([{ code: "NOT_FOUND", message: "gone" }])?.reason).toBe("not-found");
	});

	it("falls back to a plain rejection for a code it does not model", () => {
		expect(classifyCheckoutErrors([{ code: "TAX_ERROR", message: "vat" }])?.reason).toBe("rejected");
	});

	it("still rejects when Saleor sends no code at all", () => {
		// The old mutation selected only `message`, so this is the shape any
		// unmigrated caller would see. It must not be mistaken for success.
		expect(classifyCheckoutErrors([{ message: "something went wrong" }])).toEqual({
			status: "rejected",
			reason: "rejected",
			message: "something went wrong",
		});
	});

	it("reports the most actionable error, not the first one", () => {
		// Saleor commonly returns a generic GRAPHQL_ERROR alongside the real
		// reason. "Out of stock" is worth telling a customer; the other is not.
		const result = classifyCheckoutErrors([
			{ code: "GRAPHQL_ERROR", message: "generic" },
			{ code: "INSUFFICIENT_STOCK", message: "only 2 left" },
		]);
		expect(result).toEqual({ status: "rejected", reason: "unavailable", message: "only 2 left" });
	});

	it("never returns an empty message", () => {
		expect(classifyCheckoutErrors([{ code: "INSUFFICIENT_STOCK", message: "  " }])?.message).toBe(
			"INSUFFICIENT_STOCK",
		);
	});
});

/**
 * The rule that decides whether a lost response may be called a failure.
 *
 * It may not. Every arm here exists so that "unchanged" can never again be
 * spelled "rejected": the write we lost the answer to may still be in flight,
 * and `checkoutLinesAdd` is not idempotent, so a customer told "nothing was
 * added" clicks again and ends up with two.
 */
describe("readBackVerdict", () => {
	it("calls it landed when the full requested quantity is there", () => {
		expect(readBackVerdict({ before: 0, requested: 1, after: 1 })).toBe("landed");
	});

	it("counts from what was already in the cart, not from zero", () => {
		expect(readBackVerdict({ before: 2, requested: 1, after: 3 })).toBe("landed");
		expect(readBackVerdict({ before: 2, requested: 1, after: 2 })).toBe("unchanged");
	});

	it("does not punish a concurrent write for overshooting", () => {
		// Another tab added some too. What this customer asked for is in the cart,
		// which is the question being answered.
		expect(readBackVerdict({ before: 2, requested: 1, after: 9 })).toBe("landed");
	});

	it("calls a partial move partial, not landed and not failed", () => {
		expect(readBackVerdict({ before: 2, requested: 4, after: 3 })).toBe("partial");
	});

	it("calls an unchanged read unchanged — never a rejection", () => {
		// A read describes this instant. It is not a statement about the future,
		// and this type has no arm that would let it become one.
		expect(readBackVerdict({ before: 0, requested: 1, after: 0 })).toBe("unchanged");
	});

	it("calls a failed read unreadable, which is not a failed write", () => {
		expect(readBackVerdict({ before: 0, requested: 1, after: null })).toBe("unreadable");
	});

	it("keeps the retry schedule bounded and non-empty", () => {
		// Bounded so a server action cannot hang; non-empty so a late commit has at
		// least one chance to be seen after the first read.
		expect(READ_BACK_DELAYS_MS.length).toBeGreaterThan(0);
		expect(READ_BACK_DELAYS_MS.every((ms) => ms > 0)).toBe(true);
		expect(READ_BACK_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeLessThan(READ_BACK_BUDGET_MS);
	});
});

/**
 * The second bound, and the one that actually binds when Saleor is unwell.
 *
 * Counting attempts does not limit this: a read-back is a *query*, so it keeps
 * the transport's own retry budget — three attempts with exponential backoff,
 * up to ~7 s inside one read — on top of a process-wide request queue. Three
 * attempts could run past twenty seconds with a shopper watching a spinner.
 */
describe("hasTimeForAnotherRead", () => {
	it("allows another read while the budget comfortably covers the wait", () => {
		expect(hasTimeForAnotherRead({ elapsedMs: 0, delayMs: 250, budgetMs: 2500 })).toBe(true);
	});

	it("refuses when the wait would reach the deadline", () => {
		expect(hasTimeForAnotherRead({ elapsedMs: 2000, delayMs: 500, budgetMs: 2500 })).toBe(false);
	});

	it("refuses once a single slow read has already spent the budget", () => {
		// One `CheckoutFind` against an unreachable Saleor can burn the whole
		// allowance on its own. Piling more reads on top helps nobody.
		expect(hasTimeForAnotherRead({ elapsedMs: 7000, delayMs: 250, budgetMs: 2500 })).toBe(false);
	});

	it("refuses when the schedule itself is spent", () => {
		// Past the end of the array. `noUncheckedIndexedAccess` is off, so the
		// caller's type says `number` while the value is `undefined` — which is
		// precisely why this arm exists.
		expect(hasTimeForAnotherRead({ elapsedMs: 0, delayMs: undefined, budgetMs: 2500 })).toBe(false);
	});

	it("defaults to the shipped budget", () => {
		expect(hasTimeForAnotherRead({ elapsedMs: READ_BACK_BUDGET_MS, delayMs: 1 })).toBe(false);
		expect(hasTimeForAnotherRead({ elapsedMs: 0, delayMs: 1 })).toBe(true);
	});
});
