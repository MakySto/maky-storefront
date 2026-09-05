import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listProductApplications } from "./application-actions";
import { uniqueProductRefs } from "./offers";
import { type FitmentApplication } from "./contract";

const ORIGINAL = process.env.MAKY_FITMENT_PROVIDER;
const OCTAVIA_SET = "UHJvZHVjdDo0MzE=";

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
		expect(page.rows.some((r) => r.applicationId === "app-octavia4-hatch-naked-negative")).toBe(false);
	});

	it("marks an unverified row so it cannot read as confirmed", async () => {
		const page = await listProductApplications("UHJvZHVjdDoxMDQ=");
		expect(page.rows.every((r) => r.verified)).toBe(false);
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

describe("candidate de-duplication", () => {
	const ref = (id: string, variant: string) => ({
		externalReference: `cfm:product:${id}`,
		saleorProductId: id,
		saleorVariantId: variant,
	});
	const app = (products: ReturnType<typeof ref>[]): FitmentApplication => ({
		applicationId: "a",
		generationId: "g",
		yearFrom: 2020,
		yearTo: null,
		qualifiers: {},
		conditions: [],
		verificationStatus: "verified",
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
