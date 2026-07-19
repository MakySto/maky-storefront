"use client";

import { type FC } from "react";
import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCheckoutPaymentMessages } from "@/checkout/hooks/use-checkout-payment-messages";

export interface DummyPaymentPlaceholderProps {
	/** Gateway display name from Saleor (e.g. "Dummy Payment App") */
	gatewayName?: string | null;
}

/**
 * Minimal payment UI for Saleor Dummy Payment test checkouts.
 * No card fields or method picker — the gateway is chosen server-side on Pay.
 * Heading reuses the stepper label (`checkout.steps.payment`).
 */
export const DummyPaymentPlaceholder: FC<DummyPaymentPlaceholderProps> = ({ gatewayName }) => {
	const t = useTranslations("checkout");
	const paymentMessages = useCheckoutPaymentMessages();
	const label = gatewayName?.trim() || paymentMessages.dummyGateway;

	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">{t("steps.payment")}</h2>
			<p className="text-muted-foreground flex items-start gap-2 text-sm">
				<FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
				<span>
					<span className="text-foreground">{label}</span>
					{" · "}
					{paymentMessages.dummyTestMode}
				</span>
			</p>
		</section>
	);
};
