import { describe, expect, it } from "vitest";

import { type AddToCartRejection, type AddToCartResult } from "@/ui/components/plp/add-to-cart-result";
import { toAddSetResult } from "./cart-result";

/**
 * The one rule that matters here: an unconfirmed add is reported as neither a success
 * nor a refusal. Both would be wrong in a way the shopper pays for — a claimed success
 * hides a missing line, and a claimed refusal earns a second click that doubles it.
 */

const REJECTIONS: AddToCartRejection[] = ["unavailable", "invalid", "not-found", "checkout", "rejected"];

describe("toAddSetResult", () => {
	it("passes a confirmed add through", () => {
		expect(toAddSetResult({ status: "added" })).toEqual({ ok: true });
	});

	it("reports an unconfirmed add as 'check your cart', never as success or refusal", () => {
		const result = toAddSetResult({ status: "unconfirmed", message: "socket hang up" });
		expect(result).toEqual({ ok: false, reason: "lookup-failed" });
	});

	it("calls an unavailable set 'not available'", () => {
		expect(toAddSetResult({ status: "rejected", reason: "unavailable", message: "out of stock" })).toEqual({
			ok: false,
			reason: "not-available",
		});
	});

	it.each(REJECTIONS.filter((r) => r !== "unavailable"))(
		"calls a '%s' refusal a cart rejection rather than a vanished set",
		(reason) => {
			expect(toAddSetResult({ status: "rejected", reason, message: "no" })).toEqual({
				ok: false,
				reason: "cart-rejected",
			});
		},
	);

	it("never answers ok for anything but a confirmed add", () => {
		const everythingElse: AddToCartResult[] = [
			{ status: "unconfirmed", message: "" },
			...REJECTIONS.map((reason): AddToCartResult => ({ status: "rejected", reason, message: "" })),
		];
		for (const outcome of everythingElse) expect(toAddSetResult(outcome).ok).toBe(false);
	});
});
