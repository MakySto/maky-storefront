import { describe, expect, it } from "vitest";

import { type FitmentResult, type FitmentVerdict } from "./contract";
import {
	A4_AVANT_B8,
	AUDI_2012,
	AUDI_OFFER,
	PASSAT_2025,
	PASSAT_OFFER,
	PASSAT_VARIANT_B9,
	n15060Dataset,
} from "./fixtures/n15060";
import {
	ABSENT_UNDER_PARTIAL_COVERAGE,
	intendedVehiclesFor,
	presentFitment,
	windowBounds,
} from "./intended-for";
import { resolveFitment } from "./resolve";

/**
 * What an offer is made for, on the two real offers of Nordrive N15060 (CFM export 2026-09-15).
 * The owner's case: the Audi set opened with a Passat in the Garage showed "Kompatibilitu zatiaľ
 * nevieme potvrdiť". It must say what the set is for instead — and nothing here may turn that
 * into "nepasuje".
 */

describe("intendedVehiclesFor", () => {
	it("names the car an offer is documented for, with the source's own window", () => {
		const [audi, ...rest] = intendedVehiclesFor(n15060Dataset(), AUDI_OFFER.productId, AUDI_OFFER.variantId);
		expect(rest).toEqual([]);
		expect(audi).toMatchObject({
			generationId: A4_AVANT_B8,
			name: "AUDI A4 Avant B8",
			roofTypes: ["flush-rails"],
			bodyTypes: ["estate"],
		});
		expect(windowBounds(audi.window)).toEqual({ from: "05/2008", to: "10/2015" });
	});

	it("keeps the two offers of one part number apart", () => {
		const passat = intendedVehiclesFor(n15060Dataset(), PASSAT_OFFER.productId, PASSAT_OFFER.variantId);
		expect(passat.map((v) => v.generationId)).toEqual([PASSAT_VARIANT_B9]);
		expect(windowBounds(passat[0].window)).toEqual({ from: "2024", to: null });
	});

	it("says nothing for a variant the source did not document", () => {
		expect(intendedVehiclesFor(n15060Dataset(), AUDI_OFFER.productId, "UHJvZHVjdFZhcmlhbnQ6OTk5")).toEqual(
			[],
		);
	});

	it("leaves out a row the source will not stand behind, and an explicit negative row", () => {
		const held = n15060Dataset();
		held.applications[1].products[0].qaStatus = "hold";
		expect(intendedVehiclesFor(held, AUDI_OFFER.productId)).toEqual([]);

		const unsellable = n15060Dataset();
		unsellable.applications[1].products[0].eligibility = {
			sellable: false,
			reasons: ["known_mapping_suspect"],
		};
		expect(intendedVehiclesFor(unsellable, AUDI_OFFER.productId)).toEqual([]);

		const negative = n15060Dataset();
		negative.applications[1].negative = true;
		expect(intendedVehiclesFor(negative, AUDI_OFFER.productId)).toEqual([]);
	});

	it("never names a vehicle by its id when the tree cannot name it", () => {
		const orphan = n15060Dataset({ generations: [] });
		expect(intendedVehiclesFor(orphan, AUDI_OFFER.productId)).toEqual([]);
	});

	it("is empty without a dataset", () => {
		expect(intendedVehiclesFor(null, AUDI_OFFER.productId)).toEqual([]);
	});
});

describe("windowBounds", () => {
	it("prints a month only where the source gave one", () => {
		expect(
			windowBounds({
				from: { year: 2019, month: 12 },
				to: { year: 2021 },
				startPrecision: "month",
				endPrecision: "year",
				reconciledToGeneration: true,
			}),
		).toEqual({ from: "12/2019", to: "2021" });
		// A month present on a year-precise boundary is not trusted either.
		expect(
			windowBounds({
				from: { year: 2019, month: 3 },
				to: null,
				startPrecision: "year",
				endPrecision: "open",
				reconciledToGeneration: true,
			}),
		).toEqual({ from: "2019", to: null });
	});
});

describe("presentFitment on the real N15060 offers", () => {
	const dataset = n15060Dataset();
	const audi = intendedVehiclesFor(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId);

	it("the owner's case: Audi set, Passat in the Garage → what the set is for, not 'we cannot confirm'", () => {
		const result = resolveFitment(dataset, PASSAT_2025, { ...offer(AUDI_OFFER) });
		expect(result).toMatchObject({ verdict: "UNKNOWN", reason: ABSENT_UNDER_PARTIAL_COVERAGE });
		expect(presentFitment(result, audi)).toEqual({ kind: "intended-for", vehicles: audi });
	});

	it("the Passat set with the Passat saved stays a fit — the green answer is not touched", () => {
		const passat = intendedVehiclesFor(dataset, PASSAT_OFFER.productId, PASSAT_OFFER.variantId);
		const result = resolveFitment(dataset, PASSAT_2025, { ...offer(PASSAT_OFFER) });
		expect(result.verdict).toBe("MANUFACTURER_FIT");
		expect(presentFitment(result, passat)).toEqual({ kind: "verdict" });
	});

	it("switching the Garage to the Audi turns the Audi set green and the Passat set into 'made for'", () => {
		const audiSet = resolveFitment(dataset, AUDI_2012, { ...offer(AUDI_OFFER) });
		expect(audiSet.verdict).toBe("MANUFACTURER_FIT");
		expect(presentFitment(audiSet, audi).kind).toBe("verdict");

		const passat = intendedVehiclesFor(dataset, PASSAT_OFFER.productId, PASSAT_OFFER.variantId);
		const passatSet = resolveFitment(dataset, AUDI_2012, { ...offer(PASSAT_OFFER) });
		expect(presentFitment(passatSet, passat)).toEqual({ kind: "intended-for", vehicles: passat });
	});

	it("no car saved → what the set is for, instead of a bare 'Vyberte vozidlo'", () => {
		const result = resolveFitment(dataset, null, { ...offer(AUDI_OFFER) });
		expect(result.verdict).toBe("NO_VEHICLE_SELECTED");
		expect(presentFitment(result, audi).kind).toBe("intended-for");
	});

	it("an unanswered roof on the right car still asks for the roof", () => {
		const result = resolveFitment(dataset, { ...AUDI_2012, roofType: undefined }, { ...offer(AUDI_OFFER) });
		expect(result.verdict).toBe("AMBIGUOUS");
		expect(presentFitment(result, audi).kind).toBe("verdict");
	});

	it("a boundary year without its month still asks for the month", () => {
		const result = resolveFitment(dataset, { ...AUDI_2012, year: 2008 }, { ...offer(AUDI_OFFER) });
		expect(result.verdict).toBe("NEEDS_DETAIL");
		expect(presentFitment(result, audi).kind).toBe("verdict");
	});

	it("a sibling variant the source did not document is not described as made for anything", () => {
		const sibling = { productId: AUDI_OFFER.productId, variantId: "UHJvZHVjdFZhcmlhbnQ6OTk5" };
		const result = resolveFitment(dataset, AUDI_2012, { ...offer(sibling) });
		// Not the Audi variant's green answer, carried over…
		expect(result.verdict).toBe("UNKNOWN");
		// …and not "Určené pre" either: nothing is documented for this variant.
		expect(
			presentFitment(result, intendedVehiclesFor(dataset, sibling.productId, sibling.variantId)),
		).toEqual({
			kind: "verdict",
		});
	});

	// Every verdict that is a statement keeps its own box, whatever the offer is documented for.
	it.each<[FitmentVerdict, string]>([
		["NO_FIT", "explicit-negative-row"],
		["NO_FIT", "absent-under-complete-coverage"],
		["AMBIGUOUS", "qa-conflict"],
		["AMBIGUOUS", "positive-and-negative-rows"],
		["UNKNOWN", "qa-hold"],
		["UNKNOWN", "unverified-evidence:derived"],
		["UNKNOWN", "product-ref-missing"],
		["STALE", "dataset-stale"],
		["PROVIDER_UNAVAILABLE", "provider-unavailable"],
		["NEEDS_DETAIL", "manufacture-month-required"],
		["VERIFIED_FIT", "cfm-verified"],
		["MANUFACTURER_FIT", "manufacturer-declared"],
		["UNIVERSAL", "universal-product"],
	])("%s (%s) is never replaced", (verdict, reason) => {
		expect(presentFitment(result(verdict, reason), audi)).toEqual({ kind: "verdict" });
	});

	it("with nothing documented to name, even 'no row for your car' keeps its box", () => {
		expect(presentFitment(result("UNKNOWN", ABSENT_UNDER_PARTIAL_COVERAGE), [])).toEqual({ kind: "verdict" });
	});
});

describe("expired data never names what an offer is for", () => {
	const DAY = 24 * 60 * 60 * 1000;
	const past = new Date(Date.now() - DAY).toISOString();
	const expired = {
		"validUntil in the past": n15060Dataset({ validity: { validUntil: past, staleAfterDays: 30 } }),
		"older than staleAfterDays": n15060Dataset({
			generatedAt: new Date(Date.now() - 31 * DAY).toISOString(),
		}),
	};

	// The real flow with no car saved: the resolver answers NO_VEHICLE_SELECTED before it checks
	// freshness, so the gate has to hold in `intendedVehiclesFor` itself.
	it.each(Object.entries(expired))("%s, no car saved → the ordinary 'choose a car' box", (_, dataset) => {
		const result = resolveFitment(dataset, null, { ...offer(AUDI_OFFER) });
		expect(result.verdict).toBe("NO_VEHICLE_SELECTED");
		expect(intendedVehiclesFor(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId)).toEqual([]);
		expect(
			presentFitment(result, intendedVehiclesFor(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId)),
		).toEqual({ kind: "verdict" });
	});

	it.each(Object.entries(expired))("%s, Passat saved → STALE, never 'Určené pre'", (_, dataset) => {
		const result = resolveFitment(dataset, PASSAT_2025, { ...offer(AUDI_OFFER) });
		expect(result.verdict).toBe("STALE");
		expect(
			presentFitment(result, intendedVehiclesFor(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId)),
		).toEqual({ kind: "verdict" });
	});

	it("fresh data with no car saved still names the car", () => {
		const dataset = n15060Dataset();
		const result = resolveFitment(dataset, null, { ...offer(AUDI_OFFER) });
		expect(
			presentFitment(result, intendedVehiclesFor(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId)).kind,
		).toBe("intended-for");
	});
});

describe("the resolver, variant by variant", () => {
	it("answers for the exact variant, and only for it", () => {
		const dataset = n15060Dataset();
		expect(resolveFitment(dataset, PASSAT_2025, { ...offer(PASSAT_OFFER) }).verdict).toBe("MANUFACTURER_FIT");
		expect(
			resolveFitment(dataset, PASSAT_2025, {
				saleorProductId: PASSAT_OFFER.productId,
				saleorVariantId: "UHJvZHVjdFZhcmlhbnQ6OTk5",
			}).verdict,
		).toBe("UNKNOWN");
		// Without a variant the product answers for all of them, as before.
		expect(resolveFitment(dataset, PASSAT_2025, { saleorProductId: PASSAT_OFFER.productId }).verdict).toBe(
			"MANUFACTURER_FIT",
		);
	});
});

function offer(o: { productId: string; variantId: string }) {
	return { saleorProductId: o.productId, saleorVariantId: o.variantId };
}

function result(verdict: FitmentVerdict, reason: string): FitmentResult {
	return { verdict, reason, coverage: "partial", product: null, matched: [], conditions: [], dataset: null };
}
