/**
 * The line of an address that holds the town and the postal code, in the order the address's own
 * country writes it.
 *
 * Every address in the checkout and the account used to print "town postcode", the North American
 * order, for all markets: a German customer read "Berlin 10115" and a Slovak one "Žilina 010 01"
 * on the page where they confirm where the parcel goes (audit of the live store, 2026-11-27).
 * Continental Europe, which is ten of the twelve markets, writes the postal code first.
 *
 * The country that decides is the ADDRESS's, not the market's: a Slovak shop page showing a
 * Canadian address still writes it the Canadian way, as the label on the parcel will.
 */

/** Countries that write the town before the postal code. Everything else is postcode first. */
const TOWN_BEFORE_POSTCODE: ReadonlySet<string> = new Set(["US", "CA", "GB", "IE", "AU", "NZ"]);

export interface CityLineAddress {
	readonly city?: string | null;
	readonly postalCode?: string | null;
	/** State, province or region, where the country's form asks for one. */
	readonly countryArea?: string | null;
	readonly country?: { readonly code?: string | null } | null;
}

const clean = (value: string | null | undefined): string => value?.trim() ?? "";

/**
 * "010 01 Žilina", "10115 Berlin", "20121 Milano, MI"; "Toronto, ON M5V 2T6", "Austin, TX 78701".
 *
 * Missing parts are left out without leaving their separators behind, and an address with no
 * country is written postcode first, the order of the store's home market.
 */
export function cityLine(address: CityLineAddress | null | undefined): string {
	if (!address) return "";
	const city = clean(address.city);
	const postalCode = clean(address.postalCode);
	const area = clean(address.countryArea);
	const code = clean(address.country?.code).toUpperCase();

	if (TOWN_BEFORE_POSTCODE.has(code)) {
		return [[city, area].filter(Boolean).join(", "), postalCode].filter(Boolean).join(" ");
	}
	return [[postalCode, city].filter(Boolean).join(" "), area].filter(Boolean).join(", ");
}
