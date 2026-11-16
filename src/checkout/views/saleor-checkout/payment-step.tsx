"use client";

import { useState, useCallback, useEffect, type FC } from "react";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/providers/locale-provider";
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
import { useCheckoutB2b } from "@/checkout/providers/checkout-b2b";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { defaultSameAsShipping } from "@/checkout/lib/b2b/company-form-state";
import { b2bStatusMessage } from "@/checkout/lib/b2b/status-message";
import { B2bBillingSummary } from "@/checkout/components/b2b/b2b-billing-summary";
import { B2bStatusNotice } from "@/checkout/components/b2b/b2b-status-notice";
import { PaymentLockRecovery } from "@/checkout/components/b2b/payment-lock-recovery";
import { PaymentLockReporterProvider } from "@/checkout/components/b2b/payment-lock-context";
import { OrderLegalNote } from "@/checkout/components/payment/order-legal-note";
import { CheckoutPromoCode } from "@/checkout/components/promo-code/checkout-promo-code";
import { PaymentMethodChoice } from "@/checkout/components/payment/cod/payment-method-choice";
import { CodOrderCheckout } from "@/checkout/components/payment/cod/cod-order-checkout";
import { codOffer, isWithinCodMax } from "@/checkout/lib/cod";
import { getCheckoutPayAmount } from "@/checkout/lib/payment/checkout-pay-amount";
import { isCheckoutReadyToComplete } from "@/checkout/lib/payment/checkout-payment-status";

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
 * Copy externalized to next-intl (`checkout.payment.*`, krok 2A).
 */
export const PaymentStep: FC<PaymentStepProps> = ({
	checkout: initialCheckout,
	onBack,
	onGoToInformation,
}) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	// Use live checkout data to ensure we have the latest total (including shipping)
	const { checkout: liveCheckout } = useCheckout();
	const checkout = liveCheckout || initialCheckout;

	const { user, authenticated } = useUser();
	const isShippingRequired = checkout.isShippingRequired;
	const hasShippingAddress = !!checkout.shippingAddress;
	const shippingAddress = checkout.shippingAddress;

	const [isPaymentBusy, setIsPaymentBusy] = useState(false);
	// From what is STORED, so Payment, Back/Forward and a reload agree: "same as delivery" only when there is no
	// billing address yet or the stored one is the delivery address. A different billing company is never
	// replaced by a copy of the delivery address (zadanie 02, §2).
	const [sameAsBilling, setSameAsBilling] = useState(() => defaultSameAsShipping(checkout));

	// Company purchase: the billing address (and company) was saved in the Information step and is not written
	// again here; the payment waits for the backend's confirmed state.
	const b2b = useCheckoutB2b();
	const { refreshCheckout } = useCheckoutData();
	const preserveBilling = b2b.businessMode && Boolean(checkout.billingAddress);
	const b2bChecksTax = b2b.businessMode && b2b.euMarket;
	const { evaluate: evaluateB2b } = b2b;
	useEffect(() => {
		if (b2bChecksTax) void evaluateB2b("confirm");
	}, [b2bChecksTax, evaluateB2b]);
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
		preserveBilling,
	});

	const isFreeOrder = isCheckoutFreeOrder(checkout);

	// Cash on delivery (`lib/cod.ts`): on offer when the chosen delivery has a cash-on-delivery version in Saleor.
	// Not for an order with nothing to pay, and not once a card payment already covers the order.
	const cod = codOffer(checkout);
	const codOnOffer = cod !== null && (cod.selected || (!isFreeOrder && !isCheckoutReadyToComplete(checkout)));
	const codSelected = codOnOffer && Boolean(cod?.selected);
	const codWithinMax = cod !== null && isWithinCodMax(cod, getCheckoutPayAmount(checkout));
	const [isChoosingPayment, setIsChoosingPayment] = useState(false);
	// With cash on delivery the order button is its own (as with Stripe), never the shared Pay row of a provider.
	const usesClientSubmit = usesClientPaymentSubmit(provider) || codSelected;

	const { error: returnError, clearError: clearReturnError } = useCheckoutPaymentReturnError();

	const handlePaymentError = useCallback(
		(message: string) => {
			clearReturnError();
			setPaymentError(message);
		},
		[clearReturnError, setPaymentError],
	);

	// A payment already in progress refused a new one (contract revision 2, §5): the panel that ends it takes the place
	// of the error line. The key starts it afresh each time.
	const [paymentLock, setPaymentLock] = useState({ key: 0, shown: false });
	const reportPaymentLock = useCallback(() => {
		clearReturnError();
		setPaymentError("");
		setPaymentLock((current) => ({ key: current.key + 1, shown: true }));
	}, [clearReturnError, setPaymentError]);

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
	const summaryRows = buildPaymentSummaryRows(checkout, locale);

	// Handle step navigation from summary
	const handleGoToStep = (step: number) => {
		if (step === 1 && onGoToInformation) {
			onGoToInformation();
		} else if (step === 2) {
			onBack();
		}
	};

	const total = checkout.totalPrice?.gross;
	const totalStr = formatMoneyWithFallback(total, locale);

	const buttonText = isLoading
		? isCompletingOrder
			? t("payment.creatingOrder")
			: t("payment.processingPayment")
		: t("placeOrder");

	// A delivery address stored before the phone became required (a cart from an earlier visit) has none: the
	// customer adds it in the first step before anything can be paid.
	const deliveryPhoneMissing = isShippingRequired && hasShippingAddress && !shippingAddress?.phone?.trim();

	const isDisabled = isLoading || (!canSubmit && !isFreeOrder) || !b2b.gate.allowed || deliveryPhoneMissing;

	const b2bStatus = b2bChecksTax
		? b2bStatusMessage({
				outcome: b2b.outcome,
				pending: b2b.pending || (b2b.outcome === null && !b2b.gate.allowed),
				vies: b2b.vies,
				hasVatId: Boolean(b2b.input?.vatId),
				exemptionAvailable: b2b.exemptionAvailable,
			})
		: null;
	// "Pokračovať s DPH" confirms THIS taxed total; once confirmed the sentence stays, the button goes.
	const offerTaxedConfirmation = b2b.gate.state === "needs_confirmation";
	// The company check found the checkout locked: the same panel as a refused payment.
	const outcomeLocked = b2bStatus !== null && b2b.outcome?.kind === "locked";
	const showPaymentLock = b2b.config.uiEnabled && (paymentLock.shown || outcomeLocked);

	const paymentContent = (
		<>
			{priceChangeNotice ? (
				<div
					className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
					role="status"
				>
					<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
					<div>
						<p className="font-medium text-amber-800">
							{priceChangeNotice.reason === "b2b"
								? t("payment.orderUpdated")
								: t("payment.priceChangedTitle")}
						</p>
						<p className="mt-1 text-sm text-amber-700">
							{t("payment.priceChangedBody", {
								previousTotal: getFormattedMoney(
									{
										amount: priceChangeNotice.previousAmount,
										currency: priceChangeNotice.currency,
									},
									false,
									locale,
								),
								newTotal: getFormattedMoney(
									{
										amount: priceChangeNotice.newAmount,
										currency: priceChangeNotice.currency,
									},
									false,
									locale,
								),
							})}
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

			{usesClientSubmit && !isFreeOrder && !codSelected ? (
				<AuthorizedPaymentRecovery checkout={checkout} onError={handlePaymentError} />
			) : null}

			<PaymentError message={errors.payment || errors.billing || returnError || undefined} />

			{/* Client-submit (Stripe): billing ABOVE the payment UI so the Pay button — rendered
			    inside the Stripe form — is the LAST interaction on the page. Server-submit keeps
			    billing above the shared Pay row at the bottom. */}
			{b2b.businessMode && b2b.input ? (
				<B2bBillingSummary
					billingAddress={checkout.billingAddress}
					input={b2b.input}
					onEdit={onGoToInformation}
					disabled={isPaymentBusy}
				/>
			) : (
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
			)}

			{showPaymentLock ? (
				<PaymentLockRecovery
					key={paymentLock.key}
					checkoutId={checkout.id}
					channelSlug={checkout.channel.slug}
					localeSlug={locale}
					subject="payment"
					onReleased={() => {
						// Stays on screen to say so; the new quote is confirmed before anything can be paid again.
						setPaymentLock((current) => ({ ...current, shown: true }));
						void refreshCheckout().then(() => (b2bChecksTax ? b2b.evaluate("confirm") : undefined));
					}}
					finishOrder={{ onClick: () => void refreshCheckout() }}
				/>
			) : null}

			{b2bStatus && !outcomeLocked ? (
				<B2bStatusNotice
					message={b2bStatus}
					pending={b2b.pending}
					detail={offerTaxedConfirmation ? t("b2b.taxedTotal", { total: totalStr }) : undefined}
					on={{
						continueWithVat: offerTaxedConfirmation ? () => b2b.confirmTaxed() : undefined,
						retry: () => void b2b.evaluate("evaluate"),
						recheck: () => void b2b.evaluate("confirm"),
						refreshStatus: () => {
							void refreshCheckout().then(() => b2b.evaluate("confirm"));
						},
					}}
				/>
			) : null}

			{deliveryPhoneMissing ? (
				<div
					className="bg-status-warning-bg border-status-warning-border text-foreground flex items-start gap-3 rounded-lg border p-4"
					role="alert"
				>
					<AlertTriangle className="text-status-warning mt-0.5 h-5 w-5 shrink-0" />
					<div className="space-y-2">
						<p className="text-sm">{t("payment.deliveryPhoneMissing")}</p>
						{onGoToInformation ? (
							<button
								type="button"
								onClick={onGoToInformation}
								className="text-sm font-medium underline underline-offset-2 hover:no-underline"
							>
								{t("payment.addDeliveryPhone")}
							</button>
						) : null}
					</div>
				</div>
			) : null}

			{/* A discount code or a gift card: here, where the final sum is in view and a delivery is already chosen
			    (a delivery voucher needs one). Locked while a payment is being confirmed. */}
			<CheckoutPromoCode checkout={checkout} disabled={isPaymentBusy || isLoading} />

			{codOnOffer && cod && b2b.gate.allowed && !deliveryPhoneMissing ? (
				<PaymentMethodChoice
					checkout={checkout}
					offer={cod}
					disabled={isPaymentBusy || isLoading}
					onSavingChange={setIsChoosingPayment}
				/>
			) : null}

			{codSelected && cod ? (
				b2b.gate.allowed && !deliveryPhoneMissing && codWithinMax ? (
					<CodOrderCheckout
						checkout={checkout}
						offer={cod}
						billing={{
							billingData,
							sameAsBilling,
							hasShippingAddress,
							shippingAddress,
							userAddresses: user?.addresses,
							authenticated,
							preserveBilling,
						}}
						disabled={isChoosingPayment}
						onError={handlePaymentError}
						onBillingErrors={setBillingErrors}
						onPaymentActivityChange={setIsPaymentBusy}
					/>
				) : null
			) : shouldShowPaymentMethodArea(checkout) && b2b.gate.allowed && !deliveryPhoneMissing ? (
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
						preserveBilling,
					}}
					onPaymentError={handlePaymentError}
					onBillingErrors={setBillingErrors}
					onPriceChangeNotice={setPriceChangeNotice}
					onPaymentActivityChange={setIsPaymentBusy}
				/>
			) : null}

			{!usesClientSubmit ? <OrderLegalNote channelSlug={checkout.channel.slug} /> : null}

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					disabled={isPaymentBusy}
					className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
				>
					<ChevronLeft className="h-4 w-4" />
					{isShippingRequired ? t("common.backToShipping") : t("common.backToInformation")}
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
					loadingText={isCompletingOrder ? t("payment.creatingOrder") : t("payment.processingPayment")}
				/>
			) : null}
		</>
	);

	return (
		<PaymentLockReporterProvider value={b2b.config.uiEnabled ? reportPaymentLock : null}>
			{usesClientSubmit ? (
				<div className="space-y-8">{paymentContent}</div>
			) : (
				<form className="space-y-8" onSubmit={submit}>
					{paymentContent}
				</form>
			)}
		</PaymentLockReporterProvider>
	);
};
