import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { invariant } from "ts-invariant";

import { CheckoutApp } from "@/checkout/checkout-app";
import type { CheckoutLoadState, ServerCheckout, ShippingCountries } from "@/checkout/lib/checkout-types";
import { updateCheckoutLanguageOnServer } from "@/checkout/lib/server/fetch-checkout";
import {
	getCheckoutSessionCheckout,
	getCheckoutSessionCountries,
	getCheckoutSessionUser,
} from "@/checkout/lib/server/get-checkout-session-data";
import { resolveFallbackLocale } from "@/checkout/lib/server/resolve-fallback-locale";
import * as Checkout from "@/lib/checkout";
import { expectedCheckoutLanguageCode, resolveCheckoutLocale } from "@/lib/checkout-locale";
import { LocaleProvider } from "@/providers/locale-provider";
import { buildCheckoutPath, buildOrderConfirmationPath } from "@/session-bridge";

/** Server-visible checkout URL params. `step` is client-only (shallow `?step=`, resolved in views). */
export type CheckoutPageSearchParams = {
	checkout?: string;
	order?: string;
	locale?: string;
};

type CheckoutSessionLoaderProps = {
	searchParams: Promise<CheckoutPageSearchParams>;
};

/**
 * RSC entry for the active checkout — fetches the checkout session server-side from `?checkout=`
 * and hands materialised props to the client `<CheckoutApp>` (no browser-side urql). Variant C:
 * checkout lives at `/checkout` outside `[channel]`; the channel is derived from
 * `checkout.channel.slug`, not the URL.
 *
 * Locale (krok 2 — central market config): the checkout's channel decides the locale. The first
 * fetch runs with the fallback locale (market cookie / default); when the channel-derived locale
 * differs, the checkout is refetched with the market's `languageCode` — and when the checkout
 * entity itself carries a stale `languageCode` (created before checkoutCreate set it, or after a
 * market switch), it is healed server-side via `checkoutLanguageCodeUpdate`, whose payload doubles
 * as the authoritative refetch. The resolved locale then drives next-intl for the whole subtree
 * (overriding the root default, since `/checkout` has no `[channel]` URL segment).
 */
export async function CheckoutSessionLoader({
	searchParams: searchParamsPromise,
}: CheckoutSessionLoaderProps) {
	const searchParams = await searchParamsPromise;
	invariant(process.env.NEXT_PUBLIC_SALEOR_API_URL, "Missing NEXT_PUBLIC_SALEOR_API_URL env variable");

	const orderId = searchParams.order ?? null;
	const checkoutIdFromUrl = searchParams.checkout ?? null;
	const fallbackLocale = await resolveFallbackLocale(searchParams.locale);

	if (orderId) {
		// Order confirmation lives on its own route (/checkout/complete).
		redirect(buildOrderConfirmationPath({ orderId }));
	}

	if (!checkoutIdFromUrl) {
		const checkoutIdFromCartCookie = await Checkout.getFirstCheckoutIdFromCartCookies();
		if (checkoutIdFromCartCookie) {
			redirect(buildCheckoutPath({ checkoutId: checkoutIdFromCartCookie }));
		}
	}

	const [initialUser, firstFetch] = await Promise.all([
		getCheckoutSessionUser(),
		checkoutIdFromUrl ? getCheckoutSessionCheckout(checkoutIdFromUrl, fallbackLocale) : Promise.resolve(null),
	]);

	let checkoutResult = firstFetch;
	let locale = fallbackLocale;
	let loadState: CheckoutLoadState = "none";
	let channelSlug: string | null = null;
	let initialCheckout: ServerCheckout | null = null;
	let shippingCountries: ShippingCountries = [];

	if (checkoutIdFromUrl && checkoutResult?.ok && checkoutResult.checkout) {
		channelSlug = checkoutResult.checkout.channel.slug;
		const channelLocale = resolveCheckoutLocale(channelSlug);
		const expectedLanguage = expectedCheckoutLanguageCode(channelSlug);

		if (String(checkoutResult.checkout.languageCode) !== String(expectedLanguage)) {
			// Heal the entity language; the mutation payload is the correctly-translated checkout.
			const healed = await updateCheckoutLanguageOnServer(checkoutIdFromUrl, channelLocale);
			if (healed.ok && healed.checkout) {
				checkoutResult = healed;
			}
		} else if (channelLocale !== locale) {
			// Entity language is right, but the first fetch translated with the fallback locale.
			const refetched = await getCheckoutSessionCheckout(checkoutIdFromUrl, channelLocale);
			if (refetched.ok && refetched.checkout) {
				checkoutResult = refetched;
			}
		}
		locale = channelLocale;
	}

	if (!checkoutIdFromUrl) {
		loadState = "none";
	} else if (!checkoutResult || !checkoutResult.ok) {
		loadState = "error";
	} else if (!checkoutResult.checkout) {
		loadState = "not_found";
		await Checkout.clearCheckoutCookieByValue(checkoutIdFromUrl);
	} else {
		const checkoutIdFromChannelCookie = channelSlug ? await Checkout.getIdFromCookies(channelSlug) : null;

		if (checkoutIdFromChannelCookie && checkoutIdFromChannelCookie !== checkoutIdFromUrl) {
			redirect(buildCheckoutPath({ checkoutId: checkoutIdFromChannelCookie }));
		}

		if (!checkoutResult.checkout.lines.length) {
			loadState = "empty";
		} else {
			loadState = "ready";
			initialCheckout = checkoutResult.checkout;
		}
	}

	if (channelSlug) {
		shippingCountries = await getCheckoutSessionCountries(channelSlug);
	}

	setRequestLocale(locale);
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<LocaleProvider locale={locale}>
				<CheckoutApp
					checkoutId={checkoutIdFromUrl}
					loadState={loadState}
					initialCheckout={initialCheckout}
					initialUser={initialUser}
					shippingCountries={shippingCountries}
				/>
			</LocaleProvider>
		</NextIntlClientProvider>
	);
}
