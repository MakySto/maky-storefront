import { describe, expect, it } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { AUSTRIA, GERMANY } from "./german-market";

/**
 * Germany and Austria share one German text and two different sets of law.
 *
 * These assertions pin the places where they must NOT converge. The failure they guard
 * is a plausible one: a later edit "tidying up" two nearly identical strings into one,
 * which would silently tell an Austrian reader that § 25 TDDDG governs their consent.
 */
describe("the German and Austrian legal profiles stay distinct", () => {
	it("names a different ePrivacy statute in each market", () => {
		expect(GERMANY.ePrivacyStatute).toBe("§ 25 TDDDG");
		expect(AUSTRIA.ePrivacyStatute).toBe("§ 165 Absatz 3 TKG 2021");
	});

	it("uses the local name for the right to withdraw", () => {
		expect(GERMANY.withdrawalTerm).toBe("Widerrufsrecht");
		expect(AUSTRIA.withdrawalTerm).toBe("Rücktrittsrecht");
	});

	it("keeps the mandatory-law carve-out market-specific", () => {
		expect(GERMANY.mandatoryLawSentence).toContain("deutsche");
		// Austria names the VGG and the KSchG rather than a generic adjective.
		expect(AUSTRIA.mandatoryLawSentence).toContain("Verbrauchergewährleistungsgesetz");
		expect(AUSTRIA.mandatoryLawSentence).toContain("Konsumentenschutzgesetz");
		expect(GERMANY.mandatoryLawSentence).not.toBe(AUSTRIA.mandatoryLawSentence);
	});

	it("keeps every market-specific field actually different", () => {
		for (const key of ["countryName", "withdrawalTerm", "mandatoryLawSentence", "ePrivacyStatute"] as const) {
			expect(GERMANY[key], `${key} is shared between DE and AT`).not.toBe(AUSTRIA[key]);
		}
	});
});

describe("no German text promises an online function that is not served", () => {
	it("Austria's terminology note does not assert a running online function", () => {
		// The delivered copy said "Für die Online-Funktion verwenden wir …", which claims
		// in the present tense that the function exists. Returns V2 accepts `SK` only, so
		// on /at it does not — and a statutory page must not describe controls the reader
		// cannot reach. The active wording is kept separately for the release that turns
		// the function on.
		expect(AUSTRIA.terminologyNote).not.toBeNull();
		expect(AUSTRIA.terminologyNote).not.toMatch(/Für die Online-Funktion/);
		expect(AUSTRIA.terminologyNoteWhenFormLive).toMatch(/Für die Online-Funktion/);
	});

	it("keeps the live variant unrendered while the markets are not served", () => {
		// The tripwire: if either market ever resolves to the Slovak legal locale, the
		// form gate would open and this whole assumption changes.
		expect(legalLocaleFor("de-eur")).not.toBe("sk");
		expect(legalLocaleFor("at-eur")).not.toBe("sk");
	});
});
