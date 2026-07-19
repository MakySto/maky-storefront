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
