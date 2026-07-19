"use client";

import { type FC } from "react";
import { CreditCard } from "lucide-react";

export interface StripePaymentPlaceholderProps {
	/** Gateway display name from Saleor (e.g. "Stripe") */
	gatewayName?: string | null;
}

/**
 * Inert placeholder rendered when the Stripe gateway is resolved but the Stripe
 * payment UI is not adopted yet (B.4.4 state). B.8 replaces this with the real
 * `stripe/` component tree (Elements + Express Checkout). Reaching this component
 * requires the Stripe enable flag, which stays OFF until B.8 — in production the
 * shopper sees the "Unsupported payment gateway" alert instead.
 */
export const StripePaymentPlaceholder: FC<StripePaymentPlaceholderProps> = ({ gatewayName }) => {
	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">Platba</h2>
			<div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
				<CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
				<div>
					<p className="font-medium text-blue-800">{gatewayName?.trim() || "Stripe"}</p>
					<p className="mt-1 text-sm text-blue-700">
						Platobné rozhranie Stripe zatiaľ nie je v tomto obchode dostupné.
					</p>
				</div>
			</div>
		</section>
	);
};
