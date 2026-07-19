"use client";

import { type FC, useState } from "react";
import Link from "next/link";
import { CheckCircle, Mail, MapPin, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import { marketHref } from "@/lib/channel-map";
import { localizeCountryName } from "@/checkout/lib/utils/locale";
import { useLocale } from "@/providers/locale-provider";

interface ConfirmationStepProps {
	checkout: CheckoutFragment;
}

/** Format address for display */
function formatAddress(
	address: CheckoutFragment["shippingAddress"] | CheckoutFragment["billingAddress"],
	locale: string,
) {
	if (!address) return null;
	return [
		address.streetAddress1,
		address.city,
		address.postalCode,
		localizeCountryName(address.country?.code, address.country?.country, locale),
	]
		.filter(Boolean)
		.join(", ");
}

/**
 * Order confirmation step (demo version).
 * Shows after successful payment in demo mode.
 * Note: Order summary is shown in the sidebar, so not duplicated here.
 */
export const ConfirmationStep: FC<ConfirmationStepProps> = ({ checkout }) => {
	const t = useTranslations("checkout");
	const tCart = useTranslations("cart");
	const { locale } = useLocale();
	const channel = checkout.channel.slug;
	const shippingAddress = checkout.shippingAddress;
	const billingAddress = checkout.billingAddress;
	const email = checkout.email || "";

	// Generate a demo order number ("DEMO-" is an identifier prefix, not translated)
	const [orderNumber] = useState(() => `DEMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);

	return (
		<div className="space-y-8">
			{/* Demo Banner */}
			<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
				{t.rich("confirmation.demoBanner", {
					strong: (chunks) => <strong>{chunks}</strong>,
				})}
			</div>

			{/* Success Header */}
			<div className="space-y-4 text-center">
				<div className="flex justify-center">
					<div className="relative">
						<div className="absolute inset-0 animate-ping rounded-full bg-green-400/30" />
						<CheckCircle className="relative h-16 w-16 text-green-500" />
					</div>
				</div>
				<div>
					<p className="text-muted-foreground">{t("confirmation.orderNumberLine", { orderNumber })}</p>
					<h1 className="mt-1 text-2xl font-semibold">{t("confirmation.title")}</h1>
				</div>
			</div>

			{/* Order Confirmation Card */}
			<div className="border-border overflow-hidden rounded-lg border">
				<div className="bg-secondary/50 border-border border-b p-4">
					<h2 className="font-semibold">{t("confirmation.confirmedTitle")}</h2>
					<p className="text-muted-foreground mt-1 text-sm break-words">
						{t("confirmation.emailNotice", { email })}
					</p>
				</div>

				{/* Order Details */}
				<div className="space-y-4 p-4">
					<div className="flex items-start gap-3">
						<Mail className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium">{t("confirmation.emailSentLabel")}</p>
							<p className="text-muted-foreground text-sm break-words">{email}</p>
						</div>
					</div>
					{shippingAddress && (
						<div className="flex items-start gap-3">
							<MapPin className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium">{t("confirmation.shippingAddressLabel")}</p>
								<p className="text-muted-foreground text-sm break-words">
									{formatAddress(shippingAddress, locale)}
								</p>
							</div>
						</div>
					)}
					{billingAddress && (
						<div className="flex items-start gap-3">
							<CreditCard className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium">{t("confirmation.billingAddressLabel")}</p>
								<p className="text-muted-foreground text-sm break-words">
									{formatAddress(billingAddress, locale)}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-4 sm:flex-row">
				<Link
					href={marketHref(channel)}
					className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-12 flex-1 items-center justify-center rounded-md border bg-transparent px-4 text-sm font-medium transition-colors"
				>
					{tCart("continueShopping")}
				</Link>
			</div>
		</div>
	);
};
