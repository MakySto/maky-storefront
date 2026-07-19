"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { type AddressFragment } from "@/checkout/graphql";
import { cn } from "@/lib/utils";
import { localizeCountryName } from "@/checkout/lib/utils/locale";
import { useLocale } from "@/providers/locale-provider";

export interface AddressDisplayProps {
	/** Address to display */
	address: AddressFragment | null | undefined;
	/** Optional title (e.g., "Shipping address") */
	title?: string;
	/** Additional CSS classes */
	className?: string;
	/** Show "Edit" button */
	onEdit?: () => void;
}

/**
 * Read-only display of an address.
 *
 * Use cases:
 * - Order confirmation
 * - Checkout review step
 * - Account address list
 *
 * @example
 * ```tsx
 * <AddressDisplay
 *   title="Shipping address"
 *   address={checkout.shippingAddress}
 *   onEdit={() => setStep("information")}
 * />
 * ```
 */
export const AddressDisplay: FC<AddressDisplayProps> = ({ address, title, className, onEdit }) => {
	const t = useTranslations("checkout.addressForm");
	const { locale } = useLocale();

	if (!address) {
		return (
			<div className={cn("text-muted-foreground text-sm", className)}>
				{title && <p className="text-foreground mb-1 font-medium">{title}</p>}
				<p>{t("noAddressProvided")}</p>
			</div>
		);
	}

	return (
		<div className={cn("text-sm", className)}>
			{(title || onEdit) && (
				<div className="mb-1 flex items-center justify-between">
					{title && <p className="text-foreground font-medium">{title}</p>}
					{onEdit && (
						<button
							type="button"
							onClick={onEdit}
							className="text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline"
						>
							{t("edit")}
						</button>
					)}
				</div>
			)}
			<div className="text-muted-foreground space-y-0.5">
				<p className="text-foreground font-medium">
					{address.firstName} {address.lastName}
				</p>
				{address.companyName && <p>{address.companyName}</p>}
				<p>{address.streetAddress1}</p>
				{address.streetAddress2 && <p>{address.streetAddress2}</p>}
				<p>
					{address.city}
					{address.countryArea && `, ${address.countryArea}`} {address.postalCode}
				</p>
				<p>{localizeCountryName(address.country?.code, address.country?.country, locale)}</p>
				{address.phone && <p>{address.phone}</p>}
			</div>
		</div>
	);
};
