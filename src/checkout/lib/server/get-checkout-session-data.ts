import "server-only";

import { cache } from "react";

import { fetchChannelCountriesOnServer } from "@/checkout/lib/server/fetch-channel-countries";
import { fetchCheckoutOnServer } from "@/checkout/lib/server/fetch-checkout";
import { fetchCheckoutUserOnServer } from "@/checkout/lib/server/fetch-checkout-user";

/**
 * Per-request cached checkout session fetches, keyed by checkout id / channel (not `?step=`).
 * If the checkout RSC re-runs within a request, duplicate work is deduped by `React.cache`.
 */
export const getCheckoutSessionUser = cache(() => fetchCheckoutUserOnServer());

export const getCheckoutSessionCheckout = cache((checkoutId: string, localeSlug: string) =>
	fetchCheckoutOnServer(checkoutId, localeSlug),
);

export const getCheckoutSessionCountries = cache((channelSlug: string) =>
	fetchChannelCountriesOnServer(channelSlug),
);
