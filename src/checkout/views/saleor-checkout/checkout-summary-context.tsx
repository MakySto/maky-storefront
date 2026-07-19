"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import { formatShippingPrice } from "@/checkout/lib/utils/money";
import { localizeCountryName } from "@/checkout/lib/utils/locale";

interface SummaryRow {
	/** Message key under the `checkout` namespace (e.g. "summary.contact") */
	labelKey: string;
	/** Raw display value (customer data); ignored when `valueKey` is set */
	value?: string;
	/** Message key under the `checkout` namespace for fully-translated values (e.g. "summary.digitalDelivery") */
	valueKey?: string;
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
	const t = useTranslations("checkout");

	return (
		<section className="divide-border border-border divide-y rounded-lg border text-sm">
			{rows.map((row) => (
				<div key={row.labelKey} className="flex items-start gap-4 p-4">
					<span className="text-muted-foreground w-16 shrink-0 pt-0.5">{t(row.labelKey)}</span>
					<span className="min-w-0 flex-1 break-words">
						{row.valueKey ? t(row.valueKey) : row.value ?? ""}
					</span>
					{row.onChangeStep !== undefined && onGoToStep && (
						<button
							type="button"
							onClick={() => onGoToStep(row.onChangeStep!)}
							className="shrink-0 text-sm underline underline-offset-2 hover:no-underline"
						>
							{t("common.change")}
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

/** Format address as single line string. `locale` localizes the country name (store default when omitted). */
export function formatAddressLine(address: CheckoutFragment["shippingAddress"], locale?: string): string {
	if (!address) return "";
	return `${address.streetAddress1}, ${address.city} ${address.postalCode}, ${localizeCountryName(
		address.country?.code,
		address.country?.country,
		locale,
	)}`;
}

/** Get shipping method display string */
export function formatShippingMethod(checkout: CheckoutFragment, locale?: string): string {
	const deliveryMethod = checkout.deliveryMethod;
	// The CheckoutFragment selects `deliveryMethod { ... on ShippingMethod { id } ... on Warehouse { id } }`
	// WITHOUT `__typename`, so at runtime `__typename` is absent (GraphQL only returns it when selected) and
	// the old `__typename === "ShippingMethod"` guard always failed → "Method —". Match the id against
	// `shippingMethods` directly: a ShippingMethod id resolves to its name; a Warehouse (click & collect)
	// id won't match any shipping method and falls through to "—".
	const methodId = deliveryMethod?.id;
	const method = checkout.shippingMethods?.find((m) => m.id === methodId);

	if (!method) return "—";

	const priceStr = formatShippingPrice(checkout.shippingPrice?.gross, locale);

	return `${method.name}${priceStr ? ` · ${priceStr}` : ""}`;
}

/** Build standard summary rows for shipping step. `locale` localizes the country name. */
export function buildShippingSummaryRows(checkout: CheckoutFragment, locale?: string): SummaryRow[] {
	return [
		{ labelKey: "summary.contact", value: checkout.email || "", onChangeStep: 1 },
		{
			labelKey: "summary.shipTo",
			value: formatAddressLine(checkout.shippingAddress, locale),
			onChangeStep: 1,
		},
	];
}

/** Build standard summary rows for payment step. `locale` localizes the country name. */
export function buildPaymentSummaryRows(checkout: CheckoutFragment, locale?: string): SummaryRow[] {
	const rows: SummaryRow[] = [{ labelKey: "summary.contact", value: checkout.email || "", onChangeStep: 1 }];

	// Only show shipping info for physical products
	if (checkout.isShippingRequired) {
		rows.push(
			{
				labelKey: "summary.shipTo",
				value: formatAddressLine(checkout.shippingAddress, locale),
				onChangeStep: 1,
			},
			{ labelKey: "summary.method", value: formatShippingMethod(checkout, locale), onChangeStep: 2 },
		);
	} else {
		// Digital products - show delivery type instead
		rows.push({ labelKey: "summary.delivery", valueKey: "summary.digitalDelivery" });
	}

	return rows;
}
