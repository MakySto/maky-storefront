"use client";

import { type FC } from "react";
import { CheckoutHeader } from "./checkout-header";
import { OrderSummary } from "./order-summary";
import { InformationStep } from "./information-step";
import { ShippingStep } from "./shipping-step";
import { PaymentStep } from "./payment-step";
import { ConfirmationStep } from "./confirmation-step";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { useUser } from "@/checkout/hooks/use-user";
import { useCustomerAttach } from "@/checkout/hooks/use-customer-attach";
import { EmptyCartPage } from "../empty-cart-page";
import { PageNotFound } from "../page-not-found";
import { CheckoutSkeleton } from "./checkout-skeleton";
import { getCheckoutSteps } from "./flow";
import { useCheckoutStep } from "@/checkout/hooks/use-checkout-step";

/**
 * Saleor checkout view with multi-step flow.
 *
 * Uses consistent step-by-step flow for all users.
 * For logged-in users with addresses, InformationStep shows address selector.
 * For guests, InformationStep shows address form.
 *
 * For digital products (isShippingRequired=false), shipping step is skipped.
 *
 * Layout: Full-width header, centered two-column content on gray background.
 */
export const SaleorCheckout: FC = () => {
	const { checkout, fetching: fetchingCheckout, hasCheckoutId } = useCheckout();
	const { loading: isAuthenticating } = useUser();

	// Auto-attach logged-in user to checkout (runs once, persists across step changes)
	useCustomerAttach();

	// For digital products, skip shipping step (1 = info, 2 = payment, 3 = confirmation)
	// For physical products, full flow (1 = info, 2 = shipping, 3 = payment, 4 = confirmation)
	const isShippingRequired = checkout?.isShippingRequired ?? true;

	// Current step + shallow `?step=` navigation (History API, no RSC re-run — B.4.3, MIGRATION 6).
	const { currentStep, stepRef, goToStep } = useCheckoutStep(isShippingRequired);

	// Checkout is invalid if: no checkout ID in URL, or fetching is done but no checkout data
	const isCheckoutInvalid = !hasCheckoutId || (!fetchingCheckout && !checkout && !isAuthenticating);
	const isEmptyCart = checkout && !checkout.lines.length;

	// Only show skeleton on initial load when we have no data yet
	const showInitialSkeleton = !checkout && (isAuthenticating || fetchingCheckout);

	if (isCheckoutInvalid) {
		return <PageNotFound />;
	}

	if (showInitialSkeleton) {
		return <CheckoutSkeleton />;
	}

	if (isEmptyCart) {
		return <EmptyCartPage />;
	}

	return (
		<div className="bg-secondary min-h-screen overscroll-none">
			{/* Header - full width, white background */}
			<CheckoutHeader
				step={currentStep.index}
				onStepClick={(stepIndex) => {
					// Find step by index to get its slug
					const steps = getCheckoutSteps(isShippingRequired);
					const step = steps.find((s) => s.index === stepIndex);
					if (step) {
						// Header only allows clicking prior steps — a backward jump, so replace.
						goToStep(step.id, "replace");
					}
				}}
				isShippingRequired={isShippingRequired}
			/>

			{/* Main content - centered, same max-width as main page */}
			{/* pb-24 on mobile accounts for the fixed bottom action bar */}
			<main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
				{/* Two column layout: ~70% Form + ~30% Summary */}
				<div className="flex flex-col gap-8 md:flex-row">
					{/* Left column: Form (~70%) */}
					<div className="min-w-0 flex-1">
						{/* Mobile Order Summary - collapsible, inside scrollable content */}
						<div className="border-border bg-card mb-4 overflow-hidden rounded-lg border md:hidden">
							<OrderSummary checkout={checkout} />
						</div>
						<div className="border-border bg-card rounded-lg border p-6 md:p-8">
							<div ref={stepRef} tabIndex={-1} className="outline-none">
								{currentStep.id === "INFO" && (
									<InformationStep
										checkout={checkout}
										onNext={() => goToStep(isShippingRequired ? "SHIPPING" : "PAYMENT")}
									/>
								)}
								{currentStep.id === "SHIPPING" && (
									<ShippingStep
										checkout={checkout}
										onBack={() => goToStep("INFO", "replace")}
										onNext={() => goToStep("PAYMENT")}
									/>
								)}
								{currentStep.id === "PAYMENT" && (
									<PaymentStep
										checkout={checkout}
										onBack={() => goToStep(isShippingRequired ? "SHIPPING" : "INFO", "replace")}
										onGoToInformation={() => goToStep("INFO", "replace")}
									/>
								)}
								{currentStep.id === "CONFIRMATION" && <ConfirmationStep checkout={checkout} />}
							</div>
						</div>
					</div>

					{/* Right column: Summary (~30%) - hidden on mobile, shown on desktop */}
					<div className="hidden md:block md:shrink-0 md:basis-[30%]">
						<div className="border-border bg-card overflow-hidden rounded-lg border md:sticky md:top-8">
							<OrderSummary checkout={checkout} />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};
