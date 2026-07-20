/**
 * Locale configuration for MAKY.STORE — 13 markets.
 *
 * This module is PURE (no server-only imports like next/headers).
 * Safe to import from both Client and Server Components.
 *
 * For server-side locale detection (reading x-locale header), use:
 *   import { getLocale, getLocaleConfig } from "@/config/locale.server";
 *
 * For client-side locale access, use:
 *   import { useLocale } from "@/providers/locale-provider";
 */

import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { LanguageCodeEnum } from "@/gql/graphql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LocaleConfig = {
	/** BCP 47 locale for Intl APIs (number/date formatting) */
	locale: string;
	/** HTML lang attribute (2-letter) */
	htmlLang: string;
	/** Saleor LanguageCodeEnum value */
	graphqlLanguageCode: LanguageCodeEnum;
	/** Open Graph locale format */
	ogLocale: string;
	/** Fallback currency if API returns null */
	fallbackCurrency: string;
	/**
	 * Explicit Stripe Elements locale (subset of Stripe's supported locales).
	 * Never "auto" — the market decides, not the browser.
	 */
	stripeLocale: StripeSupportedLocale;
};

/** Stripe Elements locales used by MAKY markets (subset of Stripe's supported list). */
export type StripeSupportedLocale = "sk" | "cs" | "de" | "pl" | "hu" | "it" | "fr" | "es" | "ro" | "en";

// ---------------------------------------------------------------------------
// Locale map — all 13 markets
// ---------------------------------------------------------------------------

export const LOCALE_MAP: Record<string, LocaleConfig> = {
	"sk-SK": {
		locale: "sk-SK",
		htmlLang: "sk",
		graphqlLanguageCode: LanguageCodeEnum.Sk,
		ogLocale: "sk_SK",
		fallbackCurrency: "EUR",
		stripeLocale: "sk",
	},
	"cs-CZ": {
		locale: "cs-CZ",
		htmlLang: "cs",
		graphqlLanguageCode: LanguageCodeEnum.Cs,
		ogLocale: "cs_CZ",
		fallbackCurrency: "CZK",
		stripeLocale: "cs",
	},
	"de-DE": {
		locale: "de-DE",
		htmlLang: "de",
		graphqlLanguageCode: LanguageCodeEnum.De,
		ogLocale: "de_DE",
		fallbackCurrency: "EUR",
		stripeLocale: "de",
	},
	"de-AT": {
		locale: "de-AT",
		htmlLang: "de",
		graphqlLanguageCode: LanguageCodeEnum.De,
		ogLocale: "de_AT",
		fallbackCurrency: "EUR",
		stripeLocale: "de",
	},
	"pl-PL": {
		locale: "pl-PL",
		htmlLang: "pl",
		graphqlLanguageCode: LanguageCodeEnum.Pl,
		ogLocale: "pl_PL",
		fallbackCurrency: "PLN",
		stripeLocale: "pl",
	},
	"hu-HU": {
		locale: "hu-HU",
		htmlLang: "hu",
		graphqlLanguageCode: LanguageCodeEnum.Hu,
		ogLocale: "hu_HU",
		fallbackCurrency: "HUF",
		stripeLocale: "hu",
	},
	"it-IT": {
		locale: "it-IT",
		htmlLang: "it",
		graphqlLanguageCode: LanguageCodeEnum.It,
		ogLocale: "it_IT",
		fallbackCurrency: "EUR",
		stripeLocale: "it",
	},
	"fr-FR": {
		locale: "fr-FR",
		htmlLang: "fr",
		graphqlLanguageCode: LanguageCodeEnum.Fr,
		ogLocale: "fr_FR",
		fallbackCurrency: "EUR",
		stripeLocale: "fr",
	},
	"es-ES": {
		locale: "es-ES",
		htmlLang: "es",
		graphqlLanguageCode: LanguageCodeEnum.Es,
		ogLocale: "es_ES",
		fallbackCurrency: "EUR",
		stripeLocale: "es",
	},
	"ro-RO": {
		locale: "ro-RO",
		htmlLang: "ro",
		graphqlLanguageCode: LanguageCodeEnum.Ro,
		ogLocale: "ro_RO",
		fallbackCurrency: "RON",
		stripeLocale: "ro",
	},
	"en-US": {
		locale: "en-US",
		htmlLang: "en",
		graphqlLanguageCode: LanguageCodeEnum.EnUs,
		ogLocale: "en_US",
		fallbackCurrency: "USD",
		stripeLocale: "en",
	},
	"en-CA": {
		locale: "en-CA",
		htmlLang: "en",
		graphqlLanguageCode: LanguageCodeEnum.EnCa,
		ogLocale: "en_CA",
		fallbackCurrency: "CAD",
		stripeLocale: "en",
	},
};

/** Default locale used when no header is present (SSG, build time) */
export const DEFAULT_LOCALE = "sk-SK";

// ---------------------------------------------------------------------------
// Pure helpers (no server imports — safe everywhere)
// ---------------------------------------------------------------------------

/**
 * Get locale config by explicit locale string.
 * Use when you already have the locale (from props, context, or channel-map).
 */
export function getLocaleConfigByLocale(locale: string): LocaleConfig {
	return LOCALE_MAP[locale] || LOCALE_MAP[DEFAULT_LOCALE];
}

/**
 * Derive locale from a Saleor channel slug.
 */
export function getLocaleFromChannel(channelSlug: string): string {
	const market = REVERSE_MAP[channelSlug];
	if (market && CHANNEL_MAP[market]) {
		return CHANNEL_MAP[market].locale;
	}
	return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Formatting functions — accept explicit locale, default to sk-SK
// ---------------------------------------------------------------------------

/**
 * Format a price. Pass locale from useLocale() or getLocale().
 *
 * Examples:
 *   formatPrice(149.9, "EUR", "sk-SK") → "149,90 €"
 *   formatPrice(149.9, "EUR", "de-DE") → "149,90 €"
 *   formatPrice(3490, "CZK", "cs-CZ")  → "3 490,00 Kč"
 *   formatPrice(62990, "HUF", "hu-HU") → "62 990 Ft"
 */
export function formatPrice(amount: number, currency: string, locale: string = DEFAULT_LOCALE): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
		maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
	}).format(amount);
}

/**
 * Format a date.
 */
export function formatDate(
	date: Date | number,
	locale: string = DEFAULT_LOCALE,
	options?: Intl.DateTimeFormatOptions,
): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		...options,
	}).format(date);
}

/**
 * Format a number.
 */
export function formatNumber(
	value: number,
	locale: string = DEFAULT_LOCALE,
	options?: Intl.NumberFormatOptions,
): string {
	return new Intl.NumberFormat(locale, options).format(value);
}

// ---------------------------------------------------------------------------
// Backward compatibility — keeps existing 20+ imports working
// ---------------------------------------------------------------------------

/**
 * @deprecated Use useLocale() in Client Components or getLocaleConfig()
 * from "@/config/locale.server" in Server Components.
 *
 * This static export uses DEFAULT_LOCALE (sk-SK). All existing checkout,
 * cart, and search components continue to work — they just format as sk-SK
 * instead of en-US (which is actually correct for the primary market).
 *
 * Migration priority:
 *  - Root layout: ✅ migrated to async getLocaleConfig()
 *  - Product cards, cart, PLP: migrate to useLocale() next
 *  - Checkout: migrate later (functional with sk-SK default)
 */
const _default = LOCALE_MAP[DEFAULT_LOCALE];
export const localeConfig = {
	default: DEFAULT_LOCALE,
	graphqlLanguageCode: _default.graphqlLanguageCode,
	htmlLang: _default.htmlLang,
	ogLocale: _default.ogLocale,
	fallbackCurrency: _default.fallbackCurrency,
	available: Object.keys(LOCALE_MAP),
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isZeroDecimalCurrency(currency: string): boolean {
	return ["HUF", "JPY", "KRW", "VND", "CLP"].includes(currency.toUpperCase());
}
