import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSelectorStep } from "./selector-actions";
import { loadFitmentDataset, resolveProviderMode } from "./provider";

/**
 * Exercised against the COMMITTED FIXTURE, deliberately — this is the same data path the
 * running app uses in fixture mode, so a fixture that stops satisfying the contract fails
 * here rather than in a browser.
 */

const ORIGINAL = process.env.MAKY_FITMENT_PROVIDER;

beforeEach(() => {
	process.env.MAKY_FITMENT_PROVIDER = "fixture";
});

afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.MAKY_FITMENT_PROVIDER;
	else process.env.MAKY_FITMENT_PROVIDER = ORIGINAL;
});

describe("provider mode", () => {
	it("is disabled by default, so nothing can claim a fit without configuration", () => {
		delete process.env.MAKY_FITMENT_PROVIDER;
		expect(resolveProviderMode()).toBe("disabled");
	});

	it("reports an unknown value as disabled rather than guessing", () => {
		process.env.MAKY_FITMENT_PROVIDER = "yes-please";
		expect(resolveProviderMode()).toBe("disabled");
	});

	it("returns no dataset when disabled", async () => {
		delete process.env.MAKY_FITMENT_PROVIDER;
		const { dataset, status } = await loadFitmentDataset();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("provider-disabled");
	});

	it("flags the fixture as fixture data", async () => {
		const { status } = await loadFitmentDataset();
		expect(status.isFixture).toBe(true);
	});
});

describe("stepping through the tree", () => {
	it("offers makes first and nothing downstream", async () => {
		const step = await loadSelectorStep({});
		expect(step.makes.map((m) => m.id)).toContain("skoda");
		expect(step.models).toBeNull();
		expect(step.generations).toBeNull();
	});

	it("offers only the chosen make's models", async () => {
		const step = await loadSelectorStep({ makeId: "skoda" });
		expect(step.models?.map((m) => m.id).sort()).toEqual(["skoda-kodiaq", "skoda-octavia"]);
	});

	it("refuses a model that belongs to another make", async () => {
		// A stale modelId left over from a previous make must not survive.
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "vw-golf" });
		expect(step.generations).toBeNull();
	});

	it("offers years bounded by the generation's production window", async () => {
		const step = await loadSelectorStep({
			makeId: "skoda",
			modelId: "skoda-kodiaq",
			generationId: "skoda-kodiaq-1",
		});
		expect(step.years?.[step.years.length - 1]).toBe(2016);
		expect(step.years?.[0]).toBe(2024);
	});

	it("extends an open-ended generation only to next year, not forever", async () => {
		const step = await loadSelectorStep({
			makeId: "skoda",
			modelId: "skoda-octavia",
			generationId: "skoda-octavia-4",
		});
		expect(step.years?.[0]).toBe(new Date().getUTCFullYear() + 1);
		expect(step.years!.length).toBeLessThan(50);
	});
});

describe("which qualifiers are asked", () => {
	it("asks for the roof type when the generation genuinely varies", async () => {
		const step = await loadSelectorStep({
			makeId: "skoda",
			modelId: "skoda-octavia",
			generationId: "skoda-octavia-4",
		});
		expect(step.qualifiers?.roofTypes).toEqual(["naked-roof", "flush-rails"]);
	});

	it("does NOT ask when there is only one possible answer", async () => {
		// Kodiaq I is raised-rails only. A question with one answer trains people to
		// click through without reading.
		const step = await loadSelectorStep({
			makeId: "skoda",
			modelId: "skoda-kodiaq",
			generationId: "skoda-kodiaq-1",
		});
		expect(step.qualifiers?.roofTypes).toBeNull();
		expect(step.qualifiers?.bodyTypes).toBeNull();
		expect(step.qualifiers?.doors).toBeNull();
	});
});

describe("when there is no dataset", () => {
	it("says unavailable rather than offering an empty list of makes", async () => {
		delete process.env.MAKY_FITMENT_PROVIDER;
		const step = await loadSelectorStep({});
		expect(step.unavailable).toBe(true);
		expect(step.makes).toEqual([]);
	});
});
