"use client";

import { PromoCodeBox } from "@/checkout/components/promo-code/promo-code-box";
import type { AppliedPromoCodes } from "@/checkout/lib/promo-code";
import { applyCartPromoCode, removeCartPromoCode } from "./actions";

/**
 * The discount code field of the cart page. The cart is a server render: the action invalidates it and the page
 * comes back with the new total, so nothing is kept here.
 */
export function CartPromoCode({
	channel,
	checkoutId,
	locale,
	applied,
	className,
}: {
	channel: string;
	checkoutId: string;
	locale: string;
	applied: AppliedPromoCodes;
	className?: string;
}) {
	return (
		<PromoCodeBox
			className={className}
			applied={applied}
			locale={locale}
			onApply={(promoCode) => applyCartPromoCode(channel, checkoutId, promoCode)}
			onRemove={(removal) => removeCartPromoCode(channel, checkoutId, removal)}
		/>
	);
}
