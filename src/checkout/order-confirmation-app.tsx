"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslations } from "next-intl";

import type { ServerOrder } from "@/checkout/lib/checkout-types";
import { CheckoutDocumentTitle } from "@/checkout/components/checkout-document-title";
import { OrderDataProvider } from "@/checkout/providers/order-data";
import { OrderConfirmation, OrderConfirmationSkeleton } from "@/checkout/views/order-confirmation";
import { PageNotFound } from "@/checkout/views/page-not-found";

import "./index.css";

type OrderConfirmationAppProps = {
	orderId: string | null;
	initialOrder: ServerOrder | null;
};

/**
 * Client shell for the order-confirmation route (Track B.4.3, MIGRATION step 5, MAKY variant C).
 *
 * Deliberately separate from `CheckoutApp`: it mounts ONLY the server-hydrated, read-only order
 * context — no `CheckoutDataProvider` (cart/checkout state), no `AuthProvider`, no payment. The
 * confirmation subtree (`OrderConfirmation` + `CheckoutHeader` + `OrderSummary`) reads only the
 * order, so nothing else is needed. A missing order (bogus/expired `?order=`) renders the shared
 * not-found instead of crashing.
 */
export function OrderConfirmationApp({ orderId, initialOrder }: OrderConfirmationAppProps) {
	const t = useTranslations("checkout.confirmation");
	return (
		<OrderDataProvider orderId={orderId} initialOrder={initialOrder}>
			<CheckoutDocumentTitle />
			<ErrorBoundary FallbackComponent={PageNotFound}>
				<Suspense fallback={<OrderConfirmationSkeleton />}>
					{initialOrder ? (
						<OrderConfirmation />
					) : (
						<PageNotFound title={t("orderNotFoundTitle")} message={t("orderNotFoundMessage")} />
					)}
				</Suspense>
			</ErrorBoundary>
		</OrderDataProvider>
	);
}
