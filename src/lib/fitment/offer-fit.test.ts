import { describe, expect, it } from "vitest";

import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import type { FitmentApplication, FitmentDataset } from "./contract";
import {
	describeOfferFit,
	groupRoofOf,
	offerFitOf,
	offerFitsByProduct,
	productFitIndex,
	type OfferFit,
} from "./offer-fit";

/**
 * What a set is FOR — roof and years — read off its application.
 *
 * The facts come from `window` and `qualifiers`, never from the product's name and never from the
 * generation's production years: a car built 2015–2021 may have a set for 2017–2021 only.
 */

const ref = (id: string) => ({
	externalReference: `cfm:product:${id}`,
	saleorProductId: id,
	saleorVariantId: `${id}-v`,
	productKind: "roof-rack-set" as const,
	evidence: { kind: "manufacturer-application" as const, supplier: "THULE" },
	qaStatus: "accepted" as const,
	verification: "not-independently-verified" as const,
	eligibility: { sellable: true, reasons: [] },
});

function application(
	over: Omit<Partial<FitmentApplication>, "products"> & { products: string[] },
): FitmentApplication {
	const { products, ...rest } = over;
	return {
		applicationId: `app-${products.join("-")}`,
		generationId: "gen-1",
		window: {
			from: { year: 2018 },
			to: { year: 2021 },
			startPrecision: "year",
			endPrecision: "year",
			reconciledToGeneration: false,
		},
		qualifiers: { roofTypes: ["flush-rails"], bodyTypes: ["suv"] },
		conditions: [],
		products: products.map(ref),
		...rest,
	};
}

/** A translator over the Slovak words the cards print. */
const t = (key: string, values?: Record<string, string | number>) => {
	const messages: Record<string, string> = {
		roofRaisedRails: "Pozdĺžniky nad strechou",
		roofFlushRails: "Integrované pozdĺžniky",
		roofNakedRoof: "Holá strecha",
		yearRange: "{from} – {to}",
		yearFromOnly: "od {from}",
	};
	return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name]));
};

describe("offerFitOf", () => {
	it("reads the years from the application's window, not from anywhere else", () => {
		expect(offerFitOf(application({ products: ["p1"] }))).toEqual({
			yearFrom: 2018,
			yearTo: 2021,
			roofTypes: ["flush-rails"],
			bodyTypes: ["suv"],
		});
	});

	it("keeps an open window open", () => {
		const open = application({
			products: ["p1"],
			window: {
				from: { year: 2024 },
				to: null,
				startPrecision: "year",
				endPrecision: "open",
				reconciledToGeneration: false,
			},
		});
		expect(offerFitOf(open).yearTo).toBeNull();
	});

	it("says nothing about a roof the application does not name", () => {
		expect(offerFitOf(application({ products: ["p1"], qualifiers: {} })).roofTypes).toBeNull();
		// An empty array is a data error upstream and must not read as "no roof fits".
		expect(offerFitOf(application({ products: ["p1"], qualifiers: { roofTypes: [] } })).roofTypes).toBeNull();
	});
});

describe("offerFitsByProduct", () => {
	it("maps every product to its application's facts", () => {
		const fits = offerFitsByProduct([
			application({ products: ["p1", "p2"] }),
			application({ products: ["p3"], qualifiers: { roofTypes: ["naked-roof"] } }),
		]);
		expect(fits.get("p1")).toEqual(fits.get("p2"));
		expect(fits.get("p3")?.[0]?.roofTypes).toEqual(["naked-roof"]);
		expect(fits.has("p4")).toBe(false);
	});

	it("ignores a negative row — it says the set does NOT fit", () => {
		const fits = offerFitsByProduct([application({ products: ["p1"], negative: true })]);
		expect(fits.has("p1")).toBe(false);
	});

	it("collapses identical facts reached through two rows, and keeps different ones apart", () => {
		const same = offerFitsByProduct([application({ products: ["p1"] }), application({ products: ["p1"] })]);
		expect(same.get("p1")).toHaveLength(1);

		const different = offerFitsByProduct([
			application({ products: ["p1"] }),
			application({ products: ["p1"], qualifiers: { roofTypes: ["naked-roof"] } }),
		]);
		expect(different.get("p1")).toHaveLength(2);
	});
});

describe("productFitIndex", () => {
	const dataset = { applications: [application({ products: ["p1"] })] } as unknown as FitmentDataset;

	it("is built once per dataset and returns the same index for it", () => {
		expect(productFitIndex(dataset)).toBe(productFitIndex(dataset));
		expect(productFitIndex(dataset).get("p1")?.[0]?.yearFrom).toBe(2018);
	});

	it("is tied to the dataset OBJECT, so a refreshed dataset never reads an old index", () => {
		const refreshed = {
			applications: [application({ products: ["p1"], qualifiers: { roofTypes: ["naked-roof"] } })],
		} as unknown as FitmentDataset;
		expect(productFitIndex(refreshed)).not.toBe(productFitIndex(dataset));
		expect(productFitIndex(refreshed).get("p1")?.[0]?.roofTypes).toEqual(["naked-roof"]);
		// The old one is untouched.
		expect(productFitIndex(dataset).get("p1")?.[0]?.roofTypes).toEqual(["flush-rails"]);
	});
});

describe("describeOfferFit", () => {
	const fit = (over: Partial<OfferFit> = {}): OfferFit => ({
		yearFrom: 2018,
		yearTo: 2021,
		roofTypes: ["flush-rails"],
		bodyTypes: null,
		...over,
	});

	it("words the roof and the years", () => {
		expect(describeOfferFit([fit()], t, ROOF_LABEL_KEY)).toEqual({
			roof: "Integrované pozdĺžniky",
			years: "2018 – 2021",
		});
	});

	it("says 'from' for an open window and one year for a single-year window", () => {
		expect(describeOfferFit([fit({ yearTo: null, yearFrom: 2024 })], t, ROOF_LABEL_KEY)?.years).toBe(
			"od 2024",
		);
		expect(describeOfferFit([fit({ yearFrom: 2020, yearTo: 2020 })], t, ROOF_LABEL_KEY)?.years).toBe("2020");
	});

	it("names no roof when the application names none — it never fills one in", () => {
		expect(describeOfferFit([fit({ roofTypes: null })], t, ROOF_LABEL_KEY)?.roof).toBeNull();
	});

	it("lists several roofs an application accepts", () => {
		expect(
			describeOfferFit([fit({ roofTypes: ["raised-rails", "flush-rails"] })], t, ROOF_LABEL_KEY)?.roof,
		).toBe("Pozdĺžniky nad strechou, Integrované pozdĺžniky");
	});

	it("stays silent for a set with no application, or with more than one", () => {
		// Which of two windows a card means is not a question the card can answer.
		expect(describeOfferFit(undefined, t, ROOF_LABEL_KEY)).toBeNull();
		expect(describeOfferFit([], t, ROOF_LABEL_KEY)).toBeNull();
		expect(describeOfferFit([fit(), fit({ yearFrom: 2022, yearTo: null })], t, ROOF_LABEL_KEY)).toBeNull();
	});
});

describe("groupRoofOf", () => {
	it("groups by the roof the set needs, in a fixed order", () => {
		expect(groupRoofOf([{ yearFrom: 1, yearTo: null, roofTypes: ["flush-rails"], bodyTypes: null }])).toBe(
			"flush-rails",
		);
		// Several roofs: the commoner one leads, so a set never lands in a group by accident of order.
		expect(
			groupRoofOf([
				{ yearFrom: 1, yearTo: null, roofTypes: ["naked-roof", "raised-rails"], bodyTypes: null },
			]),
		).toBe("raised-rails");
	});

	it("has no group for a set that names no roof", () => {
		expect(groupRoofOf(undefined)).toBeNull();
		expect(groupRoofOf([{ yearFrom: 1, yearTo: null, roofTypes: null, bodyTypes: null }])).toBeNull();
	});
});
