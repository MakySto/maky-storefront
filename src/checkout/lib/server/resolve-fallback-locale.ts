import "server-only";

import { cookies } from "next/headers";

import { CHANNEL_MAP, COOKIE_NAME as MARKET_COOKIE_NAME } from "@/lib/channel-map";
import { resolveBrowseLocaleForCheckout } from "@/lib/checkout-locale";

/**
 * Locale for checkout/confirmation states with no known channel yet (first fetch, not-found,
 * error): an explicit valid `?locale=` wins, then the visitor's `maky-market` cookie, then the
 * store default. Once the checkout/order channel is known, the channel-derived locale replaces
 * this (see the RSC loaders).
 */
export async function resolveFallbackLocale(explicitLocale?: string | null): Promise<string> {
	if (explicitLocale) {
		return resolveBrowseLocaleForCheckout(explicitLocale);
	}
	try {
		const market = (await cookies()).get(MARKET_COOKIE_NAME)?.value;
		if (market && CHANNEL_MAP[market]) {
			return CHANNEL_MAP[market].locale;
		}
	} catch {
		// static context — fall through
	}
	return resolveBrowseLocaleForCheckout(null);
}
