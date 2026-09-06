import { describe, expect, it } from "vitest";

import { ADD_SET_FAILURES, presentCardFailure } from "./configurator-card-state";

/**
 * The rule this file exists for: after an add we could not confirm, the control under the
 * shopper's cursor must not be the one that sends the same non-idempotent mutation again.
 */
describe("what a card offers after a failed add", () => {
	it("offers nothing when nothing failed", () => {
		expect(presentCardFailure(undefined)).toBeNull();
	});

	it("has a message for every failure the action can produce", () => {
		for (const failure of ADD_SET_FAILURES) {
			expect(presentCardFailure(failure)?.messageKey).toBeTruthy();
		}
	});

	it("sends the shopper to the cart on the ONE outcome that means 'we do not know'", () => {
		const checkCart = ADD_SET_FAILURES.filter((f) => presentCardFailure(f)?.primaryAction === "check-cart");
		expect(checkCart).toEqual(["lookup-failed"]);
	});

	it("renders that outcome neutrally, never as a refusal", () => {
		expect(presentCardFailure("lookup-failed")).toEqual({
			messageKey: "errorLookupFailed",
			tone: "status",
			primaryAction: "check-cart",
		});
	});

	it("keeps 'try again' for a catalogue outage, which never sent anything", () => {
		// Nothing reached Saleor, so the cart cannot have changed, and pointing the
		// shopper at their cart would send them to look at something that did not happen.
		expect(presentCardFailure("catalogue-unavailable")).toEqual({
			messageKey: "errorCatalogueUnavailable",
			tone: "alert",
			primaryAction: "add",
		});
	});

	it("treats every other failure as a refusal that may be retried", () => {
		for (const failure of ADD_SET_FAILURES) {
			if (failure === "lookup-failed") continue;
			expect(presentCardFailure(failure)).toMatchObject({ tone: "alert", primaryAction: "add" });
		}
	});

	it("reuses the shared out-of-stock wording rather than a second copy of it", () => {
		expect(presentCardFailure("out-of-stock")?.messageKey).toBe("__common.outOfStock");
	});
});
