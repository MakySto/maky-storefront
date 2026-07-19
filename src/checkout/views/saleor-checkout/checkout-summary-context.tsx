"use client";

import { type FC } from "react";
import { type CheckoutFragment } from "@/checkout/graphql";
import { formatShippingPrice } from "@/checkout/lib/utils/money";

interface SummaryRow {
	label: string;
	value: string;
	onChangeStep?: number;
}

interface CheckoutSummaryContextProps {
	checkout: CheckoutFragment;
	/** Rows to display (Contact, Ship to, Method) */
	rows: SummaryRow[];
	/** Callback when user clicks Change */
	onGoToStep?: (step: number) => void;
}

/**
 * Summary context showing current checkout state (Contact, Ship to, Method).
 * Used in ShippingStep and PaymentStep to show context from previous steps.
 */
export const CheckoutSummaryContext: FC<CheckoutSummaryContextProps> = ({ rows, onGoToStep }) => {
	return (
		<section className="divide-border border-border divide-y rounded-lg border text-sm">
			{rows.map((row) => (
				<div key={row.label} className="flex items-start gap-4 p-4">
					<span className="text-muted-foreground w-16 shrink-0 pt-0.5">{row.label}</span>
					<span className="min-w-0 flex-1 break-words">{row.value}</span>
					{row.onChangeStep !== undefined && onGoToStep && (
						<button
							type="button"
							onClick={() => onGoToStep(row.onChangeStep!)}
							className="shrink-0 text-sm underline underline-offset-2 hover:no-underline"
						>
							Zmeniť
						</button>
					)}
				</div>
			))}
		</section>
	);
};

// =============================================================================
// Helper functions to build summary rows
// =============================================================================

/** Format address as single line string */
export function formatAddressLine(address: CheckoutFragment["shippingAddress"]): string {
	if (!address) return "";
	return `${address.streetAddress1}, ${address.city} ${address.postalCode}, ${address.country?.country}`;
}

/** Get shipping method display string */
export function formatShippingMethod(checkout: CheckoutFragment): string {
	const deliveryMethod = checkout.deliveryMethod;
	// The CheckoutFragment selects `deliveryMethod { ... on ShippingMethod { id } ... on Warehouse { id } }`
	// WITHOUT `__typename`, so at runtime `__typename` is absent (GraphQL only returns it when selected) and
	// the old `__typename === "ShippingMethod"` guard always failed → "Method —". Match the id against
	// `shippingMethods` directly: a ShippingMethod id resolves to its name; a Warehouse (click & collect)
	// id won't match any shipping method and falls through to "—".
	const methodId = deliveryMethod?.id;
	const method = checkout.shippingMethods?.find((m) => m.id === methodId);

	if (!method) return "—";

	const priceStr = formatShippingPrice(checkout.shippingPrice?.gross);

	return `${method.name}${priceStr ? ` · ${priceStr}` : ""}`;
}

/** Build standard summary rows for shipping step */
export function buildShippingSummaryRows(checkout: CheckoutFragment): SummaryRow[] {
	return [
		{ label: "Kontakt", value: checkout.email || "", onChangeStep: 1 },
		{ label: "Doručenie na", value: formatAddressLine(checkout.shippingAddress), onChangeStep: 1 },
	];
}

/** Build standard summary rows for payment step */
export function buildPaymentSummaryRows(checkout: CheckoutFragment): SummaryRow[] {
	const rows: SummaryRow[] = [{ label: "Kontakt", value: checkout.email || "", onChangeStep: 1 }];

	// Only show shipping info for physical products
	if (checkout.isShippingRequired) {
		rows.push(
			{ label: "Doručenie na", value: formatAddressLine(checkout.shippingAddress), onChangeStep: 1 },
			{ label: "Doprava", value: formatShippingMethod(checkout), onChangeStep: 2 },
		);
	} else {
		// Digital products - show delivery type instead
		rows.push({ label: "Doručenie", value: "Digitálne" });
	}

	return rows;
}
