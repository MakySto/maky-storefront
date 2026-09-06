import { describe, expect, it } from "vitest";

import { fitStatementFor, ADD_SET_FAILURES, presentCardFailure } from "./configurator-card-state";

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

describe("what a card is allowed to say about the fit", () => {
	it("calls a VERIFIED_FIT verified", () => {
		expect(fitStatementFor("VERIFIED_FIT", null, false)).toEqual({ key: "cardVerifiedFit" });
	});

	it("NEVER calls a MANUFACTURER_FIT verified", () => {
		// The regression: every offerable card rendered `cardVerifiedFit` — "Overené pre
		// vaše vozidlo". Since MANUFACTURER_FIT became offerable, that sentence claimed a
		// check nobody had performed, about a product somebody was about to buy.
		const statement = fitStatementFor("MANUFACTURER_FIT", "Nordrive", false);
		expect(statement.key).not.toBe("cardVerifiedFit");
		expect(statement.key).toBe("cardManufacturerFit");
		expect(statement.supplier).toBe("Nordrive");
	});

	it("names the supplier on the mounting-condition branch too", () => {
		// "Overené s podmienkami" is the same false claim with a qualifier bolted on, so
		// the conditions branch needs its own manufacturer wording rather than falling
		// through to the verified one.
		const statement = fitStatementFor("MANUFACTURER_FIT", "Nordrive", true);
		expect(statement.key).toBe("cardManufacturerQualifiedFit");
		expect(statement.supplier).toBe("Nordrive");
	});

	it("keeps the verified wording for a VERIFIED_FIT with conditions", () => {
		expect(fitStatementFor("VERIFIED_FIT", "Nordrive", true)).toEqual({ key: "cardQualifiedFit" });
	});

	it("degrades an unnamed supplier to the shared fallback, never to silence", () => {
		// `null` tells the caller to substitute `fitment.supplierFallback` — the same
		// vague-but-never-false word CompatibilityBox already uses. What it must not do
		// is drop the attribution and read as our own verification.
		for (const missing of [null, undefined, "", "   "]) {
			const statement = fitStatementFor("MANUFACTURER_FIT", missing, false);
			expect(statement.key).toBe("cardManufacturerFit");
			expect(statement.supplier).toBeNull();
		}
	});
});
