import { describe, expect, it } from "vitest";

import { type FitmentApplication } from "./contract";
import {
	applicationsForYear,
	brandKey,
	parseVehicleView,
	vehicleViewQuery,
	yearsOnOffer,
	type VehicleView,
} from "./vehicle-view";

/**
 * The year and the roof in a vehicle page's address (owner, 2026-11-27: the configurator has to
 * give addresses that can be saved and shared).
 *
 * The clock is the test's own: every call names the current year.
 */

const NOW = 2026;
const KUGA = { from: 2019, to: null };

type Row = Pick<FitmentApplication, "window" | "negative">;
const row = (from: number, to: number | null, negative = false): Row => ({
	negative,
	window: {
		from: { year: from },
		to: to === null ? null : { year: to },
		startPrecision: "year",
		endPrecision: to === null ? "open" : "year",
		reconciledToGeneration: false,
	} as FitmentApplication["window"],
});

describe("reading the address", () => {
	it("reads a year of the generation and a roof type the dataset knows", () => {
		expect(parseVehicleView({ year: "2024", roof: "flush-rails" }, KUGA, NOW)).toEqual({
			year: 2024,
			roof: "flush-rails",
			brand: null,
			sort: null,
		});
	});

	it("takes next year for a generation still in production, as the selector offers it", () => {
		expect(parseVehicleView({ year: "2027" }, KUGA, NOW).year).toBe(2027);
		expect(parseVehicleView({ year: "2028" }, KUGA, NOW).year).toBeNull();
	});

	it("drops a year the car was not built in, and anything that is not a year", () => {
		expect(parseVehicleView({ year: "2018" }, KUGA, NOW).year).toBeNull();
		expect(parseVehicleView({ year: "2014" }, { from: 2008, to: 2013 }, NOW).year).toBeNull();
		expect(parseVehicleView({ year: "2013" }, { from: 2008, to: 2013 }, NOW).year).toBe(2013);
		for (const year of ["", "24", "20244", "2024a", " 2024", "-2024"]) {
			expect(parseVehicleView({ year }, KUGA, NOW).year, year).toBeNull();
		}
	});

	it("drops a roof that is not one of the six codes, in any spelling", () => {
		for (const roof of ["", "Flush-Rails", "flush_rails", "integrovane-lyziny", "none", "unsure"]) {
			expect(parseVehicleView({ roof }, KUGA, NOW).roof, roof).toBeNull();
		}
	});

	it("reads the first value of a repeated parameter and ignores every other parameter", () => {
		expect(
			parseVehicleView({ year: ["2024", "2020"], roof: ["naked-roof", "t-track"], vehicle: "1" }, KUGA, NOW),
		).toEqual({ year: 2024, roof: "naked-roof", brand: null, sort: null });
		expect(parseVehicleView({}, KUGA, NOW)).toEqual({ year: null, roof: null, brand: null, sort: null });
	});

	it("reads a maker spelled as the address spells it, and an order the page has", () => {
		const view = parseVehicleView({ brand: "green-valley", sort: "price_asc" }, KUGA, NOW);
		expect(view.brand).toBe("green-valley");
		expect(view.sort).toBe("price_asc");
		expect(parseVehicleView({ sort: "price_desc" }, KUGA, NOW).sort).toBe("price_desc");
	});

	it("drops a maker that is not spelled like one and an order the page does not have", () => {
		for (const brand of ["", "Thule", "green valley", "-thule", "thule-", "a--b", "<b>", "x".repeat(41)]) {
			expect(parseVehicleView({ brand }, KUGA, NOW).brand, brand).toBeNull();
		}
		for (const sort of ["", "featured", "newest", "price-asc", "PRICE_ASC", "bestselling"]) {
			expect(parseVehicleView({ sort }, KUGA, NOW).sort, sort).toBeNull();
		}
	});

	it("spells a maker's name for the address", () => {
		expect(brandKey("Thule")).toBe("thule");
		expect(brandKey("Green Valley")).toBe("green-valley");
		expect(brandKey("Pro-USER")).toBe("pro-user");
		expect(brandKey("  Škoda  Originál ")).toBe("skoda-original");
		expect(brandKey("G3 / Pegasus")).toBe("g3-pegasus");
	});

	it("reads back what it writes", () => {
		const views: VehicleView[] = [
			{ year: 2024, roof: "flush-rails", brand: null, sort: null },
			{ year: 2024, roof: null, brand: null, sort: null },
			{ year: null, roof: "t-track", brand: null, sort: null },
			{ year: null, roof: null, brand: null, sort: null },
			{ year: 2024, roof: "flush-rails", brand: "thule", sort: "price_asc" },
			{ year: null, roof: null, brand: "green-valley", sort: null },
			{ year: null, roof: null, brand: null, sort: "price_desc" },
		];
		expect(views.map(vehicleViewQuery)).toEqual([
			"?year=2024&roof=flush-rails",
			"?year=2024",
			"?roof=t-track",
			"",
			"?year=2024&roof=flush-rails&brand=thule&sort=price_asc",
			"?brand=green-valley",
			"?sort=price_desc",
		]);
		// The selector names a year and a roof and nothing else: its address is as it was.
		expect(vehicleViewQuery({ year: 2024, roof: "flush-rails" })).toBe("?year=2024&roof=flush-rails");
		for (const view of views) {
			const search = Object.fromEntries(new URLSearchParams(vehicleViewQuery(view)));
			expect(parseVehicleView(search, KUGA, NOW)).toEqual(view);
		}
	});
});

describe("the sets of one year", () => {
	// The Kuga's case: raised rails only in 2019 and 2020, the other two roofs to this day.
	const raised = row(2019, 2020);
	const flush = row(2019, null);
	const negative = row(2019, 2020, true);

	it("leaves every row when no year is asked", () => {
		expect(applicationsForYear([raised, flush, negative], null)).toEqual([raised, flush, negative]);
	});

	it("leaves the rows whose window the year is not outside of", () => {
		expect(applicationsForYear([raised, flush], 2020)).toEqual([raised, flush]);
		expect(applicationsForYear([raised, flush], 2024)).toEqual([flush]);
		expect(applicationsForYear([raised], 2024)).toEqual([]);
	});

	it("keeps a negative row whatever its window: it names no set of its own", () => {
		expect(applicationsForYear([negative, flush], 2024)).toEqual([negative, flush]);
	});
});

describe("the years the page offers", () => {
	it("lists the years with a set, newest first, up to next year for an open generation", () => {
		expect(yearsOnOffer([row(2019, 2020), row(2023, null)], KUGA, NOW)).toEqual([
			2027, 2026, 2025, 2024, 2023, 2020, 2019,
		]);
	});

	it("stays inside the generation's own years, whatever a window says", () => {
		expect(yearsOnOffer([row(2005, 2016)], { from: 2008, to: 2013 }, NOW)).toEqual([
			2013, 2012, 2011, 2010, 2009, 2008,
		]);
	});

	it("is empty when only negative rows exist", () => {
		expect(yearsOnOffer([row(2019, 2020, true)], KUGA, NOW)).toEqual([]);
		expect(yearsOnOffer([], KUGA, NOW)).toEqual([]);
	});
});
