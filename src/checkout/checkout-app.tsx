"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { nextCheckoutTransport } from "@/checkout/checkout-transport-next";
import { CheckoutDocumentTitle } from "@/checkout/components/checkout-document-title";
import { CheckoutSessionCleanup } from "@/checkout/components/checkout-session-cleanup";
import { StripeCheckoutCompletionHost } from "@/checkout/components/payment/stripe/stripe-checkout-completion-host";
import { setCheckoutTransport } from "@/checkout/lib/checkout-transport";
import { CheckoutDataProvider } from "@/checkout/providers/checkout-data";
import { CheckoutPaymentReturnErrorProvider } from "@/checkout/providers/checkout-payment-return-error";
import { CheckoutSessionProvider } from "@/checkout/providers/checkout-session";
import { CheckoutUserProvider } from "@/checkout/providers/checkout-user";
import type {
	CheckoutLoadState,
	CheckoutUser,
	ServerCheckout,
	ShippingCountries,
} from "@/checkout/lib/checkout-types";
import { CheckoutSkeleton, SaleorCheckout } from "@/checkout/views/saleor-checkout";
import { PageNotFound } from "@/checkout/views/page-not-found";
import { AuthProvider } from "@/lib/auth";

import "./index.css";

type CheckoutAppProps = {
	checkoutId: string | null;
	loadState: CheckoutLoadState;
	initialCheckout: ServerCheckout | null;
	initialUser: CheckoutUser | null;
	shippingCountries: ShippingCountries;
};

// Installed at module scope, before any payment code can run (upstream pattern) —
// lib/payment/* reaches Saleor exclusively through this seam.
setCheckoutTransport(nextCheckoutTransport);

/**
 * Checkout composition root (Track B.4.2, MAKY variant C — reduced).
 *
 * Hydrates the client checkout from RSC-loaded data and installs the data/user context that
 * replaces browser-side urql. `AuthProvider` is kept for the interactive auth-sdk flows the
 * checkout still uses client-side (sign-in / reset / sign-out — B.2 scope); note it still
 * mounts a urql client for those flows, so urql remains a transitive runtime dependency of
 * the checkout shell (the checkout DATA path itself no longer uses urql). Deliberately
 * omitted vs upstream: CheckoutContentProvider (no CMS), CheckoutIntlProvider/BrowseProvider
 * (static-sk), StripeCheckoutCompletionHost (B.8), and the session guards (B.4.5).
 */
export function CheckoutApp({
	checkoutId,
	loadState,
	initialCheckout,
	initialUser,
	shippingCountries,
}: CheckoutAppProps) {
	return (
		<AuthProvider>
			<CheckoutUserProvider initialUser={initialUser}>
				<CheckoutSessionProvider checkoutId={checkoutId} orderId={null}>
					<CheckoutDataProvider
						checkoutId={checkoutId}
						loadState={loadState}
						initialCheckout={initialCheckout}
						shippingCountries={shippingCountries}
					>
						<CheckoutPaymentReturnErrorProvider>
							<CheckoutDocumentTitle />
							<Suspense fallback={null}>
								<CheckoutSessionCleanup />
								<StripeCheckoutCompletionHost />
							</Suspense>
							<ErrorBoundary FallbackComponent={PageNotFound}>
								<Suspense fallback={<CheckoutSkeleton />}>
									<SaleorCheckout />
								</Suspense>
							</ErrorBoundary>
						</CheckoutPaymentReturnErrorProvider>
					</CheckoutDataProvider>
				</CheckoutSessionProvider>
			</CheckoutUserProvider>
		</AuthProvider>
	);
}
