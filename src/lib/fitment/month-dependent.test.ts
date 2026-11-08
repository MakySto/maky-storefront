import { describe, expect, it } from "vitest";

import {
	isFitmentOfferable,
	isFitmentPurchasable,
	matchWindow,
	type FitmentDataset,
	type VehicleSelection,
} from "./contract";
import { aProduct, windowOf } from "./fixtures/build";
import { monthCaveatOf, monthCaveatText } from "./month-caveat";
import { resolveFitment, resolveVehicleOutcome } from "./resolve";

/**
 * Marek, 2026-11-07: a product is never hidden because the shopper gave a year and no month (or "I do
 * not know"). Both sides of a window edge are SHOWN, each with its window, never as a certain fit; the
 * month then removes the wrong side. One generation here, two sets whose windows meet inside a year —
 * the shape of 1 620 generation × year pairs in the live dataset.
 */

const NOW = Date.parse("2026-11-07T00:00:00.000Z");

const SET_OLD = "P-old"; // valid until 06/2020
const SET_NEW = "P-new"; // valid from 07/2020

function build(
	over: { oldRef?: Partial<ReturnType<typeof aProduct>>; negativeNew?: boolean } = {},
): FitmentDataset {
	return {
		schemaVersion: "3.0.0",
		datasetVersion: "month-test",
		datasetHash: "h",
		generatedAt: "2026-11-01T00:00:00.000Z",
		source: { system: "test" },
		saleorInstance: "api.example.test",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: { scope: { programId: "p", productKinds: ["roof-rack-set"] }, completeForMakeIds: [] },
		makes: [{ id: "fiat", name: "Fiat" }],
		models: [{ id: "panda", makeId: "fiat", name: "Panda" }],
		generations: [
			{
				id: "p319",
				modelId: "panda",
				name: "319",
				productionYearFrom: 2011,
				productionYearTo: null,
				qualifiers: {},
			},
		],
		applications: [
			{
				applicationId: "old",
				generationId: "p319",
				window: windowOf([2012, 1], [2020, 6]),
				qualifiers: {},
				conditions: [],
				products: [aProduct({ saleorProductId: SET_OLD, saleorVariantId: "V-old", ...over.oldRef })],
			},
			{
				applicationId: "new",
				generationId: "p319",
				window: windowOf([2020, 7], null),
				qualifiers: {},
				conditions: [],
				...(over.negativeNew ? { negative: true } : {}),
				products: [aProduct({ saleorProductId: SET_NEW, saleorVariantId: "V-new" })],
			},
		],
	} as FitmentDataset;
}

const car = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "fiat",
	modelId: "panda",
	generationId: "p319",
	year,
	manufactureMonth,
});

describe("a window edge with no month", () => {
	it("shows the sets of BOTH sides of the edge, apart from the certain fits", () => {
		const outcome = resolveVehicleOutcome(build(), car(2020), { now: NOW });
		expect(outcome.verified).toEqual([]);
		expect(outcome.monthDependent.map((o) => o.ref.saleorProductId).sort()).toEqual([SET_NEW, SET_OLD]);
		expect(outcome.unconfirmed).toEqual([]);
		expect(outcome.rejected).toEqual([]);
	});

	it("is never a fit: not offerable in the strict sense, purchasable with the caution", () => {
		const result = resolveFitment(build(), car(2020), { saleorProductId: SET_NEW, now: NOW });
		expect(result.verdict).toBe("MAY_FIT_BY_MONTH");
		const gate = { verdict: result.verdict, eligibility: result.product?.eligibility };
		expect(isFitmentOfferable(gate)).toBe(false);
		expect(isFitmentPurchasable(gate)).toBe(true);
	});

	it("keeps the product's own evidence, so the row is the one that was judged", () => {
		const result = resolveFitment(build(), car(2020), { saleorProductId: SET_NEW, now: NOW });
		expect(result.product?.evidence.kind).toBe("manufacturer-application");
		expect(result.matched.map((a) => a.applicationId)).toEqual(["new"]);
	});

	it("says from which month a set is valid, and until which", () => {
		const fromNew = resolveFitment(build(), car(2020), { saleorProductId: SET_NEW, now: NOW });
		const toOld = resolveFitment(build(), car(2020), { saleorProductId: SET_OLD, now: NOW });
		expect(monthCaveatOf(fromNew.matched, 2020)).toEqual({ kind: "from", from: "07/2020" });
		expect(monthCaveatOf(toOld.matched, 2020)).toEqual({ kind: "to", to: "06/2020" });
	});
});

describe("the month removes the wrong side", () => {
	it("June keeps only the older set, as a certain fit", () => {
		const outcome = resolveVehicleOutcome(build(), car(2020, 6), { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).toEqual([SET_OLD]);
		expect(outcome.monthDependent).toEqual([]);
	});
	it("July keeps only the newer set, as a certain fit", () => {
		const outcome = resolveVehicleOutcome(build(), car(2020, 7), { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).toEqual([SET_NEW]);
		expect(outcome.monthDependent).toEqual([]);
	});
	it("a year inside both windows' reach needs no month and shows nothing as 'may fit'", () => {
		const outcome = resolveVehicleOutcome(build(), car(2022), { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).toEqual([SET_NEW]);
		expect(outcome.monthDependent).toEqual([]);
	});
});

describe("what a month cannot rescue stays out", () => {
	it("a row the source will not stand behind is still only the question, never 'may fit'", () => {
		const d = build({ oldRef: { qaStatus: "hold", eligibility: { sellable: false, reasons: ["hold"] } } });
		const result = resolveFitment(d, car(2020), { saleorProductId: SET_OLD, now: NOW });
		expect(result.verdict).toBe("NEEDS_DETAIL");
		const outcome = resolveVehicleOutcome(d, car(2020), { now: NOW });
		expect(outcome.monthDependent.map((o) => o.ref.saleorProductId)).toEqual([SET_NEW]);
	});

	it("an explicit negative row on the edge is the question, never 'may fit'", () => {
		const d = build({ negativeNew: true });
		const result = resolveFitment(d, car(2020), { saleorProductId: SET_NEW, now: NOW });
		expect(result.verdict).toBe("NEEDS_DETAIL");
	});

	it("a vehicle-level question with no product named makes no 'may fit' claim", () => {
		const result = resolveFitment(build(), car(2020), { now: NOW });
		expect(result.verdict).toBe("NEEDS_DETAIL");
	});

	it("still needs a roof the shopper did not give — the month is not the only open question", () => {
		const d = build();
		d.applications[1]!.qualifiers = { roofTypes: ["flush-rails"] };
		const result = resolveFitment(d, car(2020), { saleorProductId: SET_NEW, now: NOW });
		expect(result.verdict).not.toBe("MAY_FIT_BY_MONTH");
	});
});

describe("edges that cannot depend on the month", () => {
	const w = windowOf([2020, 1], [2022, 12]);
	it("a window that starts in January takes in the whole of its first year", () => {
		expect(matchWindow(w, 2020)).toBe("in");
	});
	it("a window that ends in December takes in the whole of its last year", () => {
		expect(matchWindow(w, 2022)).toBe("in");
	});
	it("a window that starts in February still asks", () => {
		expect(matchWindow(windowOf([2020, 2], null), 2020)).toBe("needs-detail");
	});
});

describe("the sentence", () => {
	const t = (key: string, values?: Record<string, string>) => `${key}:${JSON.stringify(values ?? {})}`;

	it("is the date, or no date when the windows disagree", () => {
		expect(monthCaveatText({ kind: "from", from: "03/2025" }, t)).toBe('monthCaveatFrom:{"date":"03/2025"}');
		expect(monthCaveatText({ kind: "to", to: "12/2024" }, t)).toBe('monthCaveatTo:{"date":"12/2024"}');
		expect(monthCaveatText({ kind: "between", from: "03/2024", to: "11/2024" }, t)).toBe(
			'monthCaveatBetween:{"from":"03/2024","to":"11/2024"}',
		);
		expect(monthCaveatText(null, t)).toBe("monthCaveatSeveral:{}");
	});

	it("two matched windows with different edges say 'depends on the month' without choosing one", () => {
		const d = build();
		d.applications[0]!.products = [aProduct({ saleorProductId: SET_NEW, saleorVariantId: "V-new" })];
		const result = resolveFitment(d, car(2020), { saleorProductId: SET_NEW, now: NOW });
		expect(result.verdict).toBe("MAY_FIT_BY_MONTH");
		expect(monthCaveatOf(result.matched, 2020)).toEqual({ kind: "several" });
	});

	it("never turns a year-precise edge into a month", () => {
		expect(monthCaveatOf([{ window: windowOf([2025], null) } as never], 2025)).toBeNull();
	});
});
