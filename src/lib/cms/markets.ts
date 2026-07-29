import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";

/**
 * Market and locale mapping between the storefront and Payload.
 *
 * Payload's market union is the twelve ISO country codes, which line up 1:1 with
 * the `country` field of `CHANNEL_MAP` — so the storefront registry stays the
 * single source of truth and this module only translates.
 *
 * Locales do NOT line up: the storefront carries twelve message catalogues (one
 * per market) while Payload has ten (AT and DE share `de`, US and CA share `en`).
 * That collapse is what {@link payloadLocaleForMarket} encodes. Hardcoding
 * `locale=sk` at the call site would work for the pilot and break silently at the
 * second market, so the mapping lives here from the start.
 */

/** Payload's `markets` union — ISO 3166-1 alpha-2, matching `CHANNEL_MAP[*].country`. */
export type MarketCode = "SK" | "CZ" | "PL" | "HU" | "RO" | "AT" | "DE" | "IT" | "FR" | "ES" | "US" | "CA";

/** Payload's `locale` union — ten languages for twelve markets. */
export type PayloadLocale = "sk" | "cs" | "pl" | "hu" | "ro" | "de" | "it" | "fr" | "es" | "en";

const MARKET_TO_PAYLOAD_LOCALE: Record<MarketCode, PayloadLocale> = {
	SK: "sk",
	CZ: "cs",
	PL: "pl",
	HU: "hu",
	RO: "ro",
	AT: "de",
	DE: "de",
	IT: "it",
	FR: "fr",
	ES: "es",
	US: "en",
	CA: "en",
};

const MARKET_CODES = new Set<string>(Object.keys(MARKET_TO_PAYLOAD_LOCALE));

export function isMarketCode(value: unknown): value is MarketCode {
	return typeof value === "string" && MARKET_CODES.has(value);
}

/**
 * Market code for a route's `[channel]` param.
 *
 * The param is the *Saleor* slug at runtime (`sk-eur`), because `src/proxy.ts`
 * rewrites `/sk/...` to `/sk-eur/...`. Friendly slugs are accepted too so callers
 * do not have to care which side of the rewrite they are on.
 */
export function marketForChannel(channel: string): MarketCode | null {
	const friendly = CHANNEL_MAP[channel] ? channel : REVERSE_MAP[channel];
	const config = friendly ? CHANNEL_MAP[friendly] : undefined;
	return config && isMarketCode(config.country) ? config.country : null;
}

export function payloadLocaleForMarket(market: MarketCode): PayloadLocale {
	return MARKET_TO_PAYLOAD_LOCALE[market];
}

/** Convenience: `[channel]` param straight to a Payload locale. */
export function payloadLocaleForChannel(channel: string): PayloadLocale | null {
	const market = marketForChannel(channel);
	return market ? payloadLocaleForMarket(market) : null;
}

/**
 * Editorial visibility filter, applied to both a page and each of its blocks.
 *
 * `null` and `[]` both mean "all markets" — that is Payload's documented
 * convention and the admin UI produces both. A non-empty list is a restriction.
 *
 * An unresolvable market hides restricted content rather than showing it: the
 * only way to get here with a null market is an invalid channel, which the proxy
 * already 404s, so failing closed cannot hide content from a real visitor.
 */
export function isVisibleInMarket(
	markets: readonly string[] | null | undefined,
	market: MarketCode | null,
): boolean {
	if (!markets || markets.length === 0) return true;
	if (!market) return false;
	return markets.includes(market);
}
