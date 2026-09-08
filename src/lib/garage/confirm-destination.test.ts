import { describe, expect, it } from "vitest";

import { vehicleConfirmDestination } from "./confirm-destination";

/**
 * The homepage dead end, and the pages that must NOT move.
 *
 * Reproduced on production `3b0843f` before the fix: confirming a vehicle on the
 * homepage left the URL at `/sk` and nothing on screen changed.
 *
 * The second half of this file matters more than the first. The selector opens from the
 * header on every page, so a rule that is too eager throws shoppers out of a cart or a
 * checkout for the crime of choosing their car.
 */
describe("where confirming a vehicle sends the shopper", () => {
	it("goes to the results from the market root — the case that was broken", () => {
		expect(vehicleConfirmDestination("/sk")).toBe("/konfigurator");
		expect(vehicleConfirmDestination("/sk/")).toBe("/konfigurator");
		// Every market, not just the Slovak one.
		expect(vehicleConfirmDestination("/cz")).toBe("/konfigurator");
	});

	it("stays on surfaces that already answer the question in place", () => {
		// A PDP re-renders its compatibility box; a listing narrows itself.
		expect(vehicleConfirmDestination("/sk/stresny-nosic-nordrive-helio-black")).toBeNull();
		expect(vehicleConfirmDestination("/sk/stresne-boxy")).toBeNull();
		expect(vehicleConfirmDestination("/sk/products")).toBeNull();
		expect(vehicleConfirmDestination("/sk/collections/novinky")).toBeNull();
		expect(vehicleConfirmDestination("/sk/konfigurator")).toBeNull();
		expect(vehicleConfirmDestination("/sk/garage")).toBeNull();
	});

	it("never interrupts a task in progress", () => {
		// The one that would be found by a shopper, not by a test: picking a car in the
		// header while paying must not throw the shopper out of the checkout.
		expect(vehicleConfirmDestination("/sk/cart")).toBeNull();
		expect(vehicleConfirmDestination("/sk/checkout")).toBeNull();
		expect(vehicleConfirmDestination("/sk/orders")).toBeNull();
		expect(vehicleConfirmDestination("/sk/account/profile")).toBeNull();
		expect(vehicleConfirmDestination("/sk/login")).toBeNull();
	});

	it("leaves a route nobody has thought of yet alone", () => {
		// "Stay" is today's behaviour, so an unknown route inherits the safe direction.
		expect(vehicleConfirmDestination("/sk/something-invented-next-year")).toBeNull();
		expect(vehicleConfirmDestination("/sk/a/b/c")).toBeNull();
	});
});
