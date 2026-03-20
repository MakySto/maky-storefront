/**
 * Server-only locale helpers — reads x-locale header from proxy.ts.
 *
 * ⚠️ ONLY import this in Server Components and Route Handlers.
 * For Client Components, use useLocale() from "@/providers/locale-provider".
 */

import "server-only";
import { headers } from "next/headers";
import { LOCALE_MAP, DEFAULT_LOCALE, type LocaleConfig } from "@/config/locale";

/**
 * Get the current locale from the x-locale request header.
 * Returns DEFAULT_LOCALE during static generation or when header is missing.
 */
export async function getLocale(): Promise<string> {
	try {
		const h = await headers();
		return h.get("x-locale") || DEFAULT_LOCALE;
	} catch {
		// headers() throws during static generation — that's OK
		return DEFAULT_LOCALE;
	}
}

/**
 * Get the full locale config for the current request.
 */
export async function getLocaleConfig(): Promise<LocaleConfig> {
	const locale = await getLocale();
	return LOCALE_MAP[locale] || LOCALE_MAP[DEFAULT_LOCALE];
}

/**
 * Get the current market slug from the x-market request header.
 */
export async function getMarket(): Promise<string> {
	try {
		const h = await headers();
		return h.get("x-market") || "sk";
	} catch {
		return "sk";
	}
}