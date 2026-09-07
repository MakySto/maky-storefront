import { describe, expect, it } from "vitest";

import { isUnconditional, pickConditionText, renderConditions } from "./conditions";
import { type FitmentCondition } from "./contract";

/**
 * The bug these tests exist to prevent: v1 rendered conditions only from a hardcoded
 * code→i18n map and ignored `condition.text` entirely, so a source-authored mounting
 * restriction vanished while the green "fits" badge stayed. A restriction that
 * disappears while the reassurance remains is the worst possible pairing.
 */

const KNOWN = (code: string) => (code === "known-code" ? "Známa podmienka" : null);

function condition(code: string, text?: Record<string, string>): FitmentCondition {
	return text ? { code, text } : { code };
}

describe("where the words come from", () => {
	it("prefers source text for the exact locale", () => {
		const out = renderConditions([condition("known-code", { "sk-SK": "Zo zdroja" })], "sk-SK", KNOWN);
		expect(out.resolved[0]).toMatchObject({ text: "Zo zdroja", source: "dataset" });
	});

	it("falls back to an approved translation of a known code", () => {
		const out = renderConditions([condition("known-code")], "sk-SK", KNOWN);
		expect(out.resolved[0]).toMatchObject({ text: "Známa podmienka", source: "i18n" });
	});

	it("counts a condition it cannot state, instead of dropping it silently", () => {
		const out = renderConditions([condition("mystery-code")], "sk-SK", KNOWN);
		expect(out.resolved).toEqual([]);
		expect(out.unresolvedCount).toBe(1);
	});

	it("never echoes a raw code back to a customer", () => {
		const out = renderConditions([condition("mystery-code")], "sk-SK", KNOWN);
		expect(JSON.stringify(out.resolved)).not.toContain("mystery-code");
	});
});

describe("locale fallback", () => {
	it("lets Austria read the German text — they share one translation row", () => {
		expect(pickConditionText({ "de-DE": "Deutscher Text" }, "de-AT")).toBe("Deutscher Text");
		expect(pickConditionText({ "de-AT": "Österreichisch" }, "de-DE")).toBe("Österreichisch");
	});

	it("does NOT fall back to Slovak on a foreign locale", () => {
		// A Slovak mounting instruction on a German page is not a translation; it is an
		// untranslated string that looks authoritative.
		expect(pickConditionText({ "sk-SK": "Slovensky" }, "de-DE")).toBeNull();
		expect(pickConditionText({ "sk-SK": "Slovensky" }, "fr-FR")).toBeNull();
	});

	it("ignores blank source text rather than rendering an empty bullet", () => {
		expect(pickConditionText({ "sk-SK": "   " }, "sk-SK")).toBeNull();
	});
});

describe("de-duplication", () => {
	it("collapses genuinely identical conditions", () => {
		const out = renderConditions(
			[condition("known-code", { "sk-SK": "Rovnaké" }), condition("known-code", { "sk-SK": "Rovnaké" })],
			"sk-SK",
			KNOWN,
		);
		expect(out.resolved).toHaveLength(1);
	});

	it("keeps two conditions that share a code but say different things", () => {
		// Same code with different parameters is two different restrictions. Collapsing
		// by code alone would delete one of them.
		const out = renderConditions(
			[condition("known-code", { "sk-SK": "Max 60 kg" }), condition("known-code", { "sk-SK": "Max 75 kg" })],
			"sk-SK",
			KNOWN,
		);
		expect(out.resolved).toHaveLength(2);
	});
});

describe("what an unstatable condition does to the verdict", () => {
	it("marks a rendering with a missing condition as NOT unconditional", () => {
		const out = renderConditions([condition("mystery-code")], "sk-SK", KNOWN);
		expect(isUnconditional(out)).toBe(false);
	});

	it("treats a fully rendered set as unconditional", () => {
		const out = renderConditions([condition("known-code")], "sk-SK", KNOWN);
		expect(isUnconditional(out)).toBe(true);
	});

	it("is unconditional when there are no conditions at all", () => {
		expect(isUnconditional(renderConditions([], "sk-SK", KNOWN))).toBe(true);
	});
});
