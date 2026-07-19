import { type CountryCode } from "@/checkout/graphql";

export const getCurrentHref = () => location.href;

// Static-sk checkout (B.7) — country names render Slovak ("Slovensko", not "Slovakia").
// The locale becomes market-driven with the central market config (krok 2).
const countryNames = new Intl.DisplayNames("sk", {
	type: "region",
});
export const getCountryName = (countryCode: CountryCode): string =>
	countryNames.of(countryCode) || countryCode;

/** Slovak country name for an address; falls back to the Saleor-provided (EN) name. */
export const localizeCountryName = (
	countryCode: string | null | undefined,
	fallback: string | null | undefined,
): string => {
	if (countryCode) {
		try {
			const localized = countryNames.of(countryCode);
			if (localized) return localized;
		} catch {
			// unknown region code — fall through
		}
	}
	return fallback || "";
};
