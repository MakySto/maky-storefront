"use client";

import { type FC } from "react";
import { type CheckoutFragment } from "@/checkout/graphql";
import { checkoutAddPromoCodeAction, checkoutRemovePromoCodeAction } from "@/checkout/lib/actions";
import { appliedPromoCodes, type PromoCodeRemoval } from "@/checkout/lib/promo-code";
import type { PromoCodeResult } from "@/checkout/lib/server/promo-code";
import { useCheckoutB2b } from "@/checkout/providers/checkout-b2b";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { useLocale } from "@/providers/locale-provider";
import { PromoCodeBox, type PromoCodeOutcome } from "./promo-code-box";

/**
 * The discount code field of the checkout summary. The mutation answers with the whole checkout, which replaces
 * the one on screen: the total, the Stripe amount and a free order (a gift card that covers everything) all follow
 * from it, as they do after any other change of the quote.
 */
export const CheckoutPromoCode: FC<{
	checkout: CheckoutFragment;
	disabled?: boolean;
	className?: string;
}> = ({ checkout, disabled, className }) => {
	const { locale } = useLocale();
	const { setCheckout } = useCheckoutData();
	const b2b = useCheckoutB2b();

	const settle = (result: PromoCodeResult): PromoCodeOutcome => {
		if (!result.ok) return { ok: false, message: result.message };
		setCheckout(result.checkout);
		// A company purchase whose tax state was already confirmed for the old total: ask again for the new one.
		if (b2b.businessMode && b2b.euMarket && b2b.outcome !== null) void b2b.evaluate("confirm");
		return { ok: true };
	};

	return (
		<PromoCodeBox
			className={className}
			disabled={disabled}
			applied={appliedPromoCodes(checkout)}
			locale={locale}
			onApply={async (promoCode) =>
				settle(await checkoutAddPromoCodeAction({ checkoutId: checkout.id, promoCode }, locale))
			}
			onRemove={async (removal: PromoCodeRemoval) =>
				settle(await checkoutRemovePromoCodeAction({ checkoutId: checkout.id, removal }, locale))
			}
		/>
	);
};
