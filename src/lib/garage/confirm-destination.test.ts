import { describe, expect, it } from "vitest";

import { searchWithoutPagination, vehicleConfirmDestination } from "./confirm-destination";

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

	it("requires the segment to BE a market, not merely to be alone", () => {
		// `/checkout` lives outside `[channel]` (`src/app/checkout/page.tsx`), so it is a
		// REAL one-segment route. The first version of this function counted segments and
		// would have pushed a shopper out of the checkout for changing their car — the
		// precise failure the rule above is written to avoid. `/sk/cart` has two segments,
		// so the cart test passed while this hole was open.
		expect(vehicleConfirmDestination("/checkout")).toBeNull();
	});

	it("knows every market, and only the markets", () => {
		// From `CHANNEL_MAP`, so a market added there is covered with no edit here.
		for (const market of ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(vehicleConfirmDestination(`/${market}`)).toBe("/konfigurator");
		}
		expect(vehicleConfirmDestination("/xx")).toBeNull();
		expect(vehicleConfirmDestination("/robots.txt")).toBeNull();
	});

	it("is unmoved by a trailing slash", () => {
		expect(vehicleConfirmDestination("/sk/")).toBe("/konfigurator");
		expect(vehicleConfirmDestination("/checkout/")).toBeNull();
	});

	it("leaves a route nobody has thought of yet alone", () => {
		// "Stay" is today's behaviour, so an unknown route inherits the safe direction.
		expect(vehicleConfirmDestination("/sk/something-invented-next-year")).toBeNull();
		expect(vehicleConfirmDestination("/something-invented-next-year")).toBeNull();
		expect(vehicleConfirmDestination("/sk/a/b/c")).toBeNull();
	});
});

describe("pagination after a change of vehicle", () => {
	it("drops the cursor, which belonged to the previous car's result set", () => {
		expect(searchWithoutPagination("?vehicle=1&cursor=abc&direction=next")).toBe("?vehicle=1");
	});

	it("keeps the shopper's own choices", () => {
		expect(searchWithoutPagination("?sort=price_asc&price=50-100&cursor=abc")).toBe(
			"?sort=price_asc&price=50-100",
		);
	});

	it("returns an empty string when pagination was all there was", () => {
		// Empty, not null: there IS a change to make, from "?cursor=abc" to no query.
		expect(searchWithoutPagination("?cursor=abc")).toBe("");
	});

	it("says null when there is nothing to drop, so the caller re-renders in place", () => {
		expect(searchWithoutPagination("?vehicle=1")).toBeNull();
		expect(searchWithoutPagination("")).toBeNull();
	});
});
