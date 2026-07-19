"use client";

import { useState, useCallback, useEffect, type FC } from "react";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { CheckoutSummaryContext, buildPaymentSummaryRows } from "./checkout-summary-context";
import { type CheckoutFragment, type CountryCode, type AddressFragment } from "@/checkout/graphql";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { useUser } from "@/checkout/hooks/use-user";
import { useCheckoutPayment } from "@/checkout/hooks/use-checkout-payment";
import { MobileStickyAction } from "./mobile-sticky-action";
import { getStepNumber } from "./flow";
import {
	PaymentGatewayAlerts,
	PaymentMethodArea,
	PaymentError,
	BillingAddressSection,
	type BillingAddressData,
} from "@/checkout/components/payment";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { getFormattedMoney, formatMoneyWithFallback } from "@/checkout/lib/utils/money";
import { isCheckoutFreeOrder } from "@/checkout/lib/payment/checkout-pay-amount";
import { shouldShowPaymentMethodArea } from "@/checkout/lib/payment/should-show-payment-method-area";
import { usesClientPaymentSubmit } from "@/checkout/lib/payment";
import { consumePaymentCompletionError } from "@/checkout/lib/payment/checkout-payment-completion";
import { AuthorizedPaymentRecovery } from "@/checkout/components/payment/stripe/authorized-payment-recovery";
import { useCheckoutPaymentReturnError } from "@/checkout/providers/checkout-payment-return-error";

interface PaymentStepProps {
	checkout: CheckoutFragment;
	onBack: () => void;
	onGoToInformation?: () => void;
}

/**
 * Payment step (E9 rewire, B.4.4): the mock card/PayPal/iDEAL selector is gone —
 * payment UI is resolved from `checkout.availablePaymentGateways` via the payment
 * registry (`PaymentGatewayAlerts` + `PaymentMethodArea`), and the pay pipeline
 * (billing update → live refetch → price-change guard → executePayment →
 * navigateToOrderConfirmation) lives in `useCheckoutPayment`.
 * Hardcoded EN copy (D1) — SK lands in B.7.
 */
export const PaymentStep: FC<PaymentStepProps> = ({
	checkout: initialCheckout,
	onBack,
	onGoToInformation,
}) => {
	// Use live checkout data to ensure we have the latest total (including shipping)
	const { checkout: liveCheckout } = useCheckout();
	const checkout = liveCheckout || initialCheckout;

	const { user, authenticated } = useUser();
	const isShippingRequired = checkout.isShippingRequired;
	const hasShippingAddress = !!checkout.shippingAddress;
	const shippingAddress = checkout.shippingAddress;

	const [isPaymentBusy, setIsPaymentBusy] = useState(false);
	const [sameAsBilling, setSameAsBilling] = useState(isShippingRequired && hasShippingAddress);
	const [billingData, setBillingData] = useState<BillingAddressData>(() => ({
		countryCode: (checkout.billingAddress?.country?.code as CountryCode) || "US",
		formData: {
			firstName: checkout.billingAddress?.firstName || "",
			lastName: checkout.billingAddress?.lastName || "",
			streetAddress1: checkout.billingAddress?.streetAddress1 || "",
			streetAddress2: checkout.billingAddress?.streetAddress2 || "",
			companyName: checkout.billingAddress?.companyName || "",
			city: checkout.billingAddress?.city || "",
			postalCode: checkout.billingAddress?.postalCode || "",
			countryArea: checkout.billingAddress?.countryArea || "",
			phone: checkout.billingAddress?.phone || "",
		},
	}));

	// Sync billing form state when the server billing address changes (refetch after save).
	// Adjust-during-render instead of an effect (react.dev/learn/you-might-not-need-an-effect).
	const [syncedBillingAddress, setSyncedBillingAddress] = useState(checkout.billingAddress);
	if (checkout.billingAddress !== syncedBillingAddress) {
		setSyncedBillingAddress(checkout.billingAddress);
		const billing = checkout.billingAddress;
		if (billing) {
			setBillingData((prev) => ({
				...prev,
				countryCode: (billing.country?.code as CountryCode) || "US",
				formData: {
					firstName: billing.firstName || "",
					lastName: billing.lastName || "",
					streetAddress1: billing.streetAddress1 || "",
					streetAddress2: billing.streetAddress2 || "",
					companyName: billing.companyName || "",
					city: billing.city || "",
					postalCode: billing.postalCode || "",
					countryArea: billing.countryArea || "",
					cityArea: billing.cityArea || "",
					phone: billing.phone || "",
				},
			}));
		}
	}

	const {
		submit,
		errors,
		setPaymentError,
		setBillingErrors,
		setPriceChangeNotice,
		priceChangeNotice,
		provider,
		canSubmit,
		isLoading,
		isCompletingOrder,
	} = useCheckoutPayment({
		checkout,
		billingData,
		sameAsBilling,
		hasShippingAddress,
		shippingAddress,
		userAddresses: user?.addresses,
		authenticated,
	});

	const usesClientSubmit = usesClientPaymentSubmit(provider);
	const isFreeOrder = isCheckoutFreeOrder(checkout);

	const { error: returnError, clearError: clearReturnError } = useCheckoutPaymentReturnError();

	const handlePaymentError = useCallback(
		(message: string) => {
			clearReturnError();
			setPaymentError(message);
		},
		[clearReturnError, setPaymentError],
	);

	useEffect(() => {
		const stashedError = consumePaymentCompletionError();
		if (stashedError) {
			handlePaymentError(stashedError);
		}
	}, [handlePaymentError]);

	const handleBillingDataChange = useCallback((data: BillingAddressData) => {
		setBillingData(data);
	}, []);

	// Summary rows for context display
	const summaryRows = buildPaymentSummaryRows(checkout);

	// Handle step navigation from summary
	const handleGoToStep = (step: number) => {
		if (step === 1 && onGoToInformation) {
			onGoToInformation();
		} else if (step === 2) {
			onBack();
		}
	};

	const total = checkout.totalPrice?.gross;
	const totalStr = formatMoneyWithFallback(total);

	const buttonText = isLoading
		? isCompletingOrder
			? "Vytvárame objednávku…"
			: "Spracovávame platbu…"
		: "Objednať s povinnosťou platby";

	const isDisabled = isLoading || (!canSubmit && !isFreeOrder);

	const paymentContent = (
		<>
			{priceChangeNotice ? (
				<div
					className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
					role="status"
				>
					<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
					<div>
						<p className="font-medium text-amber-800">Celková cena vašej objednávky sa zmenila</p>
						<p className="mt-1 text-sm text-amber-700">
							{`Celková cena sa zmenila z ${getFormattedMoney({
								amount: priceChangeNotice.previousAmount,
								currency: priceChangeNotice.currency,
							})} na ${getFormattedMoney({
								amount: priceChangeNotice.newAmount,
								currency: priceChangeNotice.currency,
							})}. Pred dokončením platby si skontrolujte aktualizované zhrnutie objednávky.`}
						</p>
					</div>
				</div>
			) : null}

			<CheckoutSummaryContext
				checkout={checkout}
				rows={summaryRows}
				onGoToStep={isPaymentBusy ? undefined : handleGoToStep}
			/>

			<PaymentGatewayAlerts gateways={checkout.availablePaymentGateways} />

			{usesClientSubmit && !isFreeOrder ? (
				<AuthorizedPaymentRecovery checkout={checkout} onError={handlePaymentError} />
			) : null}

			<PaymentError message={errors.payment || errors.billing || returnError || undefined} />

			{shouldShowPaymentMethodArea(checkout) ? (
				<PaymentMethodArea
					provider={provider}
					checkout={checkout}
					billing={{
						billingData,
						sameAsBilling,
						hasShippingAddress,
						shippingAddress,
						userAddresses: user?.addresses,
						authenticated,
					}}
					onPaymentError={handlePaymentError}
					onBillingErrors={setBillingErrors}
					onPriceChangeNotice={setPriceChangeNotice}
					onPaymentActivityChange={setIsPaymentBusy}
				/>
			) : null}

			<BillingAddressSection
				billingAddress={checkout.billingAddress}
				shippingAddress={shippingAddress}
				userAddresses={authenticated ? (user?.addresses as AddressFragment[]) : undefined}
				defaultBillingAddressId={user?.defaultBillingAddress?.id}
				isShippingRequired={isShippingRequired}
				errors={errors}
				onChange={handleBillingDataChange}
				onSameAsShippingChange={setSameAsBilling}
				initialSameAsShipping={sameAsBilling}
			/>

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					disabled={isPaymentBusy}
					className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
				>
					<ChevronLeft className="h-4 w-4" />
					{isShippingRequired ? "Späť na dopravu" : "Späť na informácie"}
				</button>
				{!usesClientSubmit ? (
					<Button type="submit" disabled={isDisabled} className="hidden h-12 min-w-[200px] px-8 md:flex">
						{isLoading ? (
							<span className="flex items-center gap-2">
								<LoadingSpinner />
								{buttonText}
							</span>
						) : (
							buttonText
						)}
					</Button>
				) : null}
			</div>

			{!usesClientSubmit ? (
				<MobileStickyAction
					step={getStepNumber("PAYMENT", isShippingRequired)}
					isShippingRequired={isShippingRequired}
					type="submit"
					onAction={submit}
					isLoading={isLoading}
					disabled={isDisabled}
					total={totalStr}
					loadingText={isCompletingOrder ? "Vytvárame objednávku…" : "Spracovávame platbu…"}
				/>
			) : null}
		</>
	);

	return (
		<>
			{usesClientSubmit ? (
				<div className="space-y-8">{paymentContent}</div>
			) : (
				<form className="space-y-8" onSubmit={submit}>
					{paymentContent}
				</form>
			)}
		</>
	);
};
