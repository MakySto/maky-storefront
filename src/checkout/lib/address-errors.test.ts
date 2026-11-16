import { describe, expect, it } from "vitest";
import { isPhoneRefusal, localizeAddressErrors, phoneRefusalMessage } from "@/checkout/lib/address-errors";

/** A translator that shows which key and values it was asked for. */
const t = (key: string, values?: Record<string, string>) =>
	`${key}|${Object.entries(values ?? {})
		.map(([k, v]) => `${k}=${v}`)
		.join(",")}`;

describe("isPhoneRefusal", () => {
	it("recognises Saleor's refusal of a phone number, by field and by its text", () => {
		expect(
			isPhoneRefusal({
				field: "phone",
				code: "INVALID",
				message: "'0901234561' is not a valid phone number.",
			}),
		).toBe(true);
		expect(
			isPhoneRefusal({ field: null, code: "INVALID", message: "'123' is not a valid phone number." }),
		).toBe(true);
	});

	it("does not touch other fields, or a missing required phone", () => {
		expect(isPhoneRefusal({ field: "postalCode", code: "INVALID", message: "Invalid postal code" })).toBe(
			false,
		);
		expect(isPhoneRefusal({ field: "phone", code: "REQUIRED", message: "This field is required." })).toBe(
			false,
		);
	});
});

describe("phoneRefusalMessage", () => {
	it("explains the national shape of the delivery country and the calling-code form", () => {
		const message = phoneRefusalMessage({ t, locale: "de-DE", countryCode: "DE", phone: "0901234561" });
		expect(message).toContain("checkout.addressForm.phoneInvalid|");
		expect(message).toContain("country=Deutschland");
		expect(message).toContain("example=01512 3456789");
		expect(message).toContain("foreign=+421 912 123 456");
	});

	it("asks to check a number that already has a calling code", () => {
		const message = phoneRefusalMessage({ t, locale: "sk-SK", countryCode: "DE", phone: "+421 901" });
		expect(message).toContain("checkout.addressForm.phoneInvalidIntl|");
	});
});

describe("localizeAddressErrors", () => {
	const options = { t, locale: "sk-SK", address: { country: "DE", phone: "0901234561" } };

	it("replaces the English text of the phone error and keeps the field and code", () => {
		const [error] = localizeAddressErrors(
			[{ field: "phone", code: "INVALID", message: "'0901234561' is not a valid phone number." }],
			options,
		)!;
		expect(error.field).toBe("phone");
		expect(error.code).toBe("INVALID");
		expect(error.message).toContain("checkout.addressForm.phoneInvalid|");
		expect(error.message).not.toContain("not a valid");
	});

	it("leaves every other error as Saleor sent it", () => {
		const other = { field: "postalCode", code: "INVALID", message: "Invalid postal code" };
		expect(localizeAddressErrors([other], options)).toEqual([other]);
		expect(localizeAddressErrors(undefined, options)).toBeUndefined();
		expect(localizeAddressErrors([], options)).toEqual([]);
	});
});
