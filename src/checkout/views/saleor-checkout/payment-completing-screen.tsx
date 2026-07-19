"use client";

import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";

/**
 * Full-page state while payment is confirmed and checkoutComplete runs (B.8).
 * Gateway-agnostic. MAKY variant of the upstream screen: rendered INSIDE the
 * existing SaleorCheckout layout (no CheckoutPageShell), hardcoded SK copy.
 */
export function PaymentCompletingScreen() {
	return (
		<div
			className="border-border bg-card flex min-h-[min(560px,calc(100dvh-11rem))] flex-col items-center justify-center rounded-lg border p-8 text-center md:p-12"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<LoadingSpinner />
			<h1 className="text-foreground mt-5 text-lg font-semibold tracking-tight md:text-xl">
				Spracovávame vašu objednávku
			</h1>
			<p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
				Potvrdzujeme platbu a vytvárame objednávku. Zvyčajne to trvá pár sekúnd — túto stránku prosím
				nezatvárajte ani neobnovujte.
			</p>
		</div>
	);
}
