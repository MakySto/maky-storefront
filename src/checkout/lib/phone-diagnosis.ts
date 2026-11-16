import { PHONE_RULES, type PhoneRule } from "@/checkout/lib/consts/phone-rules";
import { normalizePhoneInput, phoneExamplesFor } from "@/checkout/lib/phone";

/**
 * What is wrong with a phone number Saleor refused.
 *
 * Saleor stays the judge (see `phone.ts`): nothing here refuses a number, and a number is only looked at after
 * Saleor has said no. What this adds is the reason, so the customer is not told "not valid" and left to guess:
 *  - the number is a digit or two short, or long, for the country it belongs to;
 *  - the number is a mobile number of another market written the way people write it at home ("0901 234 561" on
 *    an order to Germany), and then the same number with its calling code is offered.
 * The rules are those of python-phonenumbers, the library Saleor validates with (`consts/phone-rules.ts`), for the
 * countries of the twelve markets. Anything outside them, and anything that fits neither case, has no diagnosis
 * and gets the plain sentence with the country's example.
 */
export type PhoneDiagnosis =
	| { kind: "tooShort" | "tooLong"; country: string }
	| { kind: "otherCountry"; country: string; suggestion: string };

const wholePatterns = new Map<string, RegExp>();
function matchesWhole(source: string, value: string): boolean {
	let pattern = wholePatterns.get(source);
	if (!pattern) {
		pattern = new RegExp(`^(?:${source})$`);
		wholePatterns.set(source, pattern);
	}
	return pattern.test(value);
}

/** Valid as python-phonenumbers means it: the country's general pattern and one of its kinds of number match. */
function isValidNational(national: string, rule: PhoneRule): boolean {
	return matchesWhole(rule.general, national) && rule.types.some((source) => matchesWhole(source, national));
}

/**
 * The number without the trunk prefix people dial at home (the "0" of "0901…", the "06" of Hungary, the "1" of the
 * US). As in python-phonenumbers the prefix stays when the number only makes sense with it.
 */
function withoutTrunk(digits: string, rule: PhoneRule): string {
	if (!rule.trunk) return digits;
	const prefix = new RegExp(`^(?:${rule.trunk})`).exec(digits)?.[0];
	if (!prefix) return digits;
	const stripped = digits.slice(prefix.length);
	if (matchesWhole(rule.general, digits) && !matchesWhole(rule.general, stripped)) return digits;
	return stripped;
}

/** How many digits may be missing or extra for the number to count as a slip of the finger. */
const SLIP = 2;

function lengthSlip(national: string, rule: PhoneRule): "tooShort" | "tooLong" | null {
	if (national.length < 3 || isValidNational(national, rule)) return null;
	for (let count = 1; count <= SLIP; count++) {
		for (let tail = 0; tail < 10 ** count; tail++) {
			if (isValidNational(national + String(tail).padStart(count, "0"), rule)) return "tooShort";
		}
		if (national.length > count + 2 && isValidNational(national.slice(0, -count), rule)) return "tooLong";
	}
	return null;
}

/** "+421 901 234 561": the national number written like the country's own example when the lengths agree. */
function formatInternational(country: string, rule: PhoneRule, national: string): string {
	const example = phoneExamplesFor(country)?.international ?? "";
	const template = example.slice(example.indexOf(" ") + 1);
	if (template.replace(/\D/g, "").length !== national.length) return `+${rule.callingCode} ${national}`;
	let next = 0;
	return `+${rule.callingCode} ${template.replace(/\d/g, () => national[next++])}`;
}

/** The markets a number with a calling code can belong to ("+1" is both the US and Canada). */
function countriesOfCallingCode(digits: string): string[] {
	const codes = Object.entries(PHONE_RULES).filter(([, rule]) => digits.startsWith(rule.callingCode));
	const longest = Math.max(0, ...codes.map(([, rule]) => rule.callingCode.length));
	return codes.filter(([, rule]) => rule.callingCode.length === longest).map(([country]) => country);
}

/**
 * The diagnosis of a refused number, or null when there is none to give.
 *
 * `country` is the country of the address. `homeCountry` is the country of the storefront the customer is on
 * (maky.store/sk is SK): when a national number fits the mobile numbers of several other markets, the customer's
 * own storefront decides, and without it an ambiguous number has no diagnosis.
 */
export function diagnosePhone(
	raw: string | null | undefined,
	country: string | null | undefined,
	homeCountry?: string | null,
): PhoneDiagnosis | null {
	const number = normalizePhoneInput(raw);
	if (!/^\+?\d+$/.test(number)) return null;

	if (number.startsWith("+")) {
		const digits = number.slice(1);
		for (const candidate of countriesOfCallingCode(digits)) {
			const rule = PHONE_RULES[candidate];
			const national = withoutTrunk(digits.slice(rule.callingCode.length), rule);
			if (isValidNational(national, rule)) return null;
			const slip = lengthSlip(national, rule);
			if (slip) return { kind: slip, country: candidate };
		}
		return null;
	}

	const own = country?.toUpperCase() ?? "";
	const rule = PHONE_RULES[own];
	if (!rule) return null;
	const national = withoutTrunk(number, rule);
	if (isValidNational(national, rule)) return null;
	const slip = lengthSlip(national, rule);
	if (slip) return { kind: slip, country: own };

	// A mobile number of another market, written as it is written at home: with that market's trunk zero when it
	// has one (North Americans leave their "1" out, so it is not asked for). Mobile only, because that is the number
	// a customer gives a courier, and the landline patterns of some countries are wide enough to match another
	// country's mistyped number.
	const matches: Array<{ country: string; suggestion: string }> = [];
	for (const [candidate, other] of Object.entries(PHONE_RULES)) {
		if (candidate === own || other.callingCode === rule.callingCode || !other.mobile) continue;
		const stripped = withoutTrunk(number, other);
		if (other.trunk && other.callingCode !== "1" && stripped === number) continue;
		if (!matchesWhole(other.mobile, stripped) || !matchesWhole(other.general, stripped)) continue;
		matches.push({ country: candidate, suggestion: formatInternational(candidate, other, stripped) });
	}
	const home = homeCountry?.toUpperCase();
	const match = matches.find((entry) => entry.country === home) ?? (matches.length === 1 ? matches[0] : null);
	return match ? { kind: "otherCountry", ...match } : null;
}
