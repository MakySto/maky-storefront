"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LOCALE_MAP, DEFAULT_LOCALE, type LocaleConfig } from "@/config/locale";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type LocaleContextValue = LocaleConfig & {
	/** BCP 47 locale string, e.g. "sk-SK" */
	locale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — wrap in a Server Component that reads x-locale header
// ---------------------------------------------------------------------------

export function LocaleProvider({
	locale,
	children,
}: {
	locale: string;
	children: ReactNode;
}) {
	const config = LOCALE_MAP[locale] || LOCALE_MAP[DEFAULT_LOCALE];
	const value: LocaleContextValue = { ...config, locale: config.locale };

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook — use in any Client Component
// ---------------------------------------------------------------------------

/**
 * Access locale config in Client Components.
 *
 * @example
 * const { locale, graphqlLanguageCode, fallbackCurrency } = useLocale();
 * const price = formatPrice(amount, currency, locale);
 */
export function useLocale(): LocaleContextValue {
	const ctx = useContext(LocaleContext);
	if (!ctx) {
		// Fallback for components rendered outside provider (shouldn't happen in normal flow)
		const fallback = LOCALE_MAP[DEFAULT_LOCALE];
		return { ...fallback, locale: fallback.locale };
	}
	return ctx;
}