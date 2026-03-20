/**
 * Channel mapping: friendly URL prefix -> Saleor channel slug + metadata.
 * This is the single source of truth for market routing.
 */
type ChannelConfig = {
  saleorSlug: string;
  currency: string;
  locale: string;
  country: string;
};

export const CHANNEL_MAP: Record<string, ChannelConfig> = {
  sk: { saleorSlug: "sk-eur", currency: "EUR", locale: "sk-SK", country: "SK" },
  cz: { saleorSlug: "cz-czk", currency: "CZK", locale: "cs-CZ", country: "CZ" },
  de: { saleorSlug: "de-eur", currency: "EUR", locale: "de-DE", country: "DE" },
  at: { saleorSlug: "at-eur", currency: "EUR", locale: "de-AT", country: "AT" },
  pl: { saleorSlug: "pl-pln", currency: "PLN", locale: "pl-PL", country: "PL" },
  hu: { saleorSlug: "hu-huf", currency: "HUF", locale: "hu-HU", country: "HU" },
  it: { saleorSlug: "it-eur", currency: "EUR", locale: "it-IT", country: "IT" },
  fr: { saleorSlug: "fr-eur", currency: "EUR", locale: "fr-FR", country: "FR" },
  es: { saleorSlug: "es-eur", currency: "EUR", locale: "es-ES", country: "ES" },
  ro: { saleorSlug: "ro-ron", currency: "RON", locale: "ro-RO", country: "RO" },
  gb: { saleorSlug: "gb-gbp", currency: "GBP", locale: "en-GB", country: "GB" },
  us: { saleorSlug: "us-usd", currency: "USD", locale: "en-US", country: "US" },
  ca: { saleorSlug: "ca-cad", currency: "CAD", locale: "en-CA", country: "CA" },
};

export const FRIENDLY_SLUGS = new Set(Object.keys(CHANNEL_MAP));

export const SALEOR_SLUGS = new Set(Object.values(CHANNEL_MAP).map((c) => c.saleorSlug));

export const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_MAP).map(([friendly, config]) => [config.saleorSlug, friendly]),
);

export const COUNTRY_TO_MARKET: Record<string, string> = {
  SK: "sk", CZ: "cz", DE: "de", AT: "at", PL: "pl",
  HU: "hu", IT: "it", FR: "fr", ES: "es", RO: "ro",
  GB: "gb", US: "us", CA: "ca",
};

export const DEFAULT_MARKET = "sk";
export const COOKIE_NAME = "maky-market";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
