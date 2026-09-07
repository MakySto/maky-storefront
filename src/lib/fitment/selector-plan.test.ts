import { describe, expect, it } from "vitest";

import { anApplication, aProduct, windowOf } from "./fixtures/build";
import {
	monthDecidesFor,
	resolveGenerationForYear,
	resolveSingleValued,
	roofChoicesFor,
	yearsForModel,
} from "./selector-plan";
import { resolveFitment } from "./resolve";
import { type FitmentDataset, type VehicleSelection } from "./contract";

const gen = (id: string, from: number, to: number | null, qualifiers: Record<string, unknown> = {}) =>
	({
		id,
		modelId: "m",
		name: id.toUpperCase(),
		productionYearFrom: from,
		productionYearTo: to,
		qualifiers,
	}) as never;

describe("years come from PRODUCTION, and cover the whole model", () => {
	it("unions every generation's span, newest first", () => {
		expect(yearsForModel([gen("a", 2010, 2013), gen("b", 2014, 2016)])).toEqual([
			2016, 2015, 2014, 2013, 2012, 2011, 2010,
		]);
	});

	it("caps an open-ended generation at next year rather than running forever", () => {
		const years = yearsForModel([gen("a", 2020, null)]);
		expect(years[0]).toBe(new Date().getUTCFullYear() + 1);
		expect(years.length).toBeLessThan(50);
	});

	it("does not double-count an overlapping year", () => {
		const years = yearsForModel([gen("a", 2010, 2015), gen("b", 2015, 2018)]);
		expect(years.filter((y) => y === 2015)).toHaveLength(1);
	});
});

describe("the generation is DERIVED from the year", () => {
	it("resolves when the year lands in exactly one generation", () => {
		const r = resolveGenerationForYear([gen("a", 2010, 2014), gen("b", 2015, 2019)], 2012);
		expect(r.kind).toBe("resolved");
		expect(r.kind === "resolved" && r.generation.id).toBe("a");
	});

	it("ASKS when the year lands in two — never takes the first", () => {
		// Manufacturers run the outgoing and incoming generation in the same calendar
		// year. Picking the first result is a coin toss dressed up as an answer.
		const r = resolveGenerationForYear([gen("a", 2010, 2015), gen("b", 2015, 2019)], 2015);
		expect(r.kind).toBe("ambiguous");
		expect(r.kind === "ambiguous" && r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
	});

	it("resolves nothing for a year the model was never built in", () => {
		expect(resolveGenerationForYear([gen("a", 2010, 2014)], 2020).kind).toBe("none");
	});

	it("treats an open-ended generation as still running", () => {
		const r = resolveGenerationForYear([gen("a", 2020, null)], new Date().getUTCFullYear());
		expect(r.kind).toBe("resolved");
	});
});

describe("the month is asked only when it can change the answer", () => {
	const app = (from: [number, number?], to: [number, number?] | null) =>
		anApplication({ generationId: "g", window: windowOf(from, to) });

	it("asks on a month-precise start boundary", () => {
		expect(monthDecidesFor([app([2019, 12], null)], "g", 2019)).toBe(true);
	});

	it("asks on a month-precise end boundary", () => {
		expect(monthDecidesFor([app([2015], [2019, 6])], "g", 2019)).toBe(true);
	});

	it("does NOT ask when the boundary is year-precise", () => {
		// The source said a year and admitted it does not know the month, so the whole
		// boundary year is inside the window. Asking would collect an answer we have
		// already decided to ignore — and 38 applications in the current candidate
		// export are exactly this shape.
		expect(monthDecidesFor([app([2019], null)], "g", 2019)).toBe(false);
	});

	it("does NOT ask for a year that is not on any boundary", () => {
		expect(monthDecidesFor([app([2015, 3], [2019, 9])], "g", 2017)).toBe(false);
	});

	it("ignores applications for other generations", () => {
		expect(monthDecidesFor([app([2019, 12], null)], "other-gen", 2019)).toBe(false);
	});
});

describe("roof choices describe the CAR, not the catalogue", () => {
	it("returns a single known roof rather than dropping the question", () => {
		const generation = { id: "g", roofTypes: ["raised-rails" as const] };
		expect(roofChoicesFor([], generation)).toEqual(["raised-rails"]);
	});

	it("keeps a roof the car has even when no application mentions it", () => {
		const generation = { id: "g", roofTypes: ["naked-roof" as const, "flush-rails" as const] };
		const apps = [anApplication({ generationId: "g", qualifiers: { roofTypes: ["flush-rails"] } })];
		expect(roofChoicesFor(apps, generation).sort()).toEqual(["flush-rails", "naked-roof"]);
	});

	it("adds a roof an application knows about that the generation's list missed", () => {
		const generation = { id: "g", roofTypes: ["naked-roof" as const] };
		const apps = [anApplication({ generationId: "g", qualifiers: { roofTypes: ["fixpoint"] } })];
		expect(roofChoicesFor(apps, generation).sort()).toEqual(["fixpoint", "naked-roof"]);
	});

	it("returns nothing when no roof constraint exists anywhere — then it IS resolved", () => {
		expect(roofChoicesFor([anApplication({ generationId: "g" })], { id: "g" })).toEqual([]);
	});
});

describe("a single-valued qualifier is answered, not discarded", () => {
	it("fills a single value rather than asking about it", () => {
		expect(resolveSingleValued(["suv"])).toEqual({ ask: null, fill: "suv" });
	});

	it("asks when there is genuinely a choice", () => {
		expect(resolveSingleValued(["hatchback", "estate"])).toEqual({
			ask: ["hatchback", "estate"],
			fill: null,
		});
	});

	it("does neither when there is nothing to say", () => {
		expect(resolveSingleValued(null)).toEqual({ ask: null, fill: null });
		expect(resolveSingleValued([])).toEqual({ ask: null, fill: null });
	});
});

/**
 * The hole, end to end.
 *
 * This is the shape it was proven in before the fix, and it is the shape it must never
 * come back in: a generation with ONE roof type and a verified application. Dropping the
 * question did not substitute anything — no safety hole — but it left the qualifier
 * unanswered, and an unanswered qualifier is AMBIGUOUS, so the configurator offered such
 * a vehicle nothing at all. With real data that would be the common case, not the edge.
 */
describe("the functional hole this all exists to close", () => {
	const dataset = {
		schemaVersion: "3.0.0",
		datasetVersion: "test",
		datasetHash: "test",
		generatedAt: new Date().toISOString(),
		source: { system: "test" },
		saleorInstance: "test",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: { scope: { programId: "test", productKinds: ["roof-rack-set"] }, completeForMakeIds: [] },
		makes: [{ id: "mk", name: "Make" }],
		models: [{ id: "m", makeId: "mk", name: "Model" }],
		generations: [gen("g", 2016, 2024, { roofTypes: ["raised-rails"], bodyTypes: ["suv"], doors: [5] })],
		applications: [
			anApplication({
				applicationId: "app",
				generationId: "g",
				window: windowOf([2016], [2024]),
				qualifiers: { roofTypes: ["raised-rails"] },
				products: [aProduct()],
			}),
		],
	} as unknown as FitmentDataset;

	const selection = (over: Partial<VehicleSelection> = {}): VehicleSelection => ({
		makeId: "mk",
		modelId: "m",
		generationId: "g",
		year: 2019,
		bodyType: "suv",
		doors: 5,
		...over,
	});

	it("was AMBIGUOUS when the single-valued roof question was skipped", () => {
		const result = resolveFitment(dataset, selection(), { saleorProductId: "test-product-set-a" });
		expect(result.verdict).toBe("AMBIGUOUS");
		expect(result.reason).toBe("qualifier-not-answered");
	});

	it("is a fit once the shopper confirms the roof — which is why we now always ask", () => {
		// A verdict is per-product: without a named product the resolver answers
		// "no-product-named", because "something fits your car" is not a claim this
		// feature makes.
		const result = resolveFitment(dataset, selection({ roofType: "raised-rails" }), {
			saleorProductId: "test-product-set-a",
		});
		expect(result.verdict).toBe("VERIFIED_FIT");
	});

	it("stays honest when the shopper says 'a different type' — no roof is substituted", () => {
		// "Iný typ" and "Neviem rozpoznať" both leave roofType unset. The answer is
		// "we cannot confirm", never a fit derived from the only roof we stock.
		const result = resolveFitment(dataset, selection(), { saleorProductId: "test-product-set-a" });
		expect(result.verdict).toBe("AMBIGUOUS");
		expect(result.verdict).not.toBe("VERIFIED_FIT");
		expect(result.verdict).not.toBe("MANUFACTURER_FIT");
	});
});
