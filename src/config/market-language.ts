/**
 * Market → the Saleor language code it reads, as plain strings.
 *
 * The same matrix as `LOCALE_MAP[...].graphqlLanguageCode` (exact-locale contract v2), written
 * once more here for ONE reason: the proxy needs it, and `config/locale.ts` imports
 * `LanguageCodeEnum` from `@/gql/graphql` — a module whose generated documents would land in
 * the middleware bundle, which runs before every request. `src/lib/saleor/exact-locale.contract.test.ts`
 * asserts this table against `LOCALE_MAP` and against the published contract, so it cannot drift:
 * change the language a market reads in `config/locale.ts` and the test fails here.
 *
 * Slovakia is absent on purpose. It reads the base row, never a translation.
 */
export const MARKET_LANGUAGE_CODE: Readonly<Record<string, string>> = {
	cz: "CS",
	de: "DE",
	at: "DE_AT",
	pl: "PL",
	hu: "HU",
	it: "IT",
	fr: "FR",
	es: "ES",
	ro: "RO",
	us: "EN",
	ca: "EN_CA",
};

/** The language a market reads, or undefined for Slovakia and anything that is not a market. */
export function marketLanguageCode(market: string): string | undefined {
	return MARKET_LANGUAGE_CODE[market];
}
