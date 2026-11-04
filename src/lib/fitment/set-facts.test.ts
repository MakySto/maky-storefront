import { describe, expect, it } from "vitest";

import { AUDI_OFFER, n15060Dataset } from "./fixtures/n15060";
import { documentedSetContents } from "./set-contents";
import { agreedFacets, agreedIncludes, productSetFacts, sellableRefsOf } from "./set-facts";

// A test owns its clock: the fixture's own date plus a day, never the real one.
const at = (dataset: ReturnType<typeof n15060Dataset>) => Date.parse(dataset.generatedAt) + 86_400_000;

type Row = {
	includes?: string[];
	facets?: Record<string, string | number | boolean>;
	qaStatus?: "accepted" | "hold";
	sellable?: boolean;
	negative?: boolean;
	variantId?: string;
};

/** The Audi offer documented through one copy of its application per row. */
const withRows = (...rows: Row[]) => {
	const dataset = n15060Dataset();
	const [application] = dataset.applications.filter((a) =>
		a.products.some((p) => p.saleorProductId === AUDI_OFFER.productId),
	);
	const ref = application!.products.find((p) => p.saleorProductId === AUDI_OFFER.productId)!;
	const copies = rows.map((row, index) => ({
		...application!,
		applicationId: `${application!.applicationId}-${index}`,
		negative: row.negative ?? false,
		products: [
			{
				...ref,
				saleorVariantId: row.variantId ?? ref.saleorVariantId,
				qaStatus: row.qaStatus ?? ("accepted" as const),
				eligibility: { sellable: row.sellable ?? true, reasons: [] },
				completeSet: row.includes ? { includes: row.includes } : undefined,
				facets: row.facets,
			},
		],
	}));
	dataset.applications = [...dataset.applications.filter((a) => a !== application), ...copies];
	return dataset;
};

const factsOf = (dataset: ReturnType<typeof n15060Dataset>) =>
	productSetFacts(dataset).get(AUDI_OFFER.productId);

describe("productSetFacts", () => {
	it("reads the facets and the contents of a set the source stands behind", () => {
		const dataset = withRows({
			includes: ["bars", "feet", "fitting-kit"],
			facets: { maxLoadKg: 90, barMaterial: "aluminium" },
		});
		expect(factsOf(dataset)).toEqual({
			facets: { maxLoadKg: 90, barMaterial: "aluminium" },
			includes: ["bars", "feet", "fitting-kit"],
		});
	});

	it("is not overwritten by a row the source holds back, even when it comes first", () => {
		const dataset = withRows(
			{ qaStatus: "hold", sellable: false, includes: ["bars"], facets: { maxLoadKg: 20 } },
			{ includes: ["bars", "feet", "fitting-kit"], facets: { maxLoadKg: 90 } },
		);
		expect(factsOf(dataset)).toEqual({
			facets: { maxLoadKg: 90 },
			includes: ["bars", "feet", "fitting-kit"],
		});
	});

	it("says nothing for a set that is accepted but not sellable, or sellable but not accepted", () => {
		expect(
			factsOf(withRows({ sellable: false, includes: ["bars"], facets: { maxLoadKg: 90 } })),
		).toBeUndefined();
		expect(
			factsOf(withRows({ qaStatus: "hold", includes: ["bars"], facets: { maxLoadKg: 90 } })),
		).toBeUndefined();
	});

	it("ignores a negative row — it says the set does not fit, not what is in it", () => {
		const dataset = withRows({ negative: true, includes: ["bars"], facets: { maxLoadKg: 20 } });
		expect(factsOf(dataset)).toBeUndefined();
	});

	it("leaves a disputed fact out and keeps the ones the rows agree on", () => {
		const dataset = withRows(
			{ facets: { maxLoadKg: 90, barMaterial: "aluminium", barColour: "black" } },
			{ facets: { maxLoadKg: 75, barMaterial: "aluminium" } },
		);
		// The load is a safety number: neither 90 nor 75 is chosen. The material and the colour stand.
		expect(factsOf(dataset)?.facets).toEqual({ barMaterial: "aluminium", barColour: "black" });
	});

	it("says no contents where the rows document different boxes, and one where they say the same twice", () => {
		expect(
			factsOf(withRows({ includes: ["bars", "fitting-kit"] }, { includes: ["bars"] }))?.includes,
		).toBeNull();
		expect(
			factsOf(withRows({ includes: ["bars", "fitting-kit"] }, { includes: ["fitting-kit", "bars"] }))
				?.includes,
		).toEqual(["bars", "fitting-kit"]);
	});

	it("takes a row without a statement for no statement, not for an empty box", () => {
		const dataset = withRows({ facets: { maxLoadKg: 90 } }, { includes: ["bars", "feet", "fitting-kit"] });
		expect(factsOf(dataset)?.includes).toEqual(["bars", "feet", "fitting-kit"]);
		expect(factsOf(withRows({ facets: { maxLoadKg: 90 } }))?.includes).toBeNull();
	});

	it("tells what the card reads from what the product page reads — the same rows, the same rule", () => {
		for (const rows of [
			[{ includes: ["bars", "feet", "fitting-kit"] }],
			[{ includes: ["bars", "fitting-kit"] }, { includes: ["bars"] }],
			[
				{ qaStatus: "hold" as const, sellable: false, includes: ["bars"] },
				{ includes: ["bars", "fitting-kit"] },
			],
			[{ negative: true, includes: ["bars"] }],
			[{ facets: { maxLoadKg: 90 } }],
		] satisfies Row[][]) {
			const dataset = withRows(...rows);
			expect(factsOf(dataset)?.includes ?? null).toEqual(
				documentedSetContents(dataset, AUDI_OFFER.productId, undefined, at(dataset)),
			);
		}
	});
});

describe("the agreed statements", () => {
	it("narrows to one variant when asked", () => {
		const dataset = withRows(
			{ includes: ["bars"] },
			{ includes: ["bars", "fitting-kit"], variantId: "other" },
		);
		expect(sellableRefsOf(dataset, AUDI_OFFER.productId)).toHaveLength(2);
		expect(sellableRefsOf(dataset, AUDI_OFFER.productId, "other")).toHaveLength(1);
		expect(agreedIncludes(sellableRefsOf(dataset, AUDI_OFFER.productId, "other"))).toEqual([
			"bars",
			"fitting-kit",
		]);
	});

	it("agrees on nothing from no rows", () => {
		expect(agreedIncludes([])).toBeNull();
		expect(agreedFacets([])).toBeNull();
	});
});
