import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { type FitmentDataset, type FitmentWindow, matchWindow, windowWithinProduction } from "./contract";
import { anApplication, aProduct, windowOf } from "./fixtures/build";
import { AUDI_OFFER, A4_AVANT_B8, n15060Dataset } from "./fixtures/n15060";
import { intendedVehiclesFor, windowBounds } from "./intended-for";
import {
	describeSetFit,
	offerFitOf,
	offerFitsByProduct,
	productionYearsOf,
	productFitIndex,
} from "./offer-fit";

/**
 * The years a set is shown for are the set maker's window as far as the car was built (CFM, 2026-11-27).
 *
 * CFM keeps a window as the application sheet gives it when it moves a generation's years: the fitment list of
 * the week of 2026-11-30 ends the Audi Q3 F3, the A6 Avant C8 and the C5 Aircross in 2025 and the Caddy 2K in
 * 2015, and their sets keep windows such as "od 2018". The CFM export of 2026-10-22 already held 59 positive
 * rows whose window runs past the end of their generation (a Santa Fe TM built until 2023 with a Thule window
 * 2021-2024). The web prints the intersection, and the decision already answers as if it did.
 */

const ENDED = { productionYearFrom: 2018, productionYearTo: 2023 };
const RUNNING = { productionYearFrom: 2019, productionYearTo: null };

describe("windowWithinProduction", () => {
	it("cuts a window that runs past the last year the car was built, and drops the month it cannot keep", () => {
		const cut = windowWithinProduction(windowOf([2021], [2024, 6]), ENDED);
		expect(cut.from).toEqual({ year: 2021 });
		expect(cut.to).toEqual({ year: 2023 });
		expect(cut.endPrecision).toBe("year");
		expect(cut.reconciledToGeneration).toBe(true);
	});

	it("closes an open window on a generation that ended (Audi Q3 F3 now ends in 2025)", () => {
		const cut = windowWithinProduction(windowOf([2018], null), {
			productionYearFrom: 2018,
			productionYearTo: 2025,
		});
		expect(windowBounds(cut)).toEqual({ from: "2018", to: "2025" });
	});

	it("cuts a window that starts before the car was built", () => {
		const cut = windowWithinProduction(windowOf([2003, 9], [2013]), {
			productionYearFrom: 2009,
			productionYearTo: 2013,
		});
		expect(cut.from).toEqual({ year: 2009 });
		expect(cut.startPrecision).toBe("year");
		expect(windowBounds(cut)).toEqual({ from: "2009", to: "2013" });
	});

	it("keeps a window inside the years of production exactly, months included, as the same object", () => {
		const inside = windowOf([2008, 5], [2015, 10]);
		expect(windowWithinProduction(inside, { productionYearFrom: 2008, productionYearTo: 2015 })).toBe(inside);
	});

	it("cuts nothing at the end of a generation still in production", () => {
		const open = windowOf([2020], null);
		const late = windowOf([2020], [2030]);
		expect(windowWithinProduction(open, RUNNING)).toBe(open);
		expect(windowWithinProduction(late, RUNNING)).toBe(late);
	});

	it("never widens: a narrower window stays as narrow as the source gave it", () => {
		const narrow = windowOf([2020], [2021]);
		expect(windowWithinProduction(narrow, ENDED)).toBe(narrow);
	});

	it("leaves a window that shares no year with the car as the source gave it, and one with no car", () => {
		const after = windowOf([2024], [2026]);
		const before = windowOf([2010], [2017]);
		expect(windowWithinProduction(after, ENDED)).toBe(after);
		expect(windowWithinProduction(before, ENDED)).toBe(before);
		expect(windowWithinProduction(after, undefined)).toBe(after);
	});
});

describe("the decision already takes the intersection", () => {
	// Every year the selector offers and the garage accepts is a year of production. For such a year the cut
	// window and the source's own answer alike, so the resolver needs no change and none was made.
	const generations = [
		{ productionYearFrom: 2009, productionYearTo: 2013 },
		{ productionYearFrom: 2018, productionYearTo: 2023 },
		{ productionYearFrom: 2019, productionYearTo: null },
		{ productionYearFrom: 2015, productionYearTo: 2015 },
	];
	const windows: FitmentWindow[] = [];
	for (const from of [2005, 2009, 2010, 2016, 2018, 2019, 2021]) {
		for (const fromMonth of [undefined, 1, 5, 12]) {
			windows.push(windowOf([from, fromMonth], null));
			for (const to of [2011, 2013, 2015, 2017, 2020, 2023, 2024, 2030]) {
				if (to < from) continue;
				for (const toMonth of [undefined, 3, 12]) windows.push(windowOf([from, fromMonth], [to, toMonth]));
			}
		}
	}

	it("answers alike for every year of production and every month, on a grid of windows and cars", () => {
		const now = 2026;
		let compared = 0;
		for (const generation of generations) {
			for (const window of windows) {
				const cut = windowWithinProduction(window, generation);
				for (
					let year = generation.productionYearFrom;
					year <= (generation.productionYearTo ?? now + 1);
					year++
				) {
					for (const month of [undefined, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
						expect(matchWindow(cut, year, month), `${JSON.stringify(window)} ${year}/${month}`).toBe(
							matchWindow(window, year, month),
						);
						compared++;
					}
				}
			}
		}
		expect(compared).toBeGreaterThan(10_000);
	});

	it("answers alike on the committed pilot export", () => {
		const pilot = JSON.parse(
			readFileSync(new URL("./fixtures/pilot-3.0.0-20260906.2.json", import.meta.url), "utf8"),
		) as FitmentDataset;
		const byId = productionYearsOf(pilot);
		let compared = 0;
		for (const application of pilot.applications) {
			const generation = byId(application.generationId);
			if (!generation) continue;
			const cut = windowWithinProduction(application.window, generation);
			for (let year = generation.productionYearFrom; year <= (generation.productionYearTo ?? 2027); year++) {
				for (const month of [undefined, 1, 6, 12]) {
					expect(matchWindow(cut, year, month)).toBe(matchWindow(application.window, year, month));
					compared++;
				}
			}
		}
		expect(compared).toBeGreaterThan(0);
	});
});

describe("what the shop prints", () => {
	// A Thule set for a car built 2018-2023, made (by its sheet) for 2021-2024.
	const dataset = (): FitmentDataset => {
		const base = n15060Dataset();
		base.generations[1] = { ...base.generations[1]!, productionYearFrom: 2018, productionYearTo: 2023 };
		base.applications = [
			anApplication({
				applicationId: "app-sheet",
				generationId: A4_AVANT_B8,
				window: windowOf([2021], [2024]),
				products: [
					aProduct({ saleorProductId: AUDI_OFFER.productId, saleorVariantId: AUDI_OFFER.variantId }),
				],
			}),
		];
		return base;
	};
	const t = (key: string, values?: Record<string, string | number>) =>
		key === "yearRange"
			? `${values!.from} – ${values!.to}`
			: key === "yearFromOnly"
				? `od ${values!.from}`
				: key;

	it("the box above the price says 2021 – 2023", () => {
		const [vehicle] = intendedVehiclesFor(dataset(), AUDI_OFFER.productId, AUDI_OFFER.variantId);
		expect(windowBounds(vehicle!.window)).toEqual({ from: "2021", to: "2023" });
	});

	it("the listing card says the same, from the index every card reads", () => {
		const fits = productFitIndex(dataset()).get(AUDI_OFFER.productId);
		expect(describeSetFit(fits, t, {} as never)?.years).toBe("2021 – 2023");
	});

	it("the vehicle page and the configurator, which pass the dataset's years, say the same", () => {
		const data = dataset();
		const fits = offerFitsByProduct(data.applications, undefined, productionYearsOf(data)).get(
			AUDI_OFFER.productId,
		);
		expect(fits?.map((fit) => [fit.yearFrom, fit.yearTo])).toEqual([[2021, 2023]]);
		// Without the years the window is printed as the sheet gives it: the old behaviour, kept for a caller with no dataset.
		expect(offerFitOf(data.applications[0]!)).toMatchObject({ yearFrom: 2021, yearTo: 2024 });
	});

	it("two rows of one set that differ only past the end of production are one statement", () => {
		const data = dataset();
		data.applications.push({
			...data.applications[0]!,
			applicationId: "app-sheet-2",
			window: windowOf([2021], [2025]),
		});
		const fits = offerFitsByProduct(data.applications, undefined, productionYearsOf(data)).get(
			AUDI_OFFER.productId,
		);
		expect(fits).toHaveLength(1);
	});
});
