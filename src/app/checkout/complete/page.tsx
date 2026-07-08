import { Suspense } from "react";
import { invariant } from "ts-invariant";

import { fetchOrderOnServer } from "@/checkout/lib/server/fetch-order";
import { OrderConfirmationApp } from "@/checkout/order-confirmation-app";
import { resolveBrowseLocaleForCheckout } from "@/lib/checkout-locale";
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
	// Static-sk in variant C; no `?locale=` is emitted on confirmation links.
	const browseLocale = resolveBrowseLocaleForCheckout(searchParams.locale);
	const initialOrder = orderId ? await fetchOrderOnServer(orderId, browseLocale) : null;

	return <OrderConfirmationApp orderId={orderId} initialOrder={initialOrder} />;
}

function OrderCompleteSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader />
		</div>
	);
}
