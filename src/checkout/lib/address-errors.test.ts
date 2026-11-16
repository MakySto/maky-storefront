import { describe, expect, it } from "vitest";
import {
	hasPostalCodeRefusal,
	isPhoneRefusal,
	localizeAddressErrors,
	missingDeliveryPhoneError,
	phoneRefusalMessage,
	placeAddressErrors,
} from "@/checkout/lib/address-errors";

/**
 * A translator that shows which key and values it was asked for. The numbers inside a sentence carry no-break
 * spaces (`unbrokenPhone`); they are written here with plain ones so the expectations stay readable.
 */
const t = (key: string, values?: Record<string, string>) =>
	`${key}|${Object.entries(values ?? {})
		.map(([k, v]) => `${k}=${v}`)
		.join(",")}`.replace(/\u00a0/g, " ");

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
	const PAIR = "checkout.addressForm.phoneExamplePair|national=01512 3456789,international=+49 1512 3456789";

	it("says a German number is a digit short, with the German example in both forms (owner's case, 2026-11-16)", () => {
		const message = phoneRefusalMessage({ t, locale: "de-DE", countryCode: "DE", phone: "01513521456" });
		expect(message).toBe(`checkout.addressForm.phoneTooShort|country=Deutschland,example=${PAIR}`);
		expect(message).not.toContain("+421");
	});

	it("says a number is a digit too long", () => {
		const message = phoneRefusalMessage({ t, locale: "de-DE", countryCode: "DE", phone: "0151 352145678" });
		expect(message).toBe(`checkout.addressForm.phoneTooLong|country=Deutschland,example=${PAIR}`);
	});

	it("asks to check a number it cannot explain, again with the delivery country's own example only", () => {
		const message = phoneRefusalMessage({ t, locale: "de-DE", countryCode: "DE", phone: "0123 4567890" });
		expect(message).toBe(`checkout.addressForm.phoneInvalid|country=Deutschland,example=${PAIR}`);
	});

	it("offers a Slovak mobile number with its calling code on an order to Germany", () => {
		const message = phoneRefusalMessage({ t, locale: "sk-SK", countryCode: "DE", phone: "0901 234 561" });
		expect(message).toBe(
			"checkout.addressForm.phoneOtherCountry|country=Nemecko,otherCountry=Slovensko,suggestion=+421 901 234 561",
		);
	});

	it("explains a number with a calling code by the country of that code, in the international form alone", () => {
		const short = phoneRefusalMessage({ t, locale: "sk-SK", countryCode: "DE", phone: "+421 90123456" });
		expect(short).toBe("checkout.addressForm.phoneTooShort|country=Slovensko,example=+421 912 123 456");
		const unknown = phoneRefusalMessage({ t, locale: "sk-SK", countryCode: "DE", phone: "+421 123" });
		expect(unknown).toBe("checkout.addressForm.phoneInvalid|country=Nemecko,example=+49 1512 3456789");
	});

	it("keeps each number on one line", () => {
		const raw = (key: string, values?: Record<string, string>) =>
			`${key}|${Object.values(values ?? {}).join("|")}`;
		const message = phoneRefusalMessage({
			t: raw,
			locale: "sk-SK",
			countryCode: "DE",
			phone: "0901 234 561",
		});
		expect(message).toContain("+421\u00a0901\u00a0234\u00a0561");
		expect(phoneRefusalMessage({ t: raw, locale: "de-DE", countryCode: "DE", phone: "0123" })).toContain(
			"+49\u00a01512\u00a03456789",
		);
	});

	it("has a sentence without an example for a country that has none", () => {
		const message = phoneRefusalMessage({ t, locale: "sk-SK", countryCode: "XX", phone: "123" });
		expect(message).toBe("checkout.addressForm.phoneInvalidNoExample|");
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
		expect(error.message).toContain("checkout.addressForm.phoneOtherCountry|");
		expect(error.message).not.toContain("not a valid");
	});

	it("says a refused postal code in the customer's language, with the country's own example", () => {
		const refused = {
			field: "postalCode",
			code: "INVALID",
			message: "This value is not valid for the address.",
		};
		const [withExample] = localizeAddressErrors([refused], { ...options, postalCodeExample: "10115" })!;
		expect(withExample.field).toBe("postalCode");
		expect(withExample.message).toBe("checkout.addressForm.postalCodeInvalid|country=Nemecko,example=10115");
		// Without an example (the rules could not be read) the field is still named, in our words.
		const [plain] = localizeAddressErrors([refused], options)!;
		expect(plain.message).toBe("checkout.addressForm.fieldInvalid|field=checkout.postalCode|");
	});

	it("names a required or refused field by the label the form shows", () => {
		const [required, invalid] = localizeAddressErrors(
			[
				{ field: "city", code: "REQUIRED", message: "This field is required." },
				{ field: "countryArea", code: "INVALID", message: "This value is not valid for the address." },
			],
			options,
		)!;
		expect(required.message).toBe("checkout.addressForm.fieldRequired|field=checkout.city|");
		expect(invalid.message).toBe(
			"checkout.addressForm.fieldInvalid|field=checkout.addressForm.fields.countryArea|",
		);
	});

	it("takes the field off an error that is not about an address input, so a form shows it on itself", () => {
		const [stock, unknown] = localizeAddressErrors(
			[
				{
					field: "quantity",
					code: "INSUFFICIENT_STOCK",
					message: "Could not add items Reťaze. Only 0 remaining in stock.",
				},
				{ field: "lines", code: "GRAPHQL_ERROR", message: "Something internal." },
			],
			options,
		)!;
		expect(stock.field).toBeNull();
		expect(stock.message).toBe("checkout.addressForm.notAvailableInCountry|country=Nemecko");
		expect(unknown.field).toBeNull();
		expect(unknown.message).toBe("checkout.info.addressSaveFailed|");
	});

	it("never shows Saleor's English sentence, whatever the field and code", () => {
		const english = "This value is not valid for the address.";
		for (const field of ["firstName", "streetAddress1", "city", "postalCode", "country", "quantity", null]) {
			for (const code of ["INVALID", "REQUIRED", "NOT_FOUND", "INSUFFICIENT_STOCK"]) {
				const [error] = localizeAddressErrors([{ field, code, message: english }], options)!;
				expect(error.message).not.toContain("not valid");
			}
		}
	});

	it("leaves the codes the caller acts on (payment in progress, changed tax context) untouched", () => {
		const locked = { field: null, code: "B2B_CHECKOUT_LOCKED", message: "locked" };
		const changed = { field: null, code: "B2B_TAX_CONTEXT_CHANGED", message: "changed" };
		expect(localizeAddressErrors([locked, changed], options)).toEqual([locked, changed]);
	});

	it("passes nothing through as nothing", () => {
		expect(localizeAddressErrors(undefined, options)).toBeUndefined();
		expect(localizeAddressErrors([], options)).toEqual([]);
	});
});

describe("missingDeliveryPhoneError", () => {
	it("is a required-field error at the phone, in the form's own words", () => {
		expect(missingDeliveryPhoneError(t)).toEqual({
			field: "phone",
			code: "REQUIRED",
			message: "checkout.addressForm.fieldRequired|field=checkout.phone|",
		});
	});
});

describe("hasPostalCodeRefusal", () => {
	it("is true only for a postal code Saleor read and refused", () => {
		expect(hasPostalCodeRefusal([{ field: "postalCode", code: "INVALID" }])).toBe(true);
		expect(hasPostalCodeRefusal([{ field: "postalCode", code: "REQUIRED" }])).toBe(false);
		expect(hasPostalCodeRefusal([{ field: "city", code: "INVALID" }])).toBe(false);
		expect(hasPostalCodeRefusal(null)).toBe(false);
	});
});

describe("placeAddressErrors", () => {
	const onScreen = ["firstName", "lastName", "streetAddress1", "city", "postalCode", "phone"];

	it("puts an error at its input when that input is on screen", () => {
		const placed = placeAddressErrors(
			[
				{ field: "postalCode", message: "PSČ" },
				{ field: "phone", message: "Telefón" },
			],
			onScreen,
			"fallback",
		);
		expect(placed.fields).toEqual({ postalCode: "PSČ", phone: "Telefón" });
		expect(placed.form).toEqual([]);
	});

	it("puts an error on the form when its input is not on screen, or it has no field", () => {
		const placed = placeAddressErrors(
			[
				{ field: "quantity", message: "Sklad" },
				{ field: null, message: "Sklad" },
				{ field: "countryArea", message: "" },
			],
			onScreen,
			"fallback",
		);
		expect(placed.fields).toEqual({});
		expect(placed.form).toEqual(["Sklad", "fallback"]);
	});

	it("shows only the phone when a saved address is picked and only the phone is asked", () => {
		const placed = placeAddressErrors(
			[
				{ field: "phone", message: "Telefón" },
				{ field: "postalCode", message: "PSČ" },
			],
			["phone"],
			"fallback",
		);
		expect(placed.fields).toEqual({ phone: "Telefón" });
		expect(placed.form).toEqual(["PSČ"]);
	});
});
