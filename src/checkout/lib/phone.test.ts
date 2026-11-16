import { describe, expect, it } from "vitest";
import {
	foreignPhoneExample,
	isInternationalPhone,
	normalizePhoneInput,
	phoneExamplesFor,
	phoneHintValues,
} from "@/checkout/lib/phone";

describe("normalizePhoneInput", () => {
	it.each([
		["0901234561", "0901234561"],
		["0901 234 561", "0901234561"],
		["0901/234-561", "0901234561"],
		["(0901) 234.561", "0901234561"],
		["+421 901 234 561", "+421901234561"],
		["+421 (0) 901 234 561", "+421901234561"],
		["+421(0)901234561", "+421901234561"],
		["00421 901 234 561", "+421901234561"],
		["00421901234561", "+421901234561"],
		["  +49 151 23456789  ", "+4915123456789"],
	])("%s -> %s", (raw, expected) => {
		expect(normalizePhoneInput(raw)).toBe(expected);
	});

	it("sends nothing for an empty or blank phone (the field is optional)", () => {
		expect(normalizePhoneInput("")).toBe("");
		expect(normalizePhoneInput("   ")).toBe("");
		expect(normalizePhoneInput(null)).toBe("");
		expect(normalizePhoneInput(undefined)).toBe("");
		expect(normalizePhoneInput("---")).toBe("");
	});

	it("leaves text with letters as typed, so an extension is not glued onto the number", () => {
		expect(normalizePhoneInput("0901 234 561 ext. 12")).toBe("0901 234 561 ext. 12");
		expect(normalizePhoneInput("tel 0901234561")).toBe("tel 0901234561");
	});
});

describe("isInternationalPhone", () => {
	it("knows a number with a calling code", () => {
		expect(isInternationalPhone("+421 901 234 561")).toBe(true);
		expect(isInternationalPhone("00421901234561")).toBe(true);
		expect(isInternationalPhone("0901 234 561")).toBe(false);
		expect(isInternationalPhone("")).toBe(false);
	});
});

describe("phone examples", () => {
	it("has an example for each market's country, in national and international form", () => {
		for (const country of ["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "RO", "FR", "ES", "US", "CA"]) {
			const example = phoneExamplesFor(country);
			expect(example, country).not.toBeNull();
			expect(example!.international.startsWith("+"), country).toBe(true);
		}
		expect(phoneExamplesFor("de")?.international.startsWith("+49")).toBe(true);
	});

	it("shows a foreign calling-code example that is not the delivery country's own", () => {
		expect(foreignPhoneExample("DE")).toMatch(/^\+421 /);
		expect(foreignPhoneExample("SK")).toMatch(/^\+420 /);
	});

	it("falls back to the international example for a country without one", () => {
		const hint = phoneHintValues("XX");
		expect(hint.example).toBe(hint.foreign);
		expect(phoneHintValues("DE").example).toBe(phoneExamplesFor("DE")!.national);
	});
});
