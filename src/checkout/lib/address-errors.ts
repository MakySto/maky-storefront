import { type CountryCode } from "@/checkout/graphql";
import { getCountryName } from "@/checkout/lib/utils/locale";
import { isInternationalPhone, phoneHintValues } from "@/checkout/lib/phone";

/**
 * Saleor answers an address mutation with an English `message` per field. The message is never shown: on a German
 * page it is English, and the wording is Saleor's. A field Saleor refuses is explained with our own text, chosen by
 * the field and the error code; a field this table does not know keeps Saleor's text (still a known gap, see
 * `checkout-transport-next.ts`) so nothing a customer needs to know is lost.
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

/**
 * The errors of an address mutation with the translated text on the ones we explain. `address` is what was sent
 * (its country and phone decide the wording).
 */
export function localizeAddressErrors<T extends AddressErrorLike>(
	errors: ReadonlyArray<T> | null | undefined,
	options: {
		t: Translate;
		locale: string;
		address: { country?: string | null; phone?: string | null } | null | undefined;
	},
): T[] | null | undefined {
	if (!errors?.length) return errors as T[] | null | undefined;
	return errors.map((error) =>
		isPhoneRefusal(error)
			? {
					...error,
					field: error.field || "phone",
					message: phoneRefusalMessage({
						t: options.t,
						locale: options.locale,
						countryCode: options.address?.country,
						phone: options.address?.phone,
					}),
				}
			: error,
	);
}
