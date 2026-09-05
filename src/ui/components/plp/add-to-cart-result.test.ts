import { describe, expect, it } from "vitest";
import { classifyCheckoutErrors } from "./add-to-cart-result";

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
