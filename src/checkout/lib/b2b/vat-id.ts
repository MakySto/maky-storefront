/**
 * VAT identification numbers: normalization, VIES prefix and a FORMAT check.
 *
 * A format that matches is not a valid number — only VIES says that, and only the backend decides what a VIES
 * answer is worth. This module exists so the customer sees a typo before a network call, and so that every
 * number the storefront stores or sends is spelled one way.
 *
 * Rules from the brief (§2 "Polia a normalizácia"):
 * - upper-case, strip formatting (spaces, dots, hyphens); keep meaningful letters and leading zeros
 *   (the Austrian `U`, French alphanumeric keys, Irish `+`/`*`);
 * - add the prefix only from an explicitly chosen country, never `DEDE…` when the customer typed it already;
 * - the rate is never derived from the language, the IP or the phone number — nothing here touches rates.
 */

/** EU member states by ISO 3166 code → VIES prefix. Greece is `EL` in VIES, `GR` everywhere else. */
const VIES_PREFIX_BY_COUNTRY: Readonly<Record<string, string>> = {
	AT: "AT",
	BE: "BE",
	BG: "BG",
	CY: "CY",
	CZ: "CZ",
	DE: "DE",
	DK: "DK",
	EE: "EE",
	ES: "ES",
	FI: "FI",
	FR: "FR",
	GR: "EL",
	HR: "HR",
	HU: "HU",
	IE: "IE",
	IT: "IT",
	LT: "LT",
	LU: "LU",
	LV: "LV",
	MT: "MT",
	NL: "NL",
	PL: "PL",
	PT: "PT",
	RO: "RO",
	SE: "SE",
	SI: "SI",
	SK: "SK",
};

const COUNTRY_BY_VIES_PREFIX: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(VIES_PREFIX_BY_COUNTRY).map(([country, prefix]) => [prefix, country]),
);

/**
 * The national part (after the prefix), per VIES prefix. Deliberately permissive where a country has several
 * historical shapes; a pattern that rejects a real number is worse than one that lets VIES answer.
 */
const NATIONAL_FORMAT: Readonly<Record<string, RegExp>> = {
	AT: /^U\d{8}$/,
	BE: /^[01]\d{9}$/,
	BG: /^\d{9,10}$/,
	CY: /^\d{8}[A-Z]$/,
	CZ: /^\d{8,10}$/,
	DE: /^\d{9}$/,
	DK: /^\d{8}$/,
	EE: /^\d{9}$/,
	EL: /^\d{9}$/,
	ES: /^[0-9A-Z]\d{7}[0-9A-Z]$/,
	FI: /^\d{8}$/,
	FR: /^[0-9A-Z]{2}\d{9}$/,
	HR: /^\d{11}$/,
	HU: /^\d{8}$/,
	IE: /^[0-9A-Z*+]{8,9}$/,
	IT: /^\d{11}$/,
	LT: /^(\d{9}|\d{12})$/,
	LU: /^\d{8}$/,
	LV: /^\d{11}$/,
	MT: /^\d{8}$/,
	NL: /^\d{9}B\d{2}$/,
	PL: /^\d{10}$/,
	PT: /^\d{9}$/,
	RO: /^\d{2,10}$/,
	SE: /^\d{12}$/,
	SI: /^\d{8}$/,
	SK: /^\d{10}$/,
};

/**
 * The placeholder's example, in the shape of the invoiced company's country (`SK1234567890`, `ATU12345678`, …).
 * Counting digits, never a real number; each one passes `normalizeVatId` for its country (tested).
 */
const VAT_ID_EXAMPLE: Readonly<Record<string, string>> = {
	AT: "ATU12345678",
	BE: "BE0123456789",
	BG: "BG123456789",
	CY: "CY12345678X",
	CZ: "CZ12345678",
	DE: "DE123456789",
	DK: "DK12345678",
	EE: "EE123456789",
	EL: "EL123456789",
	ES: "ESB12345678",
	FI: "FI12345678",
	FR: "FR12345678901",
	HR: "HR12345678901",
	HU: "HU12345678",
	IE: "IE1234567T",
	IT: "IT12345678901",
	LT: "LT123456789",
	LU: "LU12345678",
	LV: "LV12345678901",
	MT: "MT12345678",
	NL: "NL123456789B01",
	PL: "PL1234567890",
	PT: "PT123456789",
	RO: "RO12345678",
	SE: "SE123456789001",
	SI: "SI12345678",
	SK: "SK1234567890",
};

/** An example VAT number for the invoiced company's country, or `null` outside the EU (no example then). */
export function vatIdExample(countryCode: string | null | undefined): string | null {
	const prefix = viesPrefixForCountry(countryCode);
	return prefix ? VAT_ID_EXAMPLE[prefix] ?? null : null;
}

/** Longest normalized VAT number accepted (prefix + national part); every real one is far shorter. */
export const VAT_ID_MAX_LENGTH = 16;

export function viesPrefixForCountry(countryCode: string | null | undefined): string | null {
	if (!countryCode) return null;
	return VIES_PREFIX_BY_COUNTRY[countryCode.toUpperCase()] ?? null;
}

export function countryForViesPrefix(prefix: string | null | undefined): string | null {
	if (!prefix) return null;
	return COUNTRY_BY_VIES_PREFIX[prefix.toUpperCase()] ?? null;
}

/** Upper-case and strip formatting only. Nothing meaningful is removed. */
export function cleanVatIdInput(raw: string): string {
	return raw.toUpperCase().replace(/[\s.\- ]/g, "");
}

function matchesNational(prefix: string, national: string): boolean {
	return NATIONAL_FORMAT[prefix]?.test(national) ?? false;
}

export type NormalizedVatId =
	| { ok: true; vatId: string; prefix: string; national: string; countryCode: string }
	| { ok: false; reason: "empty" | "format" | "unsupported_country"; cleaned: string };

/**
 * The full normalized number and its parts.
 *
 * `selectedCountry` is the explicitly chosen country (the invoiced company's country). It supplies the prefix
 * only when the input carries none:
 * - input begins with the selected country's prefix → kept as typed (no `DEDE…`);
 * - input begins with another member state's prefix AND its rest has that state's shape → that state;
 * - otherwise the selected prefix is added (a French key such as `HU123456789` stays French).
 */
export function normalizeVatId(raw: string, selectedCountry: string | null | undefined): NormalizedVatId {
	const cleaned = cleanVatIdInput(raw ?? "");
	if (!cleaned) return { ok: false, reason: "empty", cleaned };
	if (cleaned.length > VAT_ID_MAX_LENGTH + 2) return { ok: false, reason: "format", cleaned };

	const selectedPrefix = viesPrefixForCountry(selectedCountry);
	const leading = cleaned.slice(0, 2);
	const leadingCountry = /^[A-Z]{2}$/.test(leading) ? countryForViesPrefix(leading) : null;

	let prefix: string | null = null;
	let national = cleaned;

	if (selectedPrefix && leading === selectedPrefix) {
		prefix = selectedPrefix;
		national = cleaned.slice(2);
	} else if (leadingCountry && matchesNational(leading, cleaned.slice(2))) {
		prefix = leading;
		national = cleaned.slice(2);
	} else if (selectedPrefix) {
		prefix = selectedPrefix;
		national = cleaned;
	} else if (leadingCountry) {
		prefix = leading;
		national = cleaned.slice(2);
	}

	if (!prefix) return { ok: false, reason: "unsupported_country", cleaned };
	const vatId = `${prefix}${national}`;
	if (vatId.length > VAT_ID_MAX_LENGTH || !matchesNational(prefix, national)) {
		return { ok: false, reason: "format", cleaned };
	}
	return { ok: true, vatId, prefix, national, countryCode: countryForViesPrefix(prefix)! };
}

/** ISO country of a stored normalized VAT number, or null. Reads the prefix only; does not validate. */
export function countryOfVatId(vatId: string | null | undefined): string | null {
	if (!vatId || vatId.length < 3) return null;
	return countryForViesPrefix(vatId.slice(0, 2));
}

/**
 * The i18n key suffix for the VAT field's name in a country (`checkout.b2b.vatLabel.<key>`). The name follows the
 * invoiced company's country or the prefix the customer typed — never the URL language or the delivery country.
 */
export function vatFieldLabelKey(countryCode: string | null | undefined): string {
	const code = countryCode?.toUpperCase() ?? "";
	return ["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO"].includes(code) ? code : "generic";
}

/** Slovak IČO: digits only (6 historical, 8 current). Spaces are formatting. */
export function normalizeRegistrationId(raw: string): string {
	return (raw ?? "").replace(/[\s ]/g, "");
}

export function isValidSlovakRegistrationId(value: string): boolean {
	return /^\d{6,8}$/.test(value);
}

/** Slovak DIČ: ten digits. Optional. */
export function normalizeTaxId(raw: string): string {
	return (raw ?? "").replace(/[\s ]/g, "").toUpperCase();
}

export function isValidSlovakTaxId(value: string): boolean {
	return /^\d{10}$/.test(value);
}
