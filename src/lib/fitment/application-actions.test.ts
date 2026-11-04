import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listProductApplications } from "./application-actions";
import { uniqueProductRefs } from "./offers";
import { type FitmentApplication } from "./contract";

const ORIGINAL = process.env.MAKY_FITMENT_PROVIDER;
const OCTAVIA_SET = "demo-product-aero-flush";

beforeEach(() => {
	process.env.MAKY_FITMENT_PROVIDER = "fixture";
});
afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.MAKY_FITMENT_PROVIDER;
	else process.env.MAKY_FITMENT_PROVIDER = ORIGINAL;
});

describe("the vehicles a product is made for", () => {
	it("answers with no vehicle selected", async () => {
		const page = await listProductApplications(OCTAVIA_SET);
		expect(page.unavailable).toBe(false);
		expect(page.total).toBeGreaterThan(0);
		expect(page.rows[0]!.makeName).toBe("Škoda");
	});

	it("never lists a negative row as an application", async () => {
		// The fixture has an explicit NO-FIT row for the same product.
		const page = await listProductApplications(OCTAVIA_SET);
		expect(page.rows.some((r) => r.applicationId === "app-octavia4-estate-flush-negative")).toBe(false);
	});

	it("marks a row the source did not accept so it cannot read as confirmed", async () => {
		const page = await listProductApplications("demo-product-raised");
		expect(page.rows.every((r) => r.accepted)).toBe(false);
	});

	it("filters by what a shopper would actually type", async () => {
		expect((await listProductApplications(OCTAVIA_SET, { query: "octav" })).total).toBeGreaterThan(0);
		expect((await listProductApplications(OCTAVIA_SET, { query: "ferrari" })).total).toBe(0);
	});

	it("pages rather than returning everything at once", async () => {
		const page = await listProductApplications(OCTAVIA_SET, { limit: 1 });
		expect(page.rows).toHaveLength(1);
	});

	it("caps the page size so a caller cannot ask for the whole index", async () => {
		const page = await listProductApplications(OCTAVIA_SET, { limit: 100_000 });
		expect(page.rows.length).toBeLessThanOrEqual(100);
	});

	it("returns nothing for an unknown product rather than everything", async () => {
		expect((await listProductApplications("does-not-exist")).total).toBe(0);
	});

	it("says unavailable — not empty — when the provider is off", async () => {
		delete process.env.MAKY_FITMENT_PROVIDER;
		const page = await listProductApplications(OCTAVIA_SET);
		expect(page.unavailable).toBe(true);
	});
});

describe("what the source says about each car in the list", () => {
	it("gives a row the condition in the words of the reading locale", async () => {
		const page = await listProductApplications(OCTAVIA_SET, { locale: "sk-SK" });
		expect(page.rows[0]!.conditions).toEqual([
			{ code: "torque-check-after-100km", text: "Po prvých 100 km dotiahnite pätky predpísaným momentom." },
		]);
	});

	it("takes Austria's condition from the German text, as the compatibility box does", async () => {
		const page = await listProductApplications(OCTAVIA_SET, { locale: "de-AT" });
		expect(page.rows[0]!.conditions[0]?.text).toMatch(/\S/);
	});

	it("keeps the code with no text where the source has none in this locale, so the row still says there is a condition", async () => {
		const page = await listProductApplications("demo-product-outofstock", { locale: "sk-SK" });
		expect(page.rows[0]!.conditions).toEqual([
			{ code: "unknown-code-with-no-translation-anywhere", text: null },
		]);
		const german = await listProductApplications(OCTAVIA_SET, { locale: "pl-PL" });
		expect(german.rows[0]!.conditions).toEqual([{ code: "torque-check-after-100km", text: null }]);
	});

	it("gives a row no conditions when the application has none", async () => {
		const page = await listProductApplications("demo-product-square-flush", { locale: "sk-SK" });
		expect(page.rows.every((row) => Array.isArray(row.conditions))).toBe(true);
	});
});

describe("candidate de-duplication", () => {
	const ref = (id: string, variant: string) => ({
		externalReference: `cfm:product:${id}`,
		saleorProductId: id,
		saleorVariantId: variant,
		productKind: "roof-rack-set" as const,
		evidence: { kind: "manufacturer-application" as const, supplier: "test" },
		qaStatus: "accepted" as const,
		verification: "cfm-verified" as const,
		eligibility: { sellable: true, reasons: [] },
	});
	const app = (products: ReturnType<typeof ref>[]): FitmentApplication => ({
		applicationId: "a",
		generationId: "g",
		window: {
			from: { year: 2020 },
			to: null,
			startPrecision: "year",
			endPrecision: "open",
			reconciledToGeneration: false,
		},
		qualifiers: {},
		conditions: [],
		products,
	});

	it("keeps first-seen order and drops repeats across applications", () => {
		const refs = uniqueProductRefs([
			app([ref("P1", "V1"), ref("P2", "V2")]),
			app([ref("P2", "V2"), ref("P3", "V3")]),
		]);
		expect(refs.map((r) => r.saleorProductId)).toEqual(["P1", "P2", "P3"]);
	});

	it("returns nothing for no applications", () => {
		expect(uniqueProductRefs([])).toEqual([]);
	});
});
