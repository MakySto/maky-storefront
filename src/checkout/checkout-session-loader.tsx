import { redirect } from "next/navigation";
import { invariant } from "ts-invariant";

import { CheckoutApp } from "@/checkout/checkout-app";
import type { CheckoutLoadState, ServerCheckout, ShippingCountries } from "@/checkout/lib/checkout-types";
import {
	getCheckoutSessionCheckout,
	getCheckoutSessionCountries,
	getCheckoutSessionUser,
} from "@/checkout/lib/server/get-checkout-session-data";
import * as Checkout from "@/lib/checkout";
import { resolveBrowseLocaleForCheckout } from "@/lib/checkout-locale";
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
 */
export async function CheckoutSessionLoader({
	searchParams: searchParamsPromise,
}: CheckoutSessionLoaderProps) {
	const searchParams = await searchParamsPromise;
	invariant(process.env.NEXT_PUBLIC_SALEOR_API_URL, "Missing NEXT_PUBLIC_SALEOR_API_URL env variable");

	const orderId = searchParams.order ?? null;
	const checkoutIdFromUrl = searchParams.checkout ?? null;
	// Static-sk in variant C; NOT threaded into buildCheckoutPath (no `?locale=` on /checkout).
	const browseLocale = resolveBrowseLocaleForCheckout(searchParams.locale);

	if (orderId) {
		// Order confirmation route (/checkout/complete) lands in B.4.3; unreachable until payment (B.8).
		redirect(buildOrderConfirmationPath({ orderId }));
	}

	if (!checkoutIdFromUrl) {
		const checkoutIdFromCartCookie = await Checkout.getFirstCheckoutIdFromCartCookies();
		if (checkoutIdFromCartCookie) {
			redirect(buildCheckoutPath({ checkoutId: checkoutIdFromCartCookie }));
		}
	}

	const [initialUser, checkoutResult] = await Promise.all([
		getCheckoutSessionUser(),
		checkoutIdFromUrl ? getCheckoutSessionCheckout(checkoutIdFromUrl, browseLocale) : Promise.resolve(null),
	]);

	let loadState: CheckoutLoadState = "none";
	let channelSlug: string | null = null;
	let initialCheckout: ServerCheckout | null = null;
	let shippingCountries: ShippingCountries = [];

	if (!checkoutIdFromUrl) {
		loadState = "none";
	} else if (!checkoutResult || !checkoutResult.ok) {
		loadState = "error";
	} else if (!checkoutResult.checkout) {
		loadState = "not_found";
		await Checkout.clearCheckoutCookieByValue(checkoutIdFromUrl);
	} else {
		channelSlug = checkoutResult.checkout.channel.slug;
		const checkoutIdFromChannelCookie = await Checkout.getIdFromCookies(channelSlug);

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

	return (
		<CheckoutApp
			checkoutId={checkoutIdFromUrl}
			loadState={loadState}
			initialCheckout={initialCheckout}
			initialUser={initialUser}
			shippingCountries={shippingCountries}
		/>
	);
}
