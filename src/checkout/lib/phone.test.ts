import { describe, expect, it } from "vitest";
import {
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

	it("shows the delivery country's own number in both forms, and nothing for a country without an example", () => {
		const plain = (country: string) => {
			const hint = phoneHintValues(country)!;
			return {
				national: hint.national.replace(/\u00a0/g, " "),
				international: hint.international.replace(/\u00a0/g, " "),
			};
		};
		expect(plain("DE")).toEqual({ national: "01512 3456789", international: "+49 1512 3456789" });
		expect(plain("SK")).toEqual({ national: "0912 123 456", international: "+421 912 123 456" });
		// Inside a sentence a number never breaks after its calling code.
		expect(phoneHintValues("DE")!.international).toBe("+49\u00a01512\u00a03456789");
		expect(phoneHintValues("XX")).toBeNull();
		expect(phoneHintValues(undefined)).toBeNull();
	});

	it("never shows one market another market's calling code (owner, 2026-11-16)", () => {
		const codes: Record<string, string> = {
			SK: "+421", CZ: "+420", DE: "+49", AT: "+43", PL: "+48", HU: "+36",
			IT: "+39", RO: "+40", FR: "+33", ES: "+34", US: "+1", CA: "+1",
		}; // prettier-ignore
		for (const [country, code] of Object.entries(codes)) {
			expect(phoneHintValues(country)!.international.startsWith(`${code}\u00a0`), country).toBe(true);
		}
	});
});
