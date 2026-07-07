import { DEFAULT_LOCALE, getLocaleConfigByLocale, LOCALE_MAP, localeConfig } from "@/config/locale";
import type { LanguageCodeEnum } from "@/gql/graphql";

/**
 * Browse locale for the checkout surface (variant C).
 *
 * MAKY has no `[locale]` URL segment and no browse-locale cookie (unlike upstream's
 * `/{locale}/{channel}` model), so the checkout locale is NOT resolved from the URL.
 * It honours an explicit, already-known locale slug when one is passed (a `LOCALE_MAP`
 * key such as `"sk-SK"`), otherwise falls back to the default (`sk-SK`) — matching the
 * legacy checkout, which always queried with `localeConfig.graphqlLanguageCode`.
 *
 * Note: callers must NOT thread the result into `buildCheckoutPath({ browseLocale })` —
 * variant C keeps `/checkout?checkout=<id>` free of `?locale=` (see `@/session-bridge`).
 */
export function resolveBrowseLocaleForCheckout(localeSlug?: string | null): string {
	return localeSlug && LOCALE_MAP[localeSlug] ? localeSlug : DEFAULT_LOCALE;
}

/**
 * Saleor `languageCode` GraphQL variables for checkout reads/mutations.
 *
 * Defaults to the store default (`sk-SK` → `LanguageCodeEnum.Sk`) unless an explicit
 * `LOCALE_MAP` key is passed. Preserves the legacy checkout's static-`sk` behaviour;
 * per-channel checkout translation is a future enhancement (see known-issues), not B.4.2.
 */
export function checkoutGraphqlLocaleVariables(localeSlug?: string | null): {
	languageCode: LanguageCodeEnum;
} {
	const config = localeSlug ? getLocaleConfigByLocale(localeSlug) : undefined;
	return { languageCode: config?.graphqlLanguageCode ?? localeConfig.graphqlLanguageCode };
}
