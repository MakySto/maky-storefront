import { describe, expect, it } from "vitest";

import pilot from "./fixtures/pilot-3.0.0-20260906.2.json";
import { isFitmentOfferable, type VehicleSelection } from "./contract";
import { resolveFitment } from "./resolve";

/**
 * CFM's real 3.0.0 pilot, read the way a shopper's answers reach it.
 *
 * Shape is checked next door in `pilot-conformance.test.ts`. What is checked HERE is
 * MEANING, and it is the half that matters: a dataset can be perfectly well-formed while
 * being read with the wrong semantics, which is exactly what schema 2.1 would have
 * allowed — every month silently dropped and every decision still made from years.
 *
 * These rows were chosen because they are the awkward ones, and all three are real:
 *
 *   - Tourneo Courier V769, `11/23>` — month-precise start, open end. 2023 is the
 *     boundary year, and it is where a shopper's year alone cannot answer.
 *   - A6 Avant 4B, `08/94>02/05` reconciled to `{1998} .. 02/2005` — the start lost its
 *     month to the generation clamp and the end kept one, so 2005 is undecidable from
 *     ONE side only. `reconciledToGeneration: true` is what marks that clamp.
 *   - H-1 Van TQ, `10/97>01/08` clamped to `{2008} .. 01/2008` — a known-suspect
 *     mapping. All six of its products are held and none may be sold, however well the
 *     vehicle matches.
 *
 * Nothing here is a compatibility claim of ours. It is CFM's, quoted, and every identity
 * was confirmed present, published and reference-matched in `sk-eur` (67/67 on
 * 2026-09-07). The evidence on every product in this pilot is `manufacturer-application`
 * with `not-independently-verified`, so the honest verdict is MANUFACTURER_FIT — never
 * "verified", which is the whole of B0.3.
 */

const dataset = pilot as unknown as Parameters<typeof resolveFitment>[0];

/** Tourneo Courier V769 — month-precise start, open end. */
const courier = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "veh:mk:0bd541b6-a9d0-4557-9d72-0e01961cdc55",
	modelId: "veh:md:f7b7403d-1bb8-463f-a9bb-be3b78f6cb8e",
	generationId: "veh:gn:00becc7f-8589-4395-89d3-2102dd34d51c",
	year,
	manufactureMonth,
	roofType: "raised-rails",
	bodyType: "mpv",
});

/** A6 Avant 4B — start clamped to the generation, end month-precise. */
const a6 = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "veh:mk:8f572ed9-e52a-4ca5-8a8d-f5c99c9ad32c",
	modelId: "veh:md:d7f5602c-c7b2-4ba5-80c0-b3a02222ebb1",
	generationId: "veh:gn:125d8150-98d1-4e23-8420-dc04b8a0a289",
	year,
	manufactureMonth,
	roofType: "raised-rails",
	bodyType: "estate",
});

/** H-1 Van TQ — a held mapping. */
const h1 = (year: number, manufactureMonth?: number): VehicleSelection => ({
	makeId: "veh:mk:f1c04661-be53-447b-b6aa-81fac10756ec",
	modelId: "veh:md:0f4cc205-de4b-4b9c-bef2-9ea34aaf7ae8",
	generationId: "veh:gn:26acdc13-ba24-4ee5-9537-12a3910723fb",
	year,
	manufactureMonth,
	roofType: "raised-rails",
	bodyType: "van",
});

const COURIER_SET = "UHJvZHVjdDozNzMw";
const A6_SET = "UHJvZHVjdDo5NDU=";
const H1_SET = "UHJvZHVjdDo0MDI0";

describe("an open-ended window, month-precise at the start", () => {
	it("offers a later year without ever asking for a month", () => {
		// 2025 is past the boundary from every direction. Asking for a month here would
		// be collecting an answer that cannot change the outcome.
		const result = resolveFitment(dataset, courier(2025), { saleorProductId: COURIER_SET });
		expect(result.verdict).toBe("MANUFACTURER_FIT");
		expect(isFitmentOfferable({ verdict: result.verdict, eligibility: result.product?.eligibility })).toBe(
			true,
		);
	});

	it("asks for the month on the boundary year, and answers once it has it", () => {
		const unknownMonth = resolveFitment(dataset, courier(2023), { saleorProductId: COURIER_SET });
		expect(unknownMonth.verdict).toBe("NEEDS_DETAIL");

		// The window opens in November, so November is in and October is not.
		expect(resolveFitment(dataset, courier(2023, 11), { saleorProductId: COURIER_SET }).verdict).toBe(
			"MANUFACTURER_FIT",
		);
		expect(resolveFitment(dataset, courier(2023, 10), { saleorProductId: COURIER_SET }).verdict).toBe(
			"UNKNOWN",
		);
	});

	it("never claims a fit before the window opens", () => {
		expect(resolveFitment(dataset, courier(2022), { saleorProductId: COURIER_SET }).verdict).not.toBe(
			"MANUFACTURER_FIT",
		);
	});
});

describe("a window clamped at one end only", () => {
	it("needs no month at the clamped start — the source admitted it does not know one", () => {
		// `reconciledToGeneration: true`, `startPrecision: "year"`. The whole of 1998 is
		// inside the window, so a month cannot move the answer and is not asked for.
		const result = resolveFitment(dataset, a6(1998), { saleorProductId: A6_SET });
		expect(result.verdict).toBe("MANUFACTURER_FIT");
	});

	it("still needs one at the month-precise end", () => {
		expect(resolveFitment(dataset, a6(2005), { saleorProductId: A6_SET }).verdict).toBe("NEEDS_DETAIL");
		expect(resolveFitment(dataset, a6(2005, 2), { saleorProductId: A6_SET }).verdict).toBe(
			"MANUFACTURER_FIT",
		);
		expect(resolveFitment(dataset, a6(2005, 3), { saleorProductId: A6_SET }).verdict).toBe("UNKNOWN");
	});
});

describe("a held mapping", () => {
	it("is never offerable, however well the vehicle matches", () => {
		const result = resolveFitment(dataset, h1(2008, 1), { saleorProductId: H1_SET });
		expect(isFitmentOfferable({ verdict: result.verdict, eligibility: result.product?.eligibility })).toBe(
			false,
		);
		expect(result.product?.eligibility.sellable).toBe(false);
		expect(result.product?.eligibility.reasons).toContain("known_mapping_suspect");
	});

	it("reads as 'we cannot confirm this', not as 'your car is wrong'", () => {
		// The distinction is the point: a hold is OUR uncertainty about a mapping, not a
		// fact about the shopper's vehicle. NO_FIT would be a claim we cannot make.
		const result = resolveFitment(dataset, h1(2008, 1), { saleorProductId: H1_SET });
		expect(result.verdict).not.toBe("NO_FIT");
		expect(result.verdict).toBe("UNKNOWN");
	});

	it("still asks for the month it needs, even on a row it will refuse anyway", () => {
		// The question comes before the refusal: answering it is how we learn whether the
		// row was even relevant.
		expect(resolveFitment(dataset, h1(2008), { saleorProductId: H1_SET }).verdict).toBe("NEEDS_DETAIL");
	});
});

describe("the whole pilot is the manufacturer's word, and says so", () => {
	it("never yields VERIFIED_FIT for any row in it", () => {
		// Every product here is `manufacturer-application` / `not-independently-verified`.
		// Before B0.3 the configurator rendered "Overené pre vaše vozidlo" for every
		// offerable card — which is all of them — so the wrong claim was not an edge case,
		// it was the entire real catalogue.
		const products = (pilot as { applications: { products: { verification: string }[] }[] }).applications
			.flatMap((a) => a.products)
			.map((p) => p.verification);
		expect(products.every((v) => v === "not-independently-verified")).toBe(true);

		for (const [selection, id] of [
			[courier(2025), COURIER_SET],
			[a6(1998), A6_SET],
		] as const) {
			expect(resolveFitment(dataset, selection, { saleorProductId: id }).verdict).not.toBe("VERIFIED_FIT");
		}
	});

	it("names the supplier that stands behind each row", () => {
		const result = resolveFitment(dataset, courier(2025), { saleorProductId: COURIER_SET });
		expect(result.product?.evidence.kind).toBe("manufacturer-application");
		expect(result.product?.evidence.supplier).toBeTruthy();
	});
});
