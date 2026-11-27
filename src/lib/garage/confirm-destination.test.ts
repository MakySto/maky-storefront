import { describe, expect, it } from "vitest";

import {
	searchWithoutPagination,
	vehicleConfirmDestination,
	vehiclePageDestination,
} from "./confirm-destination";

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
		// `/checkout` lives outside `[channel]` (`src/app/(site)/checkout/page.tsx`), so it is a
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

/**
 * The confirmed car's own page, with the year and the roof in the address (owner, 2026-11-27: the
 * configurator has to give addresses a shopper can save and share, and one listing, not two).
 */
describe("landing on the car's own page", () => {
	const KUGA = "/sk/stresne-nosice/ford/kuga/dfk";
	const view = { year: 2024, roof: "flush-rails" } as const;

	it("goes there from the market root, with the year and the roof in the address", () => {
		expect(vehiclePageDestination("/sk", KUGA, view)).toBe(`${KUGA}?year=2024&roof=flush-rails`);
		expect(vehiclePageDestination("/sk/", KUGA, view)).toBe(`${KUGA}?year=2024&roof=flush-rails`);
	});

	it("carries only what the shopper said: no roof when they went on without one", () => {
		expect(vehiclePageDestination("/sk", KUGA, { year: 2024, roof: null })).toBe(`${KUGA}?year=2024`);
	});

	it("goes there from the configurator, from the roof-rack shelf and from another car's page", () => {
		for (const from of [
			"/sk/konfigurator",
			"/sk/stresne-nosice",
			"/sk/stresne-nosice/skoda",
			"/sk/stresne-nosice/skoda/octavia-combi/nx",
			KUGA,
		]) {
			expect(vehiclePageDestination(from, KUGA, view), from).toBe(`${KUGA}?year=2024&roof=flush-rails`);
		}
	});

	it("reads the shelf off the page's own address, so it works in a market's own words", () => {
		const de = "/de/dachtraeger/ford/kuga/dfk";
		expect(vehiclePageDestination("/de/dachtraeger", de, view)).toBe(`${de}?year=2024&roof=flush-rails`);
		// The Slovak spelling of the shelf is not the German market's shelf.
		expect(vehiclePageDestination("/de/stresne-nosice", de, view)).toBeNull();
	});

	it("stays on a product, a brand's shelf and every other listing: they answer in place", () => {
		for (const from of [
			"/sk/stresny-nosic-nordrive-helio-black",
			"/sk/thule-stresne-nosice",
			"/sk/stresne-boxy",
			"/sk/products",
			"/sk/garage",
			"/sk/poradna",
		]) {
			expect(vehiclePageDestination(from, KUGA, view), from).toBeNull();
		}
	});

	it("never interrupts a task in progress", () => {
		for (const from of [
			"/sk/cart",
			"/checkout",
			"/sk/checkout",
			"/sk/orders",
			"/sk/account/profile",
			"/sk/login",
		]) {
			expect(vehiclePageDestination(from, KUGA, view), from).toBeNull();
		}
	});

	it("does nothing where the market has no page for the car, or the page is another market's", () => {
		expect(vehiclePageDestination("/sk", null, view)).toBeNull();
		expect(vehiclePageDestination("/cz", KUGA, view)).toBeNull();
		// Not a vehicle page at all: a market and nothing else, or a path with no market.
		expect(vehiclePageDestination("/sk", "/sk", view)).toBeNull();
		expect(vehiclePageDestination("/sk", "/stresne-nosice/ford/kuga/dfk", view)).toBeNull();
	});
});
