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

describe("stepping through the tree — make, model, YEAR", () => {
	it("offers makes first and nothing downstream", async () => {
		const step = await loadSelectorStep({});
		expect(step.makes.map((m) => m.id)).toContain("skoda");
		expect(step.models).toBeNull();
		expect(step.years).toBeNull();
	});

	it("offers only the chosen make's models", async () => {
		const step = await loadSelectorStep({ makeId: "skoda" });
		expect(step.models?.map((m) => m.id).sort()).toEqual(["skoda-kodiaq", "skoda-octavia"]);
	});

	it("refuses a model that belongs to another make", async () => {
		// A stale modelId left over from a previous make must not survive.
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "vw-golf" });
		expect(step.years).toBeNull();
	});

	it("asks for the YEAR straight after the model — never for a generation", async () => {
		// The shopper reads a year off their registration document. They do not know
		// "NX" or "NS7", and asking for one is asking them to guess.
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq" });
		expect(step.years?.[0]).toBe(2024);
		expect(step.years?.[step.years.length - 1]).toBe(2016);
		expect(step.generation).toBeNull();
		expect(step.generationCandidates).toBeNull();
	});

	it("bounds years by PRODUCTION, and an open-ended generation only to next year", async () => {
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-octavia" });
		expect(step.years?.[0]).toBe(new Date().getUTCFullYear() + 1);
		expect(step.years?.[step.years.length - 1]).toBe(2020);
		expect(step.years!.length).toBeLessThan(50);
	});

	it("DERIVES the generation from the year when the year settles it", async () => {
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq", year: 2019 });
		expect(step.generation?.id).toBe("skoda-kodiaq-1");
		expect(step.generationCandidates).toBeNull();
	});

	it("offers no generation for a year the model was not built in", async () => {
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq", year: 1998 });
		expect(step.generation).toBeNull();
		expect(step.generationCandidates).toBeNull();
	});
});

describe("the roof type is confirmed EVERY time", () => {
	it("asks even when the generation has exactly one known roof", async () => {
		// THE REGRESSION. Kodiaq I is raised-rails only, and its application requires
		// raised rails. The old selector dropped every single-valued qualifier as "no
		// need to ask", saved nothing, and handed the resolver `roofType: undefined` —
		// an unanswered qualifier, which is AMBIGUOUS, which offers the shopper nothing.
		// Proven in isolation before this change:
		//   no roofType asked -> AMBIGUOUS (qualifier-not-answered)
		//   roof confirmed    -> VERIFIED_FIT
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq", year: 2019 });
		expect(step.qualifiers?.roofTypes).toEqual(["raised-rails"]);
	});

	it("offers the roofs the CAR can have, not only the ones we stock racks for", async () => {
		// Octavia IV was sold with a naked roof and with flush rails; our applications
		// only ever mention flush rails. Offering just that would leave a naked-roof
		// owner no way to say so, and push them at the answer we wanted to hear.
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-octavia", year: 2022 });
		expect(step.qualifiers?.roofTypes?.sort()).toEqual(["flush-rails", "naked-roof"]);
	});
});

describe("qualifiers the generation itself settles are FILLED IN, not dropped", () => {
	it("resolves a single body type instead of leaving the resolver to guess", async () => {
		// The other half of the same bug: a value we can read off the chosen generation
		// is a fact, so it is answered rather than discarded. Discarding it is what left
		// the resolver with `undefined` and produced AMBIGUOUS.
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq", year: 2019 });
		expect(step.qualifiers?.bodyTypes).toBeNull();
		expect(step.qualifiers?.resolved.bodyType).toBe("suv");
		expect(step.qualifiers?.resolved.doors).toBe(5);
	});

	it("still ASKS when the generation genuinely varies", async () => {
		const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-octavia", year: 2022 });
		expect(step.qualifiers?.bodyTypes).toEqual(["hatchback", "estate"]);
		expect(step.qualifiers?.resolved.bodyType).toBeUndefined();
	});
});

describe("the month is asked only when it decides something", () => {
	it("does not ask on a year-precise window, however boundary the year is", async () => {
		// Kodiaq I's application runs 2016-2024 with both precisions "year": the source
		// gave a year and admitted it does not know the month, so the whole boundary year
		// is inside the window and the shopper's month cannot move the answer. 38 of the
		// current candidate export's applications are like this.
		for (const year of [2016, 2020, 2024]) {
			const step = await loadSelectorStep({ makeId: "skoda", modelId: "skoda-kodiaq", year });
			expect(step.monthDecides).toBe(false);
		}
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
