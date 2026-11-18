import { describe, expect, it } from "vitest";

import { type FitmentApplication, type FitmentDataset, type VehicleSelection } from "./contract";
import { aProduct, aWindow } from "./fixtures/build";
import { resolveFitment, resolveVehicleOutcome } from "./resolve";
import { validateFitmentDataset } from "./validate";

/**
 * CFM, 2026-11-17: a Thule set is often made twice for one car, once for the car with a glass
 * (panoramic) roof and once for the car without; vans the same by roof height. The shop has to ask
 * and to offer only the set for the shopper's version.
 *
 * Complete coverage is declared for NO make here, on purpose: "this set is for the other version" is
 * the source's statement about the set, and must not need a complete make to be said.
 */

const NOW = Date.parse("2026-11-18T00:00:00.000Z");

const WITHOUT = aProduct({
	saleorProductId: "set-without",
	saleorVariantId: "var-without",
	externalReference: "cfm:product:without",
});
const WITH = aProduct({
	saleorProductId: "set-with",
	saleorVariantId: "var-with",
	externalReference: "cfm:product:with",
});
const EITHER = aProduct({
	saleorProductId: "set-either",
	saleorVariantId: "var-either",
	externalReference: "cfm:product:either",
});
const OCTAVIA_SET = aProduct({
	saleorProductId: "set-octavia",
	saleorVariantId: "var-octavia",
	externalReference: "cfm:product:octavia",
});
const VAN_STANDARD = aProduct({
	saleorProductId: "set-std-roof",
	saleorVariantId: "var-std-roof",
	externalReference: "cfm:product:std",
});
const VAN_HIGH = aProduct({
	saleorProductId: "set-high-roof",
	saleorVariantId: "var-high-roof",
	externalReference: "cfm:product:high",
});

function application(
	id: string,
	generationId: string,
	qualifiers: FitmentApplication["qualifiers"],
	product: ReturnType<typeof aProduct>,
	over: Partial<FitmentApplication> = {},
): FitmentApplication {
	return {
		applicationId: id,
		generationId,
		window: aWindow({ from: { year: 2015 }, to: null }),
		qualifiers,
		conditions: [],
		products: [product],
		...over,
	};
}

function dataset(over: Partial<FitmentDataset> = {}): FitmentDataset {
	return {
		schemaVersion: "3.1.0",
		datasetVersion: "variants-1",
		datasetHash: "demo-no-hash-this-is-not-a-cfm-export",
		generatedAt: "2026-11-17T00:00:00.000Z",
		source: { system: "test" },
		saleorInstance: "api.example.test",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: {
			scope: { programId: "test-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: [],
		},
		makes: [{ id: "toyota", name: "Toyota" }],
		models: [{ id: "yaris", makeId: "toyota", name: "Yaris" }],
		generations: [
			{
				id: "yaris-4",
				modelId: "yaris",
				name: "XP210",
				productionYearFrom: 2020,
				productionYearTo: null,
				qualifiers: { glassRoof: ["with", "without"] },
			},
			{
				id: "octavia-4",
				modelId: "yaris",
				name: "No variants",
				productionYearFrom: 2020,
				productionYearTo: null,
				qualifiers: {},
			},
			{
				id: "van-1",
				modelId: "yaris",
				name: "Van",
				productionYearFrom: 2020,
				productionYearTo: null,
				qualifiers: { roofHeight: ["standard", "high"], glassRoof: ["with", "without"] },
			},
		],
		applications: [
			application("y-without", "yaris-4", { glassRoof: ["without"] }, WITHOUT),
			application("y-with", "yaris-4", { glassRoof: ["with"] }, WITH),
			application("y-either", "yaris-4", {}, EITHER),
			application("o-1", "octavia-4", {}, OCTAVIA_SET),
			application("v-std", "van-1", { roofHeight: ["standard"] }, VAN_STANDARD),
			application("v-high", "van-1", { roofHeight: ["high"] }, VAN_HIGH),
		],
		...over,
	};
}

const YARIS: VehicleSelection = { makeId: "toyota", modelId: "yaris", generationId: "yaris-4", year: 2022 };
const ids = (outcomes: { ref: { saleorProductId: string } }[]) =>
	outcomes.map((o) => o.ref.saleorProductId).sort();

describe("glass roof: the shop asks, then offers only the set for the shopper's version", () => {
	it("without a glass roof: the set for that version fits, the other is NO_FIT", () => {
		const selection = { ...YARIS, glassRoof: "without" as const };
		const fits = resolveFitment(dataset(), selection, { saleorProductId: "set-without", now: NOW });
		expect(fits.verdict).toBe("VERIFIED_FIT");
		const other = resolveFitment(dataset(), selection, { saleorProductId: "set-with", now: NOW });
		expect(other.verdict).toBe("NO_FIT");
		expect(other.reason).toBe("other-roof-variant");
		// It says which version the set is for, so the page can say it in words.
		expect(other.variant?.madeFor).toEqual({ glassRoof: ["with"] });
	});

	it("with a glass roof: the other way round", () => {
		const selection = { ...YARIS, glassRoof: "with" as const };
		expect(resolveFitment(dataset(), selection, { saleorProductId: "set-with", now: NOW }).verdict).toBe(
			"VERIFIED_FIT",
		);
		const other = resolveFitment(dataset(), selection, { saleorProductId: "set-without", now: NOW });
		expect(other.verdict).toBe("NO_FIT");
		expect(other.variant?.madeFor).toEqual({ glassRoof: ["without"] });
	});

	it("a set with no restriction fits both versions", () => {
		for (const glassRoof of ["with", "without"] as const) {
			const result = resolveFitment(
				dataset(),
				{ ...YARIS, glassRoof },
				{ saleorProductId: "set-either", now: NOW },
			);
			expect(result.verdict).toBe("VERIFIED_FIT");
		}
	});

	it("no answer: sets made for one version are AMBIGUOUS and the question is named, never guessed", () => {
		for (const productId of ["set-with", "set-without"]) {
			const result = resolveFitment(dataset(), YARIS, { saleorProductId: productId, now: NOW });
			expect(result.verdict).toBe("AMBIGUOUS");
			expect(result.reason).toBe("qualifier-not-answered");
			expect(result.variant?.ask).toEqual(["glassRoof"]);
		}
		// The set that does not care is not held back by a question it does not need.
		expect(resolveFitment(dataset(), YARIS, { saleorProductId: "set-either", now: NOW }).verdict).toBe(
			"VERIFIED_FIT",
		);
	});

	it("the offer list holds only the right version and never lists the other as a fit", () => {
		const outcome = resolveVehicleOutcome(dataset(), { ...YARIS, glassRoof: "without" }, { now: NOW });
		expect(ids(outcome.verified)).toEqual(["set-either", "set-without"]);
		expect(ids(outcome.rejected)).toEqual(["set-with"]);
		expect(outcome.monthDependent).toEqual([]);
	});

	it("with no answer neither version is offered, and both are held as unconfirmed", () => {
		const outcome = resolveVehicleOutcome(dataset(), YARIS, { now: NOW });
		expect(ids(outcome.verified)).toEqual(["set-either"]);
		expect(ids(outcome.unconfirmed)).toEqual(["set-with", "set-without"]);
		expect(outcome.rejected).toEqual([]);
	});

	it("a car whose generation has no such difference is asked nothing and offered what it was", () => {
		const octavia: VehicleSelection = {
			makeId: "toyota",
			modelId: "yaris",
			generationId: "octavia-4",
			year: 2022,
		};
		const result = resolveFitment(dataset(), octavia, { saleorProductId: "set-octavia", now: NOW });
		expect(result.verdict).toBe("VERIFIED_FIT");
		expect(result.variant).toBeUndefined();
	});
});

describe("the other version is NO_FIT only where the set is documented for this car and these years", () => {
	it("a year outside the application's window is not a variant miss", () => {
		const d = dataset({
			applications: [
				application("y-without", "yaris-4", { glassRoof: ["without"] }, WITHOUT, {
					window: aWindow({ from: { year: 2020 }, to: { year: 2021 }, endPrecision: "year" }),
				}),
			],
		});
		const result = resolveFitment(
			d,
			{ ...YARIS, year: 2024, glassRoof: "with" },
			{
				saleorProductId: "set-without",
				now: NOW,
			},
		);
		expect(result.verdict).toBe("UNKNOWN");
		expect(result.reason).toBe("absent-under-partial-coverage");
	});

	it("a miss on another qualifier stays an absence, not a roof-variant statement", () => {
		const d = dataset({
			applications: [
				application("y-1", "yaris-4", { glassRoof: ["without"], roofTypes: ["flush-rails"] }, WITHOUT),
			],
		});
		const result = resolveFitment(
			d,
			{ ...YARIS, glassRoof: "with", roofType: "raised-rails" },
			{
				saleorProductId: "set-without",
				now: NOW,
			},
		);
		expect(result.verdict).toBe("UNKNOWN");
	});

	it("an unanswered roof type does not rescue the other version's set: the answered variant decides", () => {
		const d = dataset({
			applications: [
				application("y-1", "yaris-4", { glassRoof: ["without"], roofTypes: ["flush-rails"] }, WITHOUT),
			],
		});
		const result = resolveFitment(
			d,
			{ ...YARIS, glassRoof: "with" },
			{
				saleorProductId: "set-without",
				now: NOW,
			},
		);
		expect(result.verdict).toBe("NO_FIT");
	});

	it("a vehicle-level question names no set, so it makes no statement about one", () => {
		const result = resolveFitment(dataset(), { ...YARIS, glassRoof: "without" }, { now: NOW });
		expect(result.verdict).not.toBe("NO_FIT");
	});

	it("another application of the same set that matches wins over the miss", () => {
		const d = dataset({
			applications: [
				application("y-without", "yaris-4", { glassRoof: ["without"] }, WITHOUT),
				application("y-both", "yaris-4", { glassRoof: ["with"] }, WITHOUT),
			],
		});
		const result = resolveFitment(
			d,
			{ ...YARIS, glassRoof: "with" },
			{ saleorProductId: "set-without", now: NOW },
		);
		expect(result.verdict).toBe("VERIFIED_FIT");
	});
});

describe("roof height (vans)", () => {
	const van: VehicleSelection = { makeId: "toyota", modelId: "yaris", generationId: "van-1", year: 2022 };

	it("offers the set for the answered height and rejects the other", () => {
		const high = resolveVehicleOutcome(
			dataset(),
			{ ...van, roofHeight: "high", glassRoof: "without" },
			{ now: NOW },
		);
		expect(ids(high.verified)).toEqual(["set-high-roof"]);
		expect(ids(high.rejected)).toEqual(["set-std-roof"]);
		const rejected = high.rejected[0]!.result;
		expect(rejected.variant?.madeFor).toEqual({ roofHeight: ["standard"] });
	});

	it("asks for the height when it is missing", () => {
		const result = resolveFitment(
			dataset(),
			{ ...van, glassRoof: "without" },
			{
				saleorProductId: "set-high-roof",
				now: NOW,
			},
		);
		expect(result.verdict).toBe("AMBIGUOUS");
		expect(result.variant?.ask).toEqual(["roofHeight"]);
	});
});

describe("the dataset carrying the keys", () => {
	it("is accepted when it says 3.1.0 and the values are known", () => {
		const result = validateFitmentDataset(dataset(), { allowUnhashedFixture: true });
		// Only the variant keys are under test: any other complaint about this stripped harness is noise.
		const text = result.ok ? "" : result.errors.join("\n");
		expect(text).not.toMatch(/glassRoof|roofHeight/);
	});

	it("is refused when a roof variant sits in a file that says 3.0.0", () => {
		const result = validateFitmentDataset(dataset({ schemaVersion: "3.0.0" }), {
			allowUnhashedFixture: true,
		});
		expect(result.ok).toBe(false);
		const text = !result.ok ? result.errors.join("\n") : "";
		expect(text).toMatch(/glassRoof: needs schemaVersion 3\.1\.0/);
	});

	it("refuses an empty list and an unknown value", () => {
		const d = dataset();
		d.applications[0]!.qualifiers = { glassRoof: [] };
		// @ts-expect-error deliberately malformed
		d.applications[1]!.qualifiers = { glassRoof: ["panorama"] };
		const result = validateFitmentDataset(d, { allowUnhashedFixture: true });
		const text = !result.ok ? result.errors.join("\n") : "";
		expect(text).toMatch(/glassRoof: empty array/);
		expect(text).toMatch(/glassRoof: "panorama" is not a known value/);
	});
});
