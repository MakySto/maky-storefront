import { describe, expect, it } from "vitest";

import fixture from "./fixtures/dataset-v1.json";
import { windowOf } from "./fixtures/build";
import { validateFitmentDataset, type ValidateOptions } from "./validate";
import { datasetHashFromText } from "./dataset-hash";

/**
 * The provider is external and versioned separately, so its payload is untrusted input.
 * These tests pin the two rejections that are not shape checks — a schema major bump and
 * a Saleor instance mismatch — because both fail SILENTLY if they are not caught here:
 * the ids would parse, resolve, and point at the wrong products.
 */

function valid(): Record<string, unknown> {
	return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

/**
 * The committed demo, validated the way `provider.ts` actually loads it.
 *
 * It carries the explicit non-hash sentinel instead of a SHA-256, which is permitted for
 * a dataset that arrives as a committed module rather than as a response body. These
 * tests are about everything else the validator checks, so they take that path; the hash
 * gate itself is exercised below over datasets that arrive the way a real one does.
 */
function check(dataset: unknown, options: ValidateOptions = {}) {
	return validateFitmentDataset(dataset, { allowUnhashedFixture: true, ...options });
}

describe("the committed fixture", () => {
	it("is a valid dataset", () => {
		const result = check(valid());
		expect(result.ok).toBe(true);
	});

	it("declares itself as fixture data, not a CFM export", () => {
		const result = check(valid());
		expect(result.ok && result.dataset.source.system).toBe("fixture");
		expect(result.ok && result.dataset.datasetVersion.startsWith("demo-")).toBe(true);
	});

	it("names an instance that is deliberately not a real one", () => {
		// A demo dataset must not claim to belong to the live Saleor instance — its ids
		// are synthetic and must never be looked up for real.
		const result = check(valid());
		expect(result.ok && result.dataset.saleorInstance).not.toBe("api.maky.store");
	});

	it("is NOT rejected by the instance check, which only guards real datasets", () => {
		// Regression: applying the instance guard to demo data rejected the whole
		// dataset, so the demo silently disabled itself — with a green build and a green
		// test suite, because nothing passed the expected instance in.
		expect(check(valid(), { expectedSaleorInstance: "api.maky.store" }).ok).toBe(true);
	});

	it("carries its own catalogue, so it never needs a live product lookup", () => {
		const result = check(valid());
		expect(result.ok && Array.isArray(result.dataset.demoCatalogue)).toBe(true);
	});

	it("classifies every product it references", () => {
		const result = check(valid());
		const kinds = result.ok
			? result.dataset.applications.flatMap((a) => a.products.map((p) => p.productKind))
			: [];
		expect(kinds.length).toBeGreaterThan(0);
		expect(kinds.every(Boolean)).toBe(true);
	});
});

describe("rejections that would otherwise be silent", () => {
	it("refuses a REAL dataset built for a different Saleor instance", () => {
		// Real, i.e. no demoCatalogue: its ids WILL be looked up against Saleor, so an id
		// minted on staging would resolve here and point at a different product entirely.
		const real = valid();
		delete real.demoCatalogue;
		real.saleorInstance = "staging.example.test";
		const result = check(real, { expectedSaleorInstance: "api.maky.store" });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("instance-bound");
	});

	it("refuses an unclassified product — guessing is how a roof box became a roof rack", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.applications[0].products[0].productKind;
		const result = check(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("productKind is required");
	});

	it("refuses an unknown product kind rather than passing it through", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].products[0].productKind = "hovercraft";
		expect(check(d).ok).toBe(false);
	});

	it("refuses a coverage claim with no scope", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.coverage.scope;
		const result = check(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("needs a scope");
	});

	it("refuses an empty completeSet.includes — unknown contents are not printed", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].products[0].completeSet = { includes: [] };
		expect(check(d).ok).toBe(false);
	});

	it("refuses a different major", () => {
		const result = check({ ...valid(), schemaVersion: "2.0.0" });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("not supported");
	});

	it("refuses a newer MINOR of the same major — this is the whole point of 3.0.0", () => {
		// The gate used to accept any `2.x`. A dataset carrying month boundaries would
		// then have been read by a build that ignores them: every unknown field dropped,
		// every decision still made from years, and nothing reporting a problem. An
		// unreadable dataset must be refused, not partially understood.
		const result = check({ ...valid(), schemaVersion: "3.1.0" });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("not supported");
	});
});

describe("the join that has to exist", () => {
	it("refuses a product reference with no saleorProductId", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.applications[0].products[0].saleorProductId;
		const result = check(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("no bulk externalReference filter exists");
	});

	it("refuses a product reference with no saleorVariantId", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		delete d.applications[0].products[0].saleorVariantId;
		const result = check(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("never inferred");
	});
});

describe("referential integrity", () => {
	it("refuses an application pointing at a generation that does not exist", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].generationId = "does-not-exist";
		expect(check(d).ok).toBe(false);
	});

	it("refuses a model whose make does not exist", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.models[0].makeId = "nope";
		expect(check(d).ok).toBe(false);
	});

	it("refuses duplicate application ids", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications.push({ ...d.applications[0] });
		expect(check(d).ok).toBe(false);
	});

	it("refuses a reversed window", () => {
		const d = valid();
		(d.applications as { window: unknown }[])[0]!.window = windowOf([2030], [2020]);
		expect(check(d).ok).toBe(false);
	});
});

describe("qualifiers", () => {
	it("refuses an empty qualifier array, which reads as 'no value fits'", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].qualifiers.roofTypes = [];
		const result = check(d);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("omit the key instead");
	});

	it("refuses an unknown roof type rather than passing it through", () => {
		const d = valid();
		// @ts-expect-error deliberately malformed
		d.applications[0].qualifiers.roofTypes = ["magnetic"];
		expect(check(d).ok).toBe(false);
	});
});

describe("warnings — accepted, but reported", () => {
	it("warns when an application window precedes the generation's production start", () => {
		const d = valid();
		// The window's own year, not the `yearFrom` of schema 2. Pointing this at the
		// removed field is exactly why the check was dead: `undefined as number` is NaN,
		// and every comparison against NaN is false, so the warning could never fire.
		(d.applications as { window: { from: { year: number } } }[])[0]!.window.from.year = 1990;
		const result = check(d);
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
		expect(() => check(value)).not.toThrow();
		expect(check(value).ok).toBe(false);
	});
});

describe("the datasetHash gate — recomputed, not merely present", () => {
	/** A dataset shaped like a delivery: real hash, no demo catalogue. */
	function delivered(overrides: Record<string, unknown> = {}): {
		text: string;
		value: Record<string, unknown>;
	} {
		const d = valid();
		delete d.demoCatalogue;
		d.saleorInstance = "api.maky.store";
		d.source = { system: "cfm" };
		Object.assign(d, overrides);
		delete d.datasetHash;
		// Serialise first, then hash that exact text, then put the hash back — the same
		// order CFM's exporter uses, and the only order that yields a stable value.
		const withoutHash = JSON.stringify(d);
		const hash = datasetHashFromText(withoutHash);
		d.datasetHash = hash;
		return { text: JSON.stringify(d), value: d };
	}

	it("accepts a delivered dataset whose hash is correct", () => {
		const { text, value } = delivered();
		const result = validateFitmentDataset(value, { rawText: text });
		expect(result.ok).toBe(true);
	});

	it("REJECTS an invented hash — the whole dataset, not a warning", () => {
		// This is the check that did not exist: `datasetHash` was only tested for being a
		// non-empty string, so a payload could claim any hash at all and pass.
		const { value } = delivered();
		value.datasetHash = "0".repeat(64);
		const result = validateFitmentDataset(value, { rawText: JSON.stringify(value) });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("datasetHash mismatch");
	});

	it("REJECTS a hash that is correct for a DIFFERENT document", () => {
		const a = delivered();
		const b = delivered({ datasetVersion: "some-other-version" });
		b.value.datasetHash = (a.value as { datasetHash: string }).datasetHash;
		const result = validateFitmentDataset(b.value, { rawText: JSON.stringify(b.value) });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("datasetHash mismatch");
	});

	it("REJECTS something that is not a SHA-256 at all", () => {
		const { value } = delivered();
		value.datasetHash = "not-a-hash";
		const result = validateFitmentDataset(value, { rawText: JSON.stringify(value) });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("64 lower-case hex");
	});

	it("REJECTS the committed-fixture sentinel when it arrives as a delivery", () => {
		// The escape hatch is keyed on HOW the dataset got here, never on what it calls
		// itself — otherwise the payload could open its own escape hatch.
		const { value } = delivered();
		value.datasetHash = "demo-no-hash-this-is-not-a-cfm-export";
		const result = validateFitmentDataset(value, { rawText: JSON.stringify(value) });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("only for the committed fixture");
	});

	it("still verifies a real hash even on the committed-fixture path", () => {
		// `allowUnhashedFixture` permits the sentinel. It does not permit a WRONG hash.
		const { value } = delivered();
		value.datasetHash = "1".repeat(64);
		const result = validateFitmentDataset(value, {
			rawText: JSON.stringify(value),
			allowUnhashedFixture: true,
		});
		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.join(" ")).toContain("datasetHash mismatch");
	});
});
