import { Suspense } from "react";

import { CheckoutSessionLoader, type CheckoutPageSearchParams } from "@/checkout/checkout-session-loader";
import { Loader } from "@/ui/atoms/loader";

/**
 * Checkout page (Track B.4.2) — RSC entry.
 *
 * The whole page is dynamic (reads `?checkout=` at request time); the checkout session is fetched
 * server-side by `CheckoutSessionLoader`, which hands materialised data to the client `CheckoutApp`.
 * There is no browser-side urql client any more.
 */
export default function CheckoutPage(props: { searchParams: Promise<CheckoutPageSearchParams> }) {
	return (
		<Suspense fallback={<CheckoutPageSkeleton />}>
			<CheckoutSessionLoader searchParams={props.searchParams} />
		</Suspense>
	);
}

function CheckoutPageSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader />
		</div>
	);
}
