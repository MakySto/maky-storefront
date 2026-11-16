import { PHONE_EXAMPLES } from "@/checkout/lib/consts/phone-examples";

/**
 * Phone numbers in the checkout.
 *
 * Saleor decides whether a number is valid (python-phonenumbers: the number must be possible AND valid for the
 * country of the address; a number with a country calling code is valid for any address). The storefront does not
 * second-guess it, because a client-side rule that is stricter than Saleor's would turn a real customer away. What
 * it does is (1) send the number in a shape Saleor reads the way the customer meant it, (2) show what shape is
 * expected before the customer has to guess, and (3) say in the customer's language what is wrong when Saleor
 * refuses (`phone-diagnosis.ts`).
 */

/** Characters people put into a phone number besides digits: spaces, dots, dashes, slashes, brackets. */
const PLAIN_PHONE = /^[+\d\s().\-/]+$/;

/**
 * The number as it is sent to Saleor. Only text that is plainly a phone number is touched (anything with letters,
 * e.g. an extension, goes as typed and Saleor decides):
 *  - "00 421 …" is the international prefix of most countries: "+421 …" (Saleor only knows the prefix of the
 *    address country, so "00421…" would fail for a US/CA address);
 *  - "+421 (0) 901 …" and "+421 0901 …": the national trunk zero after the calling code is written by many people
 *    and is not part of the number;
 *  - spaces, dots, dashes, slashes and brackets are dropped.
 * An empty or blank value returns "" (the phone is optional and is then not sent at all).
 */
export function normalizePhoneInput(raw: string | null | undefined): string {
	const text = (raw ?? "").trim();
	if (!text) return "";
	if (!PLAIN_PHONE.test(text)) return text;

	let result = text.replace(/^00(?=\s*\d)/, "+");
	// "+421 (0) 901 234 561": drop the bracketed zero that follows the calling code.
	result = result.replace(/^(\+\s*\d{1,3})\s*\(\s*0\s*\)/, "$1");
	const international = result.startsWith("+");
	const digits = result.replace(/\D/g, "");
	if (!digits) return "";
	return international ? `+${digits}` : digits;
}

/** True when the number is written with a country calling code ("+421 …" or "00421 …"). */
export function isInternationalPhone(raw: string | null | undefined): boolean {
	const text = (raw ?? "").trim();
	return text.startsWith("+") || /^00\s*\d/.test(text);
}

/** National and international example number of the delivery country, or null when the country has none. */
export function phoneExamplesFor(
	countryCode: string | null | undefined,
): { national: string; international: string } | null {
	const entry = countryCode ? PHONE_EXAMPLES[countryCode.toUpperCase()] : undefined;
	return entry ? { national: entry[0], international: entry[1] } : null;
}

export type PhoneHintValues = { national: string; international: string };

/** A number as it is shown inside a sentence: its groups stay on one line ("+49 1512 3456789" never breaks after +49). */
export function unbrokenPhone(text: string): string {
	return text.replace(/ /g, "\u00a0");
}

/**
 * The two ways the delivery country's own number is written, for the hint under the phone field: at home
 * ("0912 123 456") and with the country's calling code ("+421 912 123 456"). Null when the country has no example;
 * the field then shows no hint. The example is always the delivery country's: a German address shows a German
 * number and the German calling code, whatever storefront the customer is on (owner, 2026-11-16).
 */
export function phoneHintValues(countryCode: string | null | undefined): PhoneHintValues | null {
	const examples = phoneExamplesFor(countryCode);
	return (
		examples && {
			national: unbrokenPhone(examples.national),
			international: unbrokenPhone(examples.international),
		}
	);
}
