"use client";

import { useState, type FC } from "react";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import { Button } from "@/ui/components/ui/button";
import { OrderLegalNote } from "@/checkout/components/payment/order-legal-note";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { type CodOffer } from "@/checkout/lib/cod";
import { clearPaymentCompleting } from "@/checkout/lib/payment/checkout-payment-completion";
import { completeCodOrderCheckout } from "@/checkout/lib/payment/complete-cod-order-checkout";
import { rethrowNextInternalError } from "@/checkout/lib/rethrow-next-internal-error";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { formatMoneyWithFallback } from "@/checkout/lib/utils/money";
import { useLocale } from "@/providers/locale-provider";
import { type StripeBillingContext } from "@/checkout/components/payment/stripe/stripe-billing-context";
import { useCheckoutPaymentMessages } from "@/checkout/hooks/use-checkout-payment-messages";

type CodOrderCheckoutProps = {
	checkout: CheckoutFragment;
	offer: CodOffer;
	billing: StripeBillingContext;
	disabled?: boolean;
	onError: (message: string) => void;
	onBillingErrors: (errors: Record<string, string>, focusField?: string) => void;
	onPaymentActivityChange?: (active: boolean) => void;
};

/** Places an order that is paid on delivery: what will be paid to the courier, the legal note, and the order button. */
export const CodOrderCheckout: FC<CodOrderCheckoutProps> = ({
	checkout,
	offer,
	billing,
	disabled,
	onError,
	onBillingErrors,
	onPaymentActivityChange,
}) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	const { refreshCheckout } = useCheckoutData();
	const paymentMessages = useCheckoutPaymentMessages();
	const [isLoading, setIsLoading] = useState(false);
	const total = checkout.totalPrice?.gross;
	const totalStr = formatMoneyWithFallback(total, locale);
	const feeStr = formatMoneyWithFallback(
		total ? { amount: offer.fee, currency: total.currency } : null,
		locale,
	);

	const handleComplete = async () => {
		onError("");
		setIsLoading(true);
		onPaymentActivityChange?.(true);
		let orderPlaced = false;

		try {
			const result = await completeCodOrderCheckout({
				checkout,
				billingData: billing.billingData,
				sameAsBilling: billing.sameAsBilling,
				hasShippingAddress: billing.hasShippingAddress,
				shippingAddress: billing.shippingAddress,
				userAddresses: billing.userAddresses,
				authenticated: billing.authenticated,
				preserveBilling: billing.preserveBilling,
				refreshCheckout,
			});

			if (!result.ok) {
				if (result.kind === "billing") {
					onBillingErrors(result.errors, result.focusField);
				} else {
					onError(result.error);
				}
				return;
			}

			orderPlaced = true;
		} catch (error) {
			rethrowNextInternalError(error);
			console.error("Cash on delivery order failed:", error);
			onError(paymentMessages.completeOrderFailed);
		} finally {
			if (!orderPlaced) {
				clearPaymentCompleting();
				setIsLoading(false);
				onPaymentActivityChange?.(false);
			}
		}
	};

	return (
		<div className="bg-muted/30 border-border space-y-4 rounded-lg border p-6" data-testid="cod-order">
			<p className="text-muted-foreground text-sm">{paymentMessages.codBody(totalStr, feeStr)}</p>
			<OrderLegalNote channelSlug={checkout.channel.slug} />
			<Button
				type="button"
				className="h-14 w-full text-base font-semibold"
				disabled={isLoading || disabled}
				data-testid="cod-place-order"
				onClick={() => void handleComplete()}
			>
				{isLoading ? (
					<span className="flex items-center justify-center gap-2">
						<LoadingSpinner />
						{t("payment.submittingOrder")}
					</span>
				) : (
					t("placeOrder")
				)}
			</Button>
		</div>
	);
};
