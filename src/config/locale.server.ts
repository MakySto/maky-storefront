/**
 * Server-only locale helpers — reads x-locale header from proxy.ts.
 *
 * ⚠️ ONLY import this in Server Components and Route Handlers.
 * For Client Components, use useLocale() from "@/providers/locale-provider".
 */

import "server-only";
import { headers } from "next/headers";
import { LOCALE_MAP, DEFAULT_LOCALE, type LocaleConfig } from "@/config/locale";
import { CHANNEL_MAP, FRIENDLY_SLUGS } from "@/lib/channel-map";

/**
 * The market of a request that did not pass through `proxy.ts`, read from where the browser says it came from.
 *
 * A server action skips the proxy (its matcher excludes `Next-Action` requests, see `proxy.ts`), and the proxy is
 * what sets `x-market` and `x-locale`. The page that sent the action is the one the shopper is looking at, and its
 * public address starts with the market (`/de/warenkorb`), so the first segment of `Referer` - or of `Next-Url`,
 * which Next's own client sends with every action - says which market the refreshed page is rendered for.
 * Only a display preference is derived from it, never anything a shopper could use to reach data that is not theirs.
 */
function marketFromRequest(h: Headers): string | null {
	for (const name of ["referer", "next-url"]) {
		const value = h.get(name);
		if (!value) continue;
		let pathname: string;
		try {
			const url = new URL(value, "https://maky.store");
			// A referer from another site says nothing about this shopper's market.
			const host = h.get("x-forwarded-host") ?? h.get("host");
			if (name === "referer" && host && url.host !== host) continue;
			pathname = url.pathname;
		} catch {
			continue;
		}
		const first = pathname.split("/").filter(Boolean)[0];
		if (first && FRIENDLY_SLUGS.has(first)) return first;
	}
	return null;
}

/**
 * Get the current locale from the x-locale request header.
 * Returns DEFAULT_LOCALE during static generation or when header is missing.
 */
export async function getLocale(): Promise<string> {
	try {
		const h = await headers();
		const fromProxy = h.get("x-locale");
		if (fromProxy) return fromProxy;
		const market = marketFromRequest(h);
		return (market && CHANNEL_MAP[market]?.locale) || DEFAULT_LOCALE;
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
		return h.get("x-market") || marketFromRequest(h) || "sk";
	} catch {
		return "sk";
	}
}
