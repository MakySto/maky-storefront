import { describe, expect, it } from "vitest";

import { resolveQualifier, resolveRoofAnswer, roofOptionsFor } from "./selection";
import { anApplication } from "@/lib/fitment/fixtures/build";

/**
 * The regression that mattered most in this branch, and the one an isolated proof missed.
 *
 * The selector was known to drop a single-valued qualifier as "no need to ask". Measured
 * against the resolver DIRECTLY that reads as AMBIGUOUS — the configurator offers nothing.
 * But the running app does not go selector → resolver; it goes selector → chooseVehicle →
 * cookie → resolver, and `chooseVehicle` filled the missing roof in. So the real behaviour
 * was not silence, it was a verified-fit claim resting on a roof type nobody confirmed.
 */
describe("the roof type is never invented", () => {
	it("stores nothing when the shopper did not answer", () => {
		// Measured before the fix: this returned "raised-rails".
		expect(resolveRoofAnswer(["raised-rails"], undefined)).toBeUndefined();
	});

	it("stores nothing for 'a different type' and for 'I can't tell' alike", () => {
		// Both arrive as `undefined`; neither may become the one roof we hold data for.
		expect(resolveRoofAnswer(["raised-rails"], undefined)).toBeUndefined();
		expect(resolveRoofAnswer(["naked-roof", "flush-rails"], undefined)).toBeUndefined();
	});

	it("stores an answer the shopper actually gave", () => {
		expect(resolveRoofAnswer(["raised-rails"], "raised-rails")).toBe("raised-rails");
	});

	it("refuses a roof that was never on offer", () => {
		expect(resolveRoofAnswer(["raised-rails"], "t-track")).toBe("invalid");
	});

	it("does not refuse the save — an unconfirmed roof is a savable car", () => {
		// Refusing would be the opposite error: the car is real and belongs in the garage.
		// What we may not do is claim to know its roof.
		expect(resolveRoofAnswer(["raised-rails"], undefined)).not.toBe("invalid");
	});
});

describe("qualifiers the generation itself settles are still filled in", () => {
	it("fills a single body type without asking", () => {
		// The distinction: this IS a property of the chosen generation.
		expect(resolveQualifier(["suv"], undefined)).toBe("suv");
	});

	it("requires an answer when the generation genuinely varies", () => {
		expect(resolveQualifier(["hatchback", "estate"], undefined)).toBe("invalid");
	});

	it("refuses an answer outside the generation's own values", () => {
		expect(resolveQualifier(["suv"], "van")).toBe("invalid");
		expect(resolveQualifier(["hatchback", "estate"], "van")).toBe("invalid");
	});

	it("stores nothing when the generation constrains nothing", () => {
		expect(resolveQualifier(undefined, undefined)).toBeUndefined();
		expect(resolveQualifier([], "suv")).toBeUndefined();
	});
});

describe("the garage validates against the list the selector offered", () => {
	it("accepts a roof only an application knows about", () => {
		// The selector unions generation and application roofs. Validating against the
		// generation alone would refuse a roof the shopper was shown and legitimately
		// picked.
		const dataset = {
			applications: [anApplication({ generationId: "g", qualifiers: { roofTypes: ["fixpoint"] } })],
		};
		const generation = { id: "g", qualifiers: { roofTypes: ["naked-roof" as const] } };
		const options = roofOptionsFor(dataset, generation);
		expect(options.sort()).toEqual(["fixpoint", "naked-roof"]);
		expect(resolveRoofAnswer(options, "fixpoint")).toBe("fixpoint");
	});
});
