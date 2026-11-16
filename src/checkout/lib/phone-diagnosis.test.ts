import { describe, expect, it } from "vitest";
import { PHONE_RULES } from "@/checkout/lib/consts/phone-rules";
import { phoneExamplesFor } from "@/checkout/lib/phone";
import { diagnosePhone } from "@/checkout/lib/phone-diagnosis";

const MARKETS = ["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO", "US", "CA"];

describe("phone rules", () => {
	it("cover the twelve markets and compile", () => {
		expect(Object.keys(PHONE_RULES).sort()).toEqual([...MARKETS].sort());
		for (const rule of Object.values(PHONE_RULES)) {
			for (const source of [rule.general, ...rule.types, rule.mobile ?? "", rule.trunk ?? ""]) {
				expect(() => new RegExp(source)).not.toThrow();
			}
		}
	});

	it("find nothing wrong with any market's own example, in either form, at any market's address", () => {
		for (const country of MARKETS) {
			const example = phoneExamplesFor(country)!;
			expect(diagnosePhone(example.national, country), `${country} national`).toBeNull();
			for (const address of MARKETS) {
				expect(diagnosePhone(example.international, address), `${country} at ${address}`).toBeNull();
			}
		}
	});
});

describe("diagnosePhone: the delivery country's own number", () => {
	it.each([
		// The owner's case: a 0151 mobile number has eleven digits after the zero, this one has ten.
		["01513521456", "DE", "tooShort"],
		["0151 352145678", "DE", "tooLong"],
		["090123456", "SK", "tooShort"],
		["0901 234 5612", "SK", "tooLong"],
		["60112345", "CZ", "tooShort"],
		["5123456", "PL", "tooShort"],
		["0620123456", "HU", "tooShort"],
		["061234567", "FR", "tooShort"],
		["61234567", "ES", "tooShort"],
		["071234567", "RO", "tooShort"],
		["312345678", "IT", "tooShort"],
		["201555012", "US", "tooShort"],
		["(416) 555-012", "CA", "tooShort"],
		["0664 12", "AT", "tooShort"],
	])("%s at %s is %s", (phone, country, kind) => {
		expect(diagnosePhone(phone, country)).toEqual({ kind, country });
	});

	it("reads a number with the country's own calling code the same way, also written with 00", () => {
		expect(diagnosePhone("+49 151 3521456", "DE")).toEqual({ kind: "tooShort", country: "DE" });
		expect(diagnosePhone("0049 151 3521456", "DE")).toEqual({ kind: "tooShort", country: "DE" });
		expect(diagnosePhone("+1 416 555 012", "SK")).toEqual({ kind: "tooShort", country: "CA" });
	});

	it("names the country of the calling code, not the delivery country", () => {
		expect(diagnosePhone("+421 90123456", "DE")).toEqual({ kind: "tooShort", country: "SK" });
	});

	it("has nothing to say about a number it cannot explain, or about text that is not a number", () => {
		expect(diagnosePhone("0123 4567890", "DE")).toBeNull();
		expect(diagnosePhone("+999 123 456", "DE")).toBeNull();
		expect(diagnosePhone("tel 0901", "SK")).toBeNull();
		expect(diagnosePhone("12", "DE")).toBeNull();
		expect(diagnosePhone("", "DE")).toBeNull();
		expect(diagnosePhone("0901234561", "NL")).toBeNull();
	});
});

describe("diagnosePhone: a mobile number of another market", () => {
	it("offers a Slovak number with +421 on an order to Germany or Czechia", () => {
		const offered = { kind: "otherCountry", country: "SK", suggestion: "+421 901 234 561" };
		expect(diagnosePhone("0901 234 561", "DE")).toEqual(offered);
		expect(diagnosePhone("0901234561", "CZ", "SK")).toEqual(offered);
	});

	it("writes a North American number the North American way", () => {
		expect(diagnosePhone("201 555 0123", "SK", "US")).toEqual({
			kind: "otherCountry",
			country: "US",
			suggestion: "+1 201-555-0123",
		});
	});

	it("lets the customer's own storefront decide between markets, and stays silent without it", () => {
		// Nine digits starting with 6 are a mobile number in Czechia, in Spain and in Poland.
		expect(diagnosePhone("601 123 456", "HU", "CZ")).toMatchObject({
			country: "CZ",
			suggestion: "+420 601 123 456",
		});
		expect(diagnosePhone("601 123 456", "HU", "ES")).toMatchObject({ country: "ES" });
		expect(diagnosePhone("601 123 456", "HU")).toBeNull();
	});

	it("puts a slip in the delivery country's own number first", () => {
		// The owner's number is also a possible Italian landline; a German address must hear about Germany.
		expect(diagnosePhone("01513521456", "DE", "IT")).toEqual({ kind: "tooShort", country: "DE" });
	});

	it("does not take a landline of another market for the customer's number", () => {
		expect(diagnosePhone("02 5555 1234", "PL", "SK")).toBeNull();
	});
});
