import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { invariant } from "ts-invariant";

import { fetchOrderOnServer } from "@/checkout/lib/server/fetch-order";
import { resolveFallbackLocale } from "@/checkout/lib/server/resolve-fallback-locale";
import { OrderConfirmationApp } from "@/checkout/order-confirmation-app";
import { resolveCheckoutLocale } from "@/lib/checkout-locale";
import { LocaleProvider } from "@/providers/locale-provider";
import { Loader } from "@/ui/atoms/loader";

/** Server-visible params for the order-confirmation route. */
type OrderCompleteSearchParams = {
	order?: string;
	locale?: string;
};

/**
 * Order confirmation route (`/checkout/complete`) — Track B.4.3, MIGRATION step 5.
 *
 * A dedicated RSC route, separate from the active checkout SPA (`/checkout`). The order is fetched
 * server-side by `?order=` (the order id is the public credential) and handed to a client shell
 * that carries NO checkout/cart state. Variant C: flat `src/app/checkout/complete/` (no
 * `(checkout)` route group), nested under the shared `app/checkout/layout.tsx`.
 *
 * Locale (krok 2): the order's channel decides — the same central market config as the checkout.
 * The first fetch runs with the fallback locale (market cookie / default); when the channel-derived
 * locale differs, the order is refetched so Saleor translations match the market.
 */
export default function OrderCompletePage(props: { searchParams: Promise<OrderCompleteSearchParams> }) {
	return (
		<Suspense fallback={<OrderCompleteSkeleton />}>
			<OrderCompleteContent searchParams={props.searchParams} />
		</Suspense>
	);
}

async function OrderCompleteContent({
	searchParams: searchParamsPromise,
}: {
	searchParams: Promise<OrderCompleteSearchParams>;
}) {
	const searchParams = await searchParamsPromise;
	invariant(process.env.NEXT_PUBLIC_SALEOR_API_URL, "Missing NEXT_PUBLIC_SALEOR_API_URL env variable");

	const orderId = searchParams.order ?? null;
	const fallbackLocale = await resolveFallbackLocale(searchParams.locale);

	let locale = fallbackLocale;
	let initialOrder = orderId ? await fetchOrderOnServer(orderId, fallbackLocale) : null;

	if (initialOrder) {
		const channelLocale = resolveCheckoutLocale(initialOrder.channel.slug);
		if (channelLocale !== fallbackLocale && orderId) {
			const refetched = await fetchOrderOnServer(orderId, channelLocale);
			if (refetched) {
				initialOrder = refetched;
			}
		}
		locale = channelLocale;
	}

	setRequestLocale(locale);
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<LocaleProvider locale={locale}>
				<OrderConfirmationApp orderId={orderId} initialOrder={initialOrder} />
			</LocaleProvider>
		</NextIntlClientProvider>
	);
}

function OrderCompleteSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader />
		</div>
	);
}
