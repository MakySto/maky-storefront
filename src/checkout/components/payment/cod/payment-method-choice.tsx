"use client";

import { useState, type FC } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import { cn } from "@/lib/utils";
import { checkoutDeliveryMethodUpdateAction } from "@/checkout/lib/actions";
import { isCheckoutLockedCode } from "@/checkout/lib/b2b/contract";
import { codTotal, isWithinCodMax, type CodOffer } from "@/checkout/lib/cod";
import { getCheckoutPayAmount } from "@/checkout/lib/payment/checkout-pay-amount";
import { formatMoneyWithFallback } from "@/checkout/lib/utils/money";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { useLocale } from "@/providers/locale-provider";

type PaymentMethodChoiceProps = {
	checkout: CheckoutFragment;
	offer: CodOffer;
	disabled?: boolean;
	/** Tells the step a choice is being saved, so nothing can be ordered or paid on the total that is about to change. */
	onSavingChange?: (saving: boolean) => void;
};

type Way = "online" | "cod";

/**
 * Online payment or cash on delivery, where the chosen delivery has a cash-on-delivery version (`lib/cod.ts`).
 * The choice is saved at once (it changes the total by the fee); on a failed save the previous choice stays.
 */
export const PaymentMethodChoice: FC<PaymentMethodChoiceProps> = ({
	checkout,
	offer,
	disabled,
	onSavingChange,
}) => {
	const t = useTranslations("checkout.payment");
	const { locale } = useLocale();
	const { refreshCheckout } = useCheckoutData();
	const [saving, setSaving] = useState<Way | null>(null);
	const [error, setError] = useState<string | null>(null);

	const currency = checkout.totalPrice?.gross?.currency;
	const money = (amount: number) => formatMoneyWithFallback(currency ? { amount, currency } : null, locale);
	const withinMax = isWithinCodMax(offer, codTotal(offer, getCheckoutPayAmount(checkout)));
	const current: Way = offer.selected ? "cod" : "online";
	// While a save is on its way the picked option reads as chosen; a failed save puts the stored one back.
	const shown = saving ?? current;

	const choose = async (way: Way) => {
		if (saving || disabled || way === current) return;
		if (way === "cod" && !withinMax) return;

		setError(null);
		setSaving(way);
		onSavingChange?.(true);
		try {
			const result = await checkoutDeliveryMethodUpdateAction(
				{ checkoutId: checkout.id, deliveryMethodId: way === "cod" ? offer.cod.id : offer.base.id },
				locale,
			);
			const fieldErrors = result.data?.checkoutDeliveryMethodUpdate?.errors;
			if (fieldErrors?.some((fieldError) => isCheckoutLockedCode(fieldError.code))) {
				setError(t("checkoutLocked"));
			} else if (result.error || fieldErrors?.length) {
				setError(t("methodChangeFailed"));
			}
			// Either way the step shows what Saleor holds now.
			await refreshCheckout();
		} catch (cause) {
			console.error("Changing the way of paying failed:", cause);
			setError(t("methodChangeFailed"));
		} finally {
			setSaving(null);
			onSavingChange?.(false);
		}
	};

	const options: Array<{
		way: Way;
		icon: typeof CreditCard;
		label: string;
		note: string;
		price: string | null;
		unavailable: boolean;
	}> = [
		{
			way: "online",
			icon: CreditCard,
			label: t("methodOnline"),
			note: t("methodOnlineNote"),
			price: null,
			unavailable: false,
		},
		{
			way: "cod",
			icon: Banknote,
			label: t("methodCod"),
			note: withinMax || offer.max === null ? t("methodCodNote") : t("codOverMax", { max: money(offer.max) }),
			price: offer.fee > 0 ? `+${money(offer.fee)}` : null,
			unavailable: !withinMax,
		},
	];

	return (
		<section className="space-y-4" data-testid="payment-method-choice">
			<h2 className="text-lg font-semibold">{t("methodTitle")}</h2>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<div className="space-y-3">
				{options.map(({ way, icon: Icon, label, note, price, unavailable }) => {
					const isSelected = shown === way;
					const isDisabled = Boolean(saving) || Boolean(disabled) || (unavailable && !isSelected);
					return (
						<label
							key={way}
							data-testid={`payment-method-${way}`}
							className={cn(
								"flex min-h-14 items-center gap-4 rounded-lg border p-4 transition-colors",
								"focus-within:ring-foreground focus-within:ring-2 focus-within:ring-offset-2",
								isSelected ? "bg-secondary/50 border-foreground" : "border-border",
								isDisabled && !isSelected
									? "cursor-not-allowed opacity-60"
									: "hover:border-muted-foreground/50 cursor-pointer",
							)}
						>
							<input
								type="radio"
								name="payment-method"
								value={way}
								checked={isSelected}
								disabled={isDisabled}
								onChange={() => void choose(way)}
								className="sr-only"
							/>
							<div
								className={cn(
									"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
									isSelected ? "border-foreground" : "border-muted-foreground/50",
								)}
							>
								{isSelected && <div className="bg-foreground h-2.5 w-2.5 rounded-full" />}
							</div>
							<Icon className="text-muted-foreground h-5 w-5 shrink-0" />
							<div className="min-w-0 flex-1">
								<span className="block font-medium">{label}</span>
								<span
									className={cn(
										"block text-sm",
										unavailable ? "text-status-warning" : "text-muted-foreground",
									)}
								>
									{note}
								</span>
							</div>
							{price ? <span className="shrink-0 font-medium tabular-nums">{price}</span> : null}
						</label>
					);
				})}
			</div>
		</section>
	);
};
