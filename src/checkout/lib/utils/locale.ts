import { type CountryCode } from "@/checkout/graphql";
import { DEFAULT_LOCALE } from "@/config/locale";

export const getCurrentHref = () => location.href;

// Country names follow the active market locale (central market config, krok 2). Client
// components read the locale from `useLocale()` (LocaleProvider, mounted by the checkout RSC
// loaders) and pass it in; the default keeps un-migrated/server call-sites on the store default.
const displayNamesByLocale = new Map<string, Intl.DisplayNames>();

function regionNames(locale: string): Intl.DisplayNames {
	let names = displayNamesByLocale.get(locale);
	if (!names) {
		try {
			names = new Intl.DisplayNames(locale, { type: "region" });
		} catch {
			names = new Intl.DisplayNames(DEFAULT_LOCALE, { type: "region" });
		}
		displayNamesByLocale.set(locale, names);
	}
	return names;
}

export const getCountryName = (countryCode: CountryCode, locale: string = DEFAULT_LOCALE): string =>
	regionNames(locale).of(countryCode) || countryCode;

/**
 * The options of a country dropdown: each country under its name in the market's language, in
 * that language's alphabetical order.
 *
 * The four dropdowns of the checkout listed the countries in the order Saleor returns them, which
 * is by ISO code: in German "Österreich" (AT) stood first, above "Belgien" (BE), and "Spanien" (ES)
 * above "Finnland" (FI). The codes are not on the screen, so the list read as unordered (audit of
 * the live store, 2026-11-27).
 */
export function countryOptions<Code extends CountryCode>(
	codes: readonly Code[],
	locale: string = DEFAULT_LOCALE,
): Array<{ value: Code; label: string }> {
	let collator: Intl.Collator;
	try {
		collator = new Intl.Collator(locale);
	} catch {
		collator = new Intl.Collator(DEFAULT_LOCALE);
	}
	return codes
		.map((code) => ({ value: code, label: getCountryName(code, locale) }))
		.sort((a, b) => collator.compare(a.label, b.label) || a.value.localeCompare(b.value));
}

/** Localized country name for an address; falls back to the Saleor-provided name. */
export const localizeCountryName = (
	countryCode: string | null | undefined,
	fallback: string | null | undefined,
	locale: string = DEFAULT_LOCALE,
): string => {
	if (countryCode) {
		try {
			const localized = regionNames(locale).of(countryCode);
			if (localized) return localized;
		} catch {
			// unknown region code — fall through
		}
	}
	return fallback || "";
};
