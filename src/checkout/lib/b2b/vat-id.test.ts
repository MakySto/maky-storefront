import { describe, expect, it } from "vitest";

import {
	cleanVatIdInput,
	countryOfVatId,
	isValidSlovakRegistrationId,
	isValidSlovakTaxId,
	normalizeVatId,
	vatFieldLabelKey,
	viesPrefixForCountry,
} from "./vat-id";

describe("normalizeVatId (zadanie 02, §2 Polia a normalizácia)", () => {
	it("upper-cases and strips spaces, dots and hyphens, keeping leading zeros", () => {
		expect(normalizeVatId(" de 123.456-789 ", "DE")).toMatchObject({ ok: true, vatId: "DE123456789" });
		expect(normalizeVatId("cz 01234567", "CZ")).toMatchObject({ ok: true, vatId: "CZ01234567" });
	});

	it("adds the prefix only from the chosen country, never twice", () => {
		expect(normalizeVatId("123456789", "DE")).toMatchObject({ ok: true, vatId: "DE123456789" });
		expect(normalizeVatId("DE123456789", "DE")).toMatchObject({ ok: true, vatId: "DE123456789" });
		expect(normalizeVatId("DEDE123456789", "DE")).toMatchObject({ ok: false, reason: "format" });
	});

	it("keeps the Austrian U and French alphanumeric keys", () => {
		expect(normalizeVatId("ATU12345678", "AT")).toMatchObject({ ok: true, vatId: "ATU12345678" });
		expect(normalizeVatId("U12345678", "AT")).toMatchObject({ ok: true, vatId: "ATU12345678" });
		expect(normalizeVatId("FR 1A 123456789", "FR")).toMatchObject({ ok: true, vatId: "FR1A123456789" });
	});

	it("a French key that starts like another prefix stays French", () => {
		// `HU` + 9 digits is no Hungarian number (8 digits), so the chosen country wins.
		expect(normalizeVatId("HU123456789", "FR")).toMatchObject({ ok: true, vatId: "FRHU123456789" });
	});

	it("takes another member state's prefix when its rest has that state's shape", () => {
		expect(normalizeVatId("DE123456789", "SK")).toMatchObject({
			ok: true,
			vatId: "DE123456789",
			countryCode: "DE",
		});
	});

	it("uses EL for Greece", () => {
		expect(viesPrefixForCountry("GR")).toBe("EL");
		expect(normalizeVatId("123456789", "GR")).toMatchObject({
			ok: true,
			vatId: "EL123456789",
			countryCode: "GR",
		});
	});

	it("rejects empty, malformed and over-long input", () => {
		expect(normalizeVatId("", "DE")).toMatchObject({ ok: false, reason: "empty" });
		expect(normalizeVatId("12345", "DE")).toMatchObject({ ok: false, reason: "format" });
		expect(normalizeVatId("DE1234567890123456789", "DE")).toMatchObject({ ok: false, reason: "format" });
		expect(normalizeVatId("123456789", "US")).toMatchObject({ ok: false, reason: "unsupported_country" });
	});

	it("a matching shape is only a shape: SK numbers need 10 digits", () => {
		expect(normalizeVatId("SK2122890660", "SK")).toMatchObject({ ok: true, vatId: "SK2122890660" });
		expect(normalizeVatId("SK212289066", "SK")).toMatchObject({ ok: false });
	});

	it("cleanVatIdInput removes formatting only", () => {
		expect(cleanVatIdInput("ie 1234567fa")).toBe("IE1234567FA");
	});
});

describe("countryOfVatId / vatFieldLabelKey", () => {
	it("reads the country from the stored prefix", () => {
		expect(countryOfVatId("DE123456789")).toBe("DE");
		expect(countryOfVatId("EL123456789")).toBe("GR");
		expect(countryOfVatId("XX123")).toBeNull();
		expect(countryOfVatId("")).toBeNull();
	});

	it("names the field after the invoiced company's country, generic elsewhere", () => {
		expect(vatFieldLabelKey("SK")).toBe("SK");
		expect(vatFieldLabelKey("at")).toBe("AT");
		expect(vatFieldLabelKey("NL")).toBe("generic");
		expect(vatFieldLabelKey(null)).toBe("generic");
	});
});

describe("Slovak IČO and DIČ", () => {
	it("IČO has 6 to 8 digits", () => {
		expect(isValidSlovakRegistrationId("12345678")).toBe(true);
		expect(isValidSlovakRegistrationId("123456")).toBe(true);
		expect(isValidSlovakRegistrationId("12345")).toBe(false);
		expect(isValidSlovakRegistrationId("1234567A")).toBe(false);
	});

	it("DIČ has 10 digits", () => {
		expect(isValidSlovakTaxId("2122890660")).toBe(true);
		expect(isValidSlovakTaxId("212289066")).toBe(false);
	});
});
