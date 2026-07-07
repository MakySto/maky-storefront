"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { CheckoutDataProvider } from "@/checkout/providers/checkout-data";
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

/**
 * Checkout composition root (Track B.4.2, MAKY variant C — reduced).
 *
 * Hydrates the client checkout from RSC-loaded data and installs the data/user context that
 * replaces browser-side urql. `AuthProvider` is kept for the interactive auth-sdk flows the
 * checkout still uses client-side (sign-in / reset / sign-out — B.2 scope). Deliberately omitted
 * vs upstream: CheckoutContentProvider (no CMS), CheckoutIntlProvider/BrowseProvider (static-sk),
 * the payment single-flight transport + StripeCheckoutCompletionHost (B.4.4/B.8), and the
 * session guards (B.4.5).
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
				<CheckoutDataProvider
					checkoutId={checkoutId}
					loadState={loadState}
					initialCheckout={initialCheckout}
					shippingCountries={shippingCountries}
				>
					<ErrorBoundary FallbackComponent={PageNotFound}>
						<Suspense fallback={<CheckoutSkeleton />}>
							<SaleorCheckout />
						</Suspense>
					</ErrorBoundary>
				</CheckoutDataProvider>
			</CheckoutUserProvider>
		</AuthProvider>
	);
}
