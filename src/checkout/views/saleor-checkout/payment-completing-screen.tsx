"use client";

import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";

/**
 * Full-page state while payment is confirmed and checkoutComplete runs (B.8).
 * Gateway-agnostic. MAKY variant of the upstream screen: rendered INSIDE the
 * existing SaleorCheckout layout (no CheckoutPageShell); copy via next-intl
 * (`checkout.payment.*`).
 */
export function PaymentCompletingScreen() {
	const t = useTranslations("checkout.payment");

	return (
		<div
			className="border-border bg-card flex min-h-[min(560px,calc(100dvh-11rem))] flex-col items-center justify-center rounded-lg border p-8 text-center md:p-12"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<LoadingSpinner />
			<h1 className="text-foreground mt-5 text-lg font-semibold tracking-tight md:text-xl">
				{t("completingTitle")}
			</h1>
			<p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">{t("completingBody")}</p>
		</div>
	);
}
