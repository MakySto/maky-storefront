import { describe, expect, it } from "vitest";

import sample from "./fixtures/pilot-sample.json";
import { isFitmentOfferable, type VehicleSelection } from "./contract";
import { resolveFitment } from "./resolve";
import { validateFitmentDataset } from "./validate";

/**
 * CFM's real 3.0.0 pilot, two applications of it, copied verbatim.
 *
 * Two different things are checked here, and the second is the one that matters. That a
 * file passes the validator proves its SHAPE. That the resolver answers correctly on it
 * proves its MEANING — and a dataset can be perfectly well-formed while being read with
 * the wrong semantics, which is exactly what schema 2.1 would have allowed.
 *
 * The two rows were chosen because they are the awkward ones:
 *
 *   - Giulia 952, `12/19>` — month-precise start, open end, accepted and sellable. The
 *     boundary year is 2019, and 2019 is where a shopper's year alone is not enough.
 *   - Legacy BP, `01/99>04/03` reconciled to `{2003} .. 04/2003` — the start lost its
 *     month at import and the end kept one, so 2003 is undecidable from ONE side only.
 *     It is also a known-suspect mapping, held and not sellable.
 *
 * The identities are real: all 77 products in the full pilot were confirmed present,
 * published and reference-matched in `sk-eur` on 2026-09-06. Nothing here is invented,
 * and nothing here is a compatibility claim of ours — it is CFM's, quoted.
 */

const dataset = sample as unknown as Parameters<typeof resolveFitment>[0];

const giulia = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "veh:mk:3eeeea01-ae52-4405-9aa4-0ad3743f3824",
	modelId: "veh:md:61ac245d-bef2-422e-923c-28691365b373",
	generationId: "veh:gn:8cf6a796-a52e-4b72-878f-ebccd52a151e",
	year,
	manufactureMonth,
	roofType: "naked-roof",
	bodyType: "saloon",
});

const legacy = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "veh:mk:a94a0388-ca51-4c2b-a0ff-ff26464bcfab",
	modelId: "veh:md:3a4efb6f-7476-481c-8cbd-4bb80e562450",
	generationId: "veh:gn:7860f324-9fb5-4369-a759-11c05af7c0b4",
	year,
	manufactureMonth,
	roofType: "raised-rails",
	bodyType: "estate",
});

const GIULIA_SET = "UHJvZHVjdDo1OTM=";
const LEGACY_SET = "UHJvZHVjdDo4NDcy";

describe("shape", () => {
	it("passes the 3.0.0 validator against this build's Saleor instance", () => {
		const result = validateFitmentDataset(sample, { expectedSaleorInstance: "api.maky.store" });
		expect(result.ok).toBe(true);
		expect(result.ok && result.warnings).toEqual([]);
	});

	it("is refused against a different Saleor instance — the ids are instance-bound", () => {
		const result = validateFitmentDataset(sample, { expectedSaleorInstance: "staging.example" });
		expect(result.ok).toBe(false);
	});

	it("claims no complete coverage, so absence can never become NO_FIT", () => {
		expect(sample.coverage.completeForMakeIds).toEqual([]);
	});
});

describe("meaning — the manufacturer's word, on a real row", () => {
	it("offers an inner year without asking for a month", () => {
		const r = resolveFitment(dataset, giulia(2022), { saleorProductId: GIULIA_SET });
		expect(r.verdict).toBe("MANUFACTURER_FIT");
		expect(isFitmentOfferable({ verdict: r.verdict, eligibility: r.product?.eligibility })).toBe(true);
		expect(r.product?.verification).toBe("not-independently-verified");
		expect(r.product?.evidence.supplier).toBe("nordrive");
	});

	it("asks for the month on the boundary year, and answers once it has it", () => {
		expect(resolveFitment(dataset, giulia(2019), { saleorProductId: GIULIA_SET }).verdict).toBe(
			"NEEDS_DETAIL",
		);
		expect(resolveFitment(dataset, giulia(2019, 12), { saleorProductId: GIULIA_SET }).verdict).toBe(
			"MANUFACTURER_FIT",
		);
		// A car built one month before the window opens is not a fit, and saying so needs
		// the month — which is the whole reason the question is asked.
		expect(resolveFitment(dataset, giulia(2019, 11), { saleorProductId: GIULIA_SET }).verdict).not.toBe(
			"MANUFACTURER_FIT",
		);
	});

	it("never claims a fit before the window opens", () => {
		const r = resolveFitment(dataset, giulia(2018), { saleorProductId: GIULIA_SET });
		expect(isFitmentOfferable({ verdict: r.verdict, eligibility: r.product?.eligibility })).toBe(false);
		// And it is UNKNOWN, not NO_FIT: this dataset claims no complete coverage.
		expect(r.verdict).toBe("UNKNOWN");
	});
});

describe("meaning — the held row", () => {
	it("is never offerable, however well it matches", () => {
		const r = resolveFitment(dataset, legacy(2003, 4), { saleorProductId: LEGACY_SET });
		expect(r.product?.eligibility.sellable).toBe(false);
		expect(r.product?.eligibility.reasons).toEqual(["known_mapping_suspect"]);
		expect(isFitmentOfferable({ verdict: r.verdict, eligibility: r.product?.eligibility })).toBe(false);
	});

	it("reads as 'we cannot confirm this', not as 'your car is wrong'", () => {
		// The source disputes the mapping. That is our uncertainty, not a fact about the
		// customer's vehicle, and the shopper must never be told otherwise.
		const r = resolveFitment(dataset, legacy(2003, 4), { saleorProductId: LEGACY_SET });
		expect(r.verdict).toBe("UNKNOWN");
		expect(r.verdict).not.toBe("NO_FIT");
	});

	it("still asks for the month it needs, even on a row it will refuse anyway", () => {
		// The start lost its month to reconciliation and the end kept one, so 2003 is
		// undecidable from one side. The question comes before the refusal, because the
		// refusal is about the mapping and the question is about the car.
		expect(resolveFitment(dataset, legacy(2003), { saleorProductId: LEGACY_SET }).verdict).toBe(
			"NEEDS_DETAIL",
		);
	});
});
