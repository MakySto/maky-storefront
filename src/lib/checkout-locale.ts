import { DEFAULT_LOCALE, getLocaleConfigByLocale, getLocaleFromChannel, LOCALE_MAP } from "@/config/locale";
import type { LanguageCodeEnum } from "@/gql/graphql";

/**
 * Checkout locale resolution (krok 2 — central market config).
 *
 * The checkout lives at `/checkout` with no `[channel]` URL segment, so its locale is NOT
 * resolved from the URL: the single source of truth is the checkout's (or order's) channel slug,
 * mapped through `CHANNEL_MAP`/`LOCALE_MAP` (channel slug → storefront locale → Saleor
 * `LanguageCodeEnum` → Stripe Elements locale → currency). The former static-`sk` behaviour
 * remains only as the fallback for an unknown/missing channel.
 *
 * Note: callers must NOT thread the result into `buildCheckoutPath({ browseLocale })` —
 * variant C keeps `/checkout?checkout=<id>` free of `?locale=` (see `@/session-bridge`).
 */

/** Storefront locale (LOCALE_MAP key) for a checkout/order, from its channel slug. */
export function resolveCheckoutLocale(channelSlug: string | null | undefined): string {
	return channelSlug ? getLocaleFromChannel(channelSlug) : DEFAULT_LOCALE;
}

/** Explicit, already-known locale slug when valid, otherwise the store default. */
export function resolveBrowseLocaleForCheckout(localeSlug?: string | null): string {
	return localeSlug && LOCALE_MAP[localeSlug] ? localeSlug : DEFAULT_LOCALE;
}

/**
 * Saleor `languageCode` GraphQL variables for checkout reads/mutations.
 *
 * Pass a locale resolved via `resolveCheckoutLocale(channelSlug)`; without one this falls back
 * to the store default (`sk-SK` → `LanguageCodeEnum.Sk`).
 */
export function checkoutGraphqlLocaleVariables(localeSlug?: string | null): {
	languageCode: LanguageCodeEnum;
} {
	const config = getLocaleConfigByLocale(localeSlug ?? DEFAULT_LOCALE);
	return { languageCode: config.graphqlLanguageCode };
}

/** Saleor `LanguageCodeEnum` a checkout in the given channel is expected to carry. */
export function expectedCheckoutLanguageCode(channelSlug: string | null | undefined): LanguageCodeEnum {
	return getLocaleConfigByLocale(resolveCheckoutLocale(channelSlug)).graphqlLanguageCode;
}
