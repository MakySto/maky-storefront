import { describe, expect, it } from "vitest";

import fixture from "./fixtures/dataset-v1.json";
import { validateFitmentDataset } from "./validate";

/**
 * The provider is external and versioned separately, so its payload is untrusted input.
 * These tests pin the two rejections that are not shape checks — a schema major bump and
 * a Saleor instance mismatch — because both fail SILENTLY if they are not caught here:
 * the ids would parse, resolve, and point at the wrong products.
 */

function valid(): Record<string, unknown> {
	return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

describe("the committed fixture", () => {
	it("is a valid dataset", () => {
		const result = validateFitmentDataset(valid());
		expect(result.ok).toBe(true);
	});

	it("declares itself as fixture data, not a CFM export", () => {
		const result = validateFitmentDataset(valid());
		expect(result.ok && result.dataset.source.system).toBe("fixture");
		expect(result.ok && result.dataset.datasetVersion.startsWith("fixture-")).toBe(true);
	});

	it("matches the Saleor instance it names", () => {
		expect(validateFitmentDataset(valid(), { expectedSaleorInstance: "api.maky.store" }).ok).toBe(true);
	});
});

describe("rejections that would otherwise be silent", () => {
	it("refuses a dataset built for a different Saleor instance", () => {
		const result = validateFitmentDataset(valid(), { expectedSaleorInstance: "staging.example.test" });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("instance-bound");
	});

	it("refuses an unsupported schema major", () => {
		const result = validateFitmentDataset({ ...valid(), schemaVersion: "2.0.0" });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("not supported");
	});

	it("accepts a newer minor of the same major", () => {
		expect(validateFitmentDataset({ ...valid(), schemaVersion: "1.4.0" }).ok).toBe(true);
	});
});

describe("the join that has to exist", () => {
	it("refuses a product reference with no saleorProductId", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.applications[0].products[0].saleorProductId;
		const result = validateFitmentDataset(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("no bulk externalReference filter exists");
	});

	it("refuses a product reference with no saleorVariantId", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.applications[0].products[0].saleorVariantId;
		const result = validateFitmentDataset(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("never inferred");
	});
});

describe("referential integrity", () => {
	it("refuses an application pointing at a generation that does not exist", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].generationId = "does-not-exist";
		expect(validateFitmentDataset(d).ok).toBe(false);
	});

	it("refuses a model whose make does not exist", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.models[0].makeId = "nope";
		expect(validateFitmentDataset(d).ok).toBe(false);
	});

	it("refuses duplicate application ids", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications.push({ ...d.applications[0] });
		expect(validateFitmentDataset(d).ok).toBe(false);
	});

	it("refuses a reversed year window", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].yearFrom = 2030;
		// @ts-expect-error deliberately malformed
		d.applications[0].yearTo = 2020;
		expect(validateFitmentDataset(d).ok).toBe(false);
	});
});

describe("qualifiers", () => {
	it("refuses an empty qualifier array, which reads as 'no value fits'", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].qualifiers.roofTypes = [];
		const result = validateFitmentDataset(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("omit the key instead");
	});

	it("refuses an unknown roof type rather than passing it through", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].qualifiers.roofTypes = ["magnetic"];
		expect(validateFitmentDataset(d).ok).toBe(false);
	});
});

describe("warnings — accepted, but reported", () => {
	it("warns when an application window precedes the generation's production start", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].yearFrom = 1990;
		const result = validateFitmentDataset(d);
		expect(result.ok).toBe(true);
		expect(result.ok && result.warnings.join(" ")).toContain("precedes generation production start");
	});
});

describe("junk input", () => {
	it.each([
		["null", null],
		["a string", "dataset"],
		["an array", []],
		["an empty object", {}],
	])("refuses %s without throwing", (_name, value) => {
		expect(() => validateFitmentDataset(value)).not.toThrow();
		expect(validateFitmentDataset(value).ok).toBe(false);
	});
});
