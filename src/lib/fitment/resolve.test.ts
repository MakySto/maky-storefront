import { describe, expect, it } from "vitest";

import { type FitmentDataset, type VehicleSelection } from "./contract";
import {
	candidateProductRefs,
	collectApplicationsForProduct,
	datasetSpeaksForProduct,
	isDatasetStale,
	resolveCandidates,
	resolveFitment,
	resolveVehicleOutcome,
} from "./resolve";

/**
 * The asymmetry these tests exist to protect:
 *
 *   YES needs a verified row covering the whole selection.
 *   NO needs explicit negative evidence, or a dataset that guarantees complete coverage.
 *   Everything else is "we don't know".
 *
 * The expensive failure is not a missing badge. It is telling somebody nothing fits
 * their car because a partial index happened not to mention it.
 */

const NOW = Date.parse("2026-09-04T00:00:00.000Z");

function dataset(overrides: Partial<FitmentDataset> = {}): FitmentDataset {
	return {
		schemaVersion: "1.0.0",
		datasetVersion: "test-1",
		datasetHash: "hash",
		generatedAt: "2026-09-01T00:00:00.000Z",
		source: { system: "test" },
		saleorInstance: "api.example.test",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: {
			scope: { programId: "test-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: ["skoda"],
		},
		makes: [
			{ id: "skoda", name: "Škoda" },
			{ id: "bmw", name: "BMW" },
		],
		models: [
			{ id: "octavia", makeId: "skoda", name: "Octavia" },
			{ id: "three", makeId: "bmw", name: "3" },
		],
		generations: [
			{
				id: "octavia-4",
				modelId: "octavia",
				name: "IV",
				productionYearFrom: 2020,
				productionYearTo: null,
				qualifiers: { roofTypes: ["naked-roof", "flush-rails"] },
			},
			{
				id: "g20",
				modelId: "three",
				name: "G20",
				productionYearFrom: 2018,
				productionYearTo: null,
				qualifiers: { roofTypes: ["flush-rails"] },
			},
		],
		applications: [
			{
				applicationId: "a1",
				generationId: "octavia-4",
				yearFrom: 2020,
				yearTo: null,
				qualifiers: { roofTypes: ["flush-rails"] },
				conditions: [{ code: "torque" }],
				verificationStatus: "verified",
				products: [
					{
						externalReference: "cfm:product:A",
						saleorProductId: "P1",
						saleorVariantId: "V1",
						productKind: "roof-rack-set",
					},
				],
			},
		],
		...overrides,
	};
}

const octaviaFlush: VehicleSelection = {
	makeId: "skoda",
	modelId: "octavia",
	generationId: "octavia-4",
	year: 2022,
	roofType: "flush-rails",
};

describe("saying yes", () => {
	it("confirms a verified row that covers the whole selection", () => {
		const result = resolveFitment(dataset(), octaviaFlush, { now: NOW });
		expect(result.verdict).toBe("VERIFIED_FIT");
		expect(result.matched).toHaveLength(1);
		expect(result.conditions.map((c) => c.code)).toEqual(["torque"]);
	});

	it("carries dataset provenance so a surface can say what it checked against", () => {
		const result = resolveFitment(dataset(), octaviaFlush, { now: NOW });
		expect(result.dataset).toEqual({
			datasetVersion: "test-1",
			generatedAt: "2026-09-01T00:00:00.000Z",
			schemaVersion: "1.0.0",
		});
	});

	it("refuses to promote a provisional row to a fit", () => {
		const d = dataset();
		d.applications[0]!.verificationStatus = "provisional";
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("UNKNOWN");
	});

	it("refuses to promote a year-hold row, no matter how well it matches", () => {
		const d = dataset();
		d.applications[0]!.verificationStatus = "year-hold";
		const result = resolveFitment(d, octaviaFlush, { now: NOW });
		expect(result.verdict).toBe("UNKNOWN");
		expect(result.reason).toBe("unverified-rows:year-hold");
	});
});

describe("saying no — and refusing to", () => {
	it("says no on explicit negative evidence", () => {
		const d = dataset();
		d.applications[0]!.negative = true;
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("NO_FIT");
	});

	it("says no when the row is absent but the make is declared completely covered", () => {
		const d = dataset({ applications: [] });
		const result = resolveFitment(d, octaviaFlush, { now: NOW });
		expect(result.verdict).toBe("NO_FIT");
		expect(result.coverage).toBe("complete");
	});

	it("says UNKNOWN — never NO_FIT — when the row is absent outside declared coverage", () => {
		const d = dataset({ applications: [] });
		const bmw: VehicleSelection = {
			makeId: "bmw",
			modelId: "three",
			generationId: "g20",
			year: 2021,
			roofType: "flush-rails",
		};
		const result = resolveFitment(d, bmw, { now: NOW });
		expect(result.verdict).toBe("UNKNOWN");
		expect(result.coverage).toBe("partial");
	});

	it("treats a provider outage as unanswerable, never as a no", () => {
		const result = resolveFitment(null, octaviaFlush, { now: NOW });
		expect(result.verdict).toBe("PROVIDER_UNAVAILABLE");
		expect(result.verdict).not.toBe("NO_FIT");
	});

	it("treats a stale dataset as unanswerable, even inside complete coverage", () => {
		const d = dataset({ generatedAt: "2020-01-01T00:00:00.000Z" });
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("STALE");
	});
});

describe("ambiguity", () => {
	it("asks rather than guesses when a constrained qualifier was not answered", () => {
		const { roofType: _omitted, ...withoutRoof } = octaviaFlush;
		const result = resolveFitment(dataset(), withoutRoof as VehicleSelection, { now: NOW });
		expect(result.verdict).toBe("AMBIGUOUS");
		expect(result.reason).toBe("qualifier-not-answered");
	});

	it("does not resolve a source that both affirms and denies the same selection", () => {
		const d = dataset();
		d.applications.push({ ...d.applications[0]!, applicationId: "a2", negative: true });
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("AMBIGUOUS");
	});

	it("reports a conflict row as ambiguous rather than picking a side", () => {
		const d = dataset();
		d.applications[0]!.verificationStatus = "conflict";
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("AMBIGUOUS");
	});

	it("an unanswered qualifier outranks an absent row, even under complete coverage", () => {
		const { roofType: _omitted, ...withoutRoof } = octaviaFlush;
		const result = resolveFitment(dataset(), withoutRoof as VehicleSelection, { now: NOW });
		expect(result.verdict).not.toBe("NO_FIT");
	});
});

describe("year windows", () => {
	it("excludes a year before the application window", () => {
		const d = dataset();
		d.applications[0]!.yearFrom = 2023;
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("NO_FIT");
	});

	it("excludes a year after a closed application window", () => {
		const d = dataset();
		d.applications[0]!.yearTo = 2021;
		expect(resolveFitment(d, octaviaFlush, { now: NOW }).verdict).toBe("NO_FIT");
	});

	it("treats a null yearTo as open-ended", () => {
		const d = dataset();
		expect(resolveFitment(d, { ...octaviaFlush, year: 2099 }, { now: NOW }).verdict).toBe("VERIFIED_FIT");
	});

	it("does not let generation production years widen an application window", () => {
		// The generation runs 2020-, the application only 2023-. 2021 must not fit.
		const d = dataset();
		d.applications[0]!.yearFrom = 2023;
		expect(resolveFitment(d, { ...octaviaFlush, year: 2021 }, { now: NOW }).verdict).not.toBe("VERIFIED_FIT");
	});
});

describe("the states that are not compatibility answers", () => {
	it("reports no vehicle selected without consulting rows", () => {
		expect(resolveFitment(dataset(), null, { now: NOW }).verdict).toBe("NO_VEHICLE_SELECTED");
	});

	it("reports a universal product as universal, with or without a vehicle", () => {
		expect(resolveFitment(dataset(), null, { universal: true, now: NOW }).verdict).toBe("UNIVERSAL");
		expect(resolveFitment(dataset(), octaviaFlush, { universal: true, now: NOW }).verdict).toBe("UNIVERSAL");
	});

	it("prefers a provider outage over every other state", () => {
		expect(resolveFitment(null, null, { universal: true, now: NOW }).verdict).toBe("PROVIDER_UNAVAILABLE");
	});
});

describe("product scoping", () => {
	it("answers for one product only when a product is named", () => {
		const d = dataset();
		expect(resolveFitment(d, octaviaFlush, { saleorProductId: "P1", now: NOW }).verdict).toBe("VERIFIED_FIT");
		// Another product, inside complete coverage, genuinely does not fit.
		expect(resolveFitment(d, octaviaFlush, { saleorProductId: "P-other", now: NOW }).verdict).toBe("NO_FIT");
	});

	it("lists the vehicles a product is documented for, with no vehicle selected", () => {
		expect(collectApplicationsForProduct(dataset(), "P1")).toHaveLength(1);
		expect(collectApplicationsForProduct(dataset(), "P-none")).toHaveLength(0);
	});

	it("never lists a negative row as an application the product is made for", () => {
		const d = dataset();
		d.applications[0]!.negative = true;
		expect(collectApplicationsForProduct(d, "P1")).toHaveLength(0);
	});
});

describe("scope — the gate that stops NO_FIT escaping the programme", () => {
	/**
	 * The pairing is the point. Inside a make the dataset claims completely,
	 * `resolveFitment` is ENTITLED to turn an absent row into NO_FIT — see the test
	 * above, where "P-other" is correctly ruled out. That entitlement is safe for a roof
	 * rack in the programme and a flat lie about a snow chain, a roof box or a pair of
	 * work boots, none of which this dataset has ever heard of.
	 *
	 * So the surfaces ask this first. If it answers false they show nothing at all.
	 */
	it("recognises a product the dataset has rows for", () => {
		expect(datasetSpeaksForProduct(dataset(), "P1")).toBe(true);
	});

	it("does not speak for a product outside the programme, even under complete coverage", () => {
		const d = dataset();
		// The verdict machinery WOULD answer, and it would answer "does not fit".
		expect(resolveFitment(d, octaviaFlush, { saleorProductId: "P-snow-chain", now: NOW }).verdict).toBe(
			"NO_FIT",
		);
		// Which is exactly why nothing is allowed to ask it about that product.
		expect(datasetSpeaksForProduct(d, "P-snow-chain")).toBe(false);
	});

	it("still speaks for a product it only rules out", () => {
		// A negative row is knowledge. Hiding the box would drop the one warning that
		// matters most — unlike collectApplicationsForProduct, which lists what a
		// product FITS and rightly excludes negatives.
		const d = dataset();
		d.applications[0]!.negative = true;
		expect(datasetSpeaksForProduct(d, "P1")).toBe(true);
		expect(collectApplicationsForProduct(d, "P1")).toHaveLength(0);
	});

	it("speaks for nothing when the provider is unavailable", () => {
		expect(datasetSpeaksForProduct(null, "P1")).toBe(false);
	});
});

describe("per-identity resolution — the bug that hid working sets", () => {
	/**
	 * v1 resolved the whole vehicle in one pass, so rows belonging to DIFFERENT products
	 * were merged. One explicitly-negative row for set B turned the entire vehicle into
	 * AMBIGUOUS and offered nothing — including set A, which fits.
	 */
	function twoSets(): FitmentDataset {
		const d = dataset();
		d.applications.push({
			applicationId: "a2",
			generationId: "octavia-4",
			yearFrom: 2020,
			yearTo: null,
			qualifiers: { roofTypes: ["flush-rails"] },
			conditions: [],
			verificationStatus: "verified",
			negative: true,
			products: [
				{
					externalReference: "cfm:product:B",
					saleorProductId: "P2",
					saleorVariantId: "V2",
					productKind: "roof-rack-set",
				},
			],
		});
		return d;
	}

	it("offers A when A fits and B does not", () => {
		const outcome = resolveVehicleOutcome(twoSets(), octaviaFlush, { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).toEqual(["P1"]);
		expect(outcome.rejected.map((o) => o.ref.saleorProductId)).toEqual(["P2"]);
		expect(outcome.unanswerable).toBe(false);
	});

	it("does not collapse the vehicle to AMBIGUOUS because one set disagrees", () => {
		const outcome = resolveVehicleOutcome(twoSets(), octaviaFlush, { now: NOW });
		expect(outcome.verified).toHaveLength(1);
	});

	it("one year-hold set does not block another verified set", () => {
		const d = dataset();
		d.applications.push({
			applicationId: "a3",
			generationId: "octavia-4",
			yearFrom: 2020,
			yearTo: null,
			qualifiers: { roofTypes: ["flush-rails"] },
			conditions: [],
			verificationStatus: "year-hold",
			products: [
				{
					externalReference: "cfm:product:C",
					saleorProductId: "P3",
					saleorVariantId: "V3",
					productKind: "roof-rack-set",
				},
			],
		});
		const outcome = resolveVehicleOutcome(d, octaviaFlush, { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).toEqual(["P1"]);
		expect(outcome.unconfirmed.map((o) => o.ref.saleorProductId)).toEqual(["P3"]);
	});

	it("never offers an unverified set", () => {
		const d = dataset();
		d.applications[0]!.verificationStatus = "provisional";
		const outcome = resolveVehicleOutcome(d, octaviaFlush, { now: NOW });
		expect(outcome.verified).toEqual([]);
		expect(outcome.unconfirmed).toHaveLength(1);
	});
});

describe("kind filtering — a roof box is not a roof rack", () => {
	function withBox(): FitmentDataset {
		const d = dataset();
		d.applications[0]!.products.push({
			externalReference: "cfm:product:BOX",
			saleorProductId: "P-BOX",
			saleorVariantId: "V-BOX",
			productKind: "roof-box",
		});
		return d;
	}

	it("excludes a roof box from the configurator's candidates", () => {
		const refs = candidateProductRefs(withBox(), octaviaFlush);
		expect(refs.map((r) => r.saleorProductId)).toEqual(["P1"]);
	});

	it("excludes it even though its application row is verified and matches", () => {
		const outcome = resolveVehicleOutcome(withBox(), octaviaFlush, { now: NOW });
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).not.toContain("P-BOX");
	});

	it("can still be asked about a different kind explicitly", () => {
		const refs = candidateProductRefs(withBox(), octaviaFlush, "roof-box");
		expect(refs.map((r) => r.saleorProductId)).toEqual(["P-BOX"]);
	});
});

describe("vehicle-level conditions stay vehicle-level", () => {
	it("reports a provider outage as unanswerable rather than as a no-fit list", () => {
		const outcome = resolveVehicleOutcome(null, octaviaFlush, { now: NOW });
		expect(outcome.unanswerable).toBe(true);
		expect(outcome.unanswerableVerdict).toBe("PROVIDER_UNAVAILABLE");
		expect(outcome.rejected).toEqual([]);
	});

	it("reports no vehicle as unanswerable, not as nothing fitting", () => {
		const outcome = resolveVehicleOutcome(dataset(), null, { now: NOW });
		expect(outcome.unanswerable).toBe(true);
		expect(outcome.unanswerableVerdict).toBe("NO_VEHICLE_SELECTED");
	});

	it("resolves every candidate independently", () => {
		expect(resolveCandidates(dataset(), octaviaFlush, { now: NOW })).toHaveLength(1);
	});
});

describe("staleness", () => {
	it("is stale past validUntil even when freshly generated", () => {
		const d = dataset({ validity: { validUntil: "2026-01-01T00:00:00.000Z", staleAfterDays: 3650 } });
		expect(isDatasetStale(d, NOW)).toBe(true);
	});

	it("treats an unparsable generatedAt as stale rather than fresh", () => {
		expect(isDatasetStale(dataset({ generatedAt: "not-a-date" }), NOW)).toBe(true);
	});
});
