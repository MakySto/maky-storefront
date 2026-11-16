import { type CountryCode } from "@/checkout/graphql";
import { getCountryName } from "@/checkout/lib/utils/locale";
import { isInternationalPhone, phoneHintValues } from "@/checkout/lib/phone";
import { isCheckoutLockedCode, isTaxContextChangedCode } from "@/checkout/lib/b2b/contract";

/**
 * Saleor answers an address mutation with an English `message` per field. The message is never shown: on a German
 * page it is English, and the wording is Saleor's. A field Saleor refuses is explained with our own text, chosen by
 * the field and the error code; anything this table does not know becomes "the address could not be saved", said
 * on the form.
 */
export type AddressErrorLike = { field?: string | null; code?: string | null; message?: string | null };

type Translate = (key: string, values?: Record<string, string>) => string;

/** Saleor's wording for a number it cannot read; the code is INVALID, the text is the second line of defence. */
const SALEOR_PHONE_TEXT = /not a valid phone number/i;

export function isPhoneRefusal(error: AddressErrorLike): boolean {
	if (error.code === "REQUIRED") return false;
	return error.field === "phone" || (!error.field && SALEOR_PHONE_TEXT.test(error.message ?? ""));
}

/**
 * The text for a refused phone number: the shape the delivery country expects, and the calling-code form for a
 * customer who lives abroad. A number that already carries a calling code is told to be checked, with the example.
 */
export function phoneRefusalMessage(options: {
	t: Translate;
	locale: string;
	countryCode: string | null | undefined;
	phone: string | null | undefined;
}): string {
	const { t, locale, countryCode, phone } = options;
	const hint = phoneHintValues(countryCode);
	if (isInternationalPhone(phone)) {
		return t("checkout.addressForm.phoneInvalidIntl", { foreign: hint.foreign });
	}
	return t("checkout.addressForm.phoneInvalid", {
		country: countryCode ? getCountryName(countryCode as CountryCode, locale) : "",
		example: hint.example,
		foreign: hint.foreign,
	});
}

/** The label of an address field, by the key the address forms use for it (`use-address-form-utils`). */
const FIELD_LABEL_KEYS: Record<string, string> = {
	firstName: "checkout.firstName",
	lastName: "checkout.lastName",
	companyName: "checkout.addressForm.fields.companyName",
	streetAddress1: "checkout.address",
	streetAddress2: "checkout.addressForm.fields.streetAddress2",
	city: "checkout.city",
	cityArea: "checkout.addressForm.fields.cityArea",
	countryArea: "checkout.addressForm.fields.countryArea",
	postalCode: "checkout.postalCode",
	country: "checkout.country",
	phone: "checkout.phone",
};

/** Saleor's codes for "the cart cannot be delivered there": the lines, not the address, are refused. */
const STOCK_CODES = new Set([
	"INSUFFICIENT_STOCK",
	"PRODUCT_UNAVAILABLE_FOR_PURCHASE",
	"PRODUCT_NOT_PUBLISHED",
]);

/** Codes whose handling belongs to the caller (the payment-in-progress lock, the changed tax context): never reworded. */
function isContractCode(code: string | null | undefined): boolean {
	return isCheckoutLockedCode(code) || isTaxContextChangedCode(code);
}

/** The delivery phone is ours to require (owner, 2026-11-16): the courier needs a number, Saleor does not ask for one. */
export function missingDeliveryPhoneError(t: Translate): Required<AddressErrorLike> {
	return {
		field: "phone",
		code: "REQUIRED",
		message: t("checkout.addressForm.fieldRequired", { field: t("checkout.phone") }),
	};
}

/**
 * The errors of an address mutation, every one with our text in the customer's language. `address` is what was sent
 * (its country and phone decide the wording); `postalCodeExample` is the country's example from Saleor's own rules,
 * when the caller has it. An error about something that is not an address field (stock in the delivery country)
 * loses its field, so a form shows it on itself and never on an input that is not there.
 */
export function localizeAddressErrors<T extends AddressErrorLike>(
	errors: ReadonlyArray<T> | null | undefined,
	options: {
		t: Translate;
		locale: string;
		address: { country?: string | null; phone?: string | null } | null | undefined;
		postalCodeExample?: string | null;
	},
): T[] | null | undefined {
	if (!errors?.length) return errors as T[] | null | undefined;
	const { t, locale, address } = options;
	const country = address?.country ? getCountryName(address.country as CountryCode, locale) : "";
	return errors.map((error) => {
		if (isContractCode(error.code)) return error;
		if (isPhoneRefusal(error)) {
			return {
				...error,
				field: error.field || "phone",
				message: phoneRefusalMessage({ t, locale, countryCode: address?.country, phone: address?.phone }),
			};
		}
		if (STOCK_CODES.has(error.code ?? "")) {
			return { ...error, field: null, message: t("checkout.addressForm.notAvailableInCountry", { country }) };
		}
		const labelKey = error.field ? FIELD_LABEL_KEYS[error.field] : undefined;
		if (!labelKey) {
			return { ...error, field: null, message: t("checkout.info.addressSaveFailed") };
		}
		const field = t(labelKey);
		if (error.code === "REQUIRED") {
			return { ...error, message: t("checkout.addressForm.fieldRequired", { field }) };
		}
		if (error.field === "postalCode" && options.postalCodeExample) {
			return {
				...error,
				message: t("checkout.addressForm.postalCodeInvalid", { country, example: options.postalCodeExample }),
			};
		}
		return { ...error, message: t("checkout.addressForm.fieldInvalid", { field }) };
	});
}

/** Whether an address error names its postal code as badly formed (then the country's example is worth reading). */
export function hasPostalCodeRefusal(errors: ReadonlyArray<AddressErrorLike> | null | undefined): boolean {
	return Boolean(errors?.some((error) => error.field === "postalCode" && error.code !== "REQUIRED"));
}

/**
 * Where the errors of a saved delivery address are shown: at the input they are about when that input is on
 * screen, on the form otherwise. An error is never placed on an input the customer cannot see.
 */
export function placeAddressErrors(
	errors: ReadonlyArray<AddressErrorLike>,
	fieldsOnScreen: readonly string[],
	fallbackMessage: string,
): { fields: Record<string, string>; form: string[] } {
	const placed: { fields: Record<string, string>; form: string[] } = { fields: {}, form: [] };
	for (const error of errors) {
		const message = error.message || fallbackMessage;
		if (error.field && fieldsOnScreen.includes(error.field)) placed.fields[error.field] ??= message;
		else placed.form.push(message);
	}
	placed.form = [...new Set(placed.form)];
	return placed;
}
