/**
 * A discount code or a gift card typed by the customer (`checkoutAddPromoCode`): what is sent to Saleor, what is
 * said when Saleor refuses it, and what the cart and the checkout show as applied.
 *
 * Saleor decides whether a code is good. Nothing here knows a code, a value or a rule of a voucher.
 */

import { isCheckoutLockedCode } from "@/checkout/lib/b2b/contract";

export type PromoCodeErrorLike = { code?: unknown; field?: string | null; message?: string | null };

/** Why a code was not taken, as the customer is told. `locked`: a payment is in progress (a state, not a bad code). */
export type PromoCodeRefusal = "empty" | "invalid" | "notApplicable" | "locked" | "failed";

export type PromoCodeTranslator = (key: string, values?: Record<string, string>) => string;

/**
 * The code as it is sent: without the spaces a copy from an e-mail brings along. Case is kept, because Saleor
 * compares codes exactly; `promoCodeAttempts` is where the capitals are tried.
 */
export function normalizePromoCode(raw: string | null | undefined): string {
	return (raw ?? "").replace(/\s+/g, "").trim();
}

/**
 * What to try, in order. Saleor matches a code letter for letter, and a customer who types `zima10` for `ZIMA10`
 * has the right code: the capitals are tried second, only when the code as typed was not known.
 */
export function promoCodeAttempts(raw: string | null | undefined): string[] {
	const typed = normalizePromoCode(raw);
	if (!typed) return [];
	const upper = typed.toUpperCase();
	return upper === typed ? [typed] : [typed, upper];
}

/** Saleor's answer to a refused code, reduced to what the customer can do about it. */
export function promoCodeRefusal(errors: ReadonlyArray<PromoCodeErrorLike>): PromoCodeRefusal {
	if (errors.some((error) => isCheckoutLockedCode(error.code))) return "locked";
	const codes = errors.map((error) => String(error.code ?? ""));
	// A voucher that exists but does not fit this cart (a minimum spend, a country, a delivery not chosen yet).
	if (codes.includes("VOUCHER_NOT_APPLICABLE")) return "notApplicable";
	if (
		codes.some((code) => code === "INVALID" || code === "NOT_FOUND" || code === "GIFT_CARD_NOT_APPLICABLE")
	) {
		return "invalid";
	}
	if (codes.includes("REQUIRED")) return "empty";
	return "failed";
}

/** Only an unknown code is worth a second try in capitals; a voucher that does not fit was found. */
export function isUnknownCodeRefusal(refusal: PromoCodeRefusal): boolean {
	return refusal === "invalid";
}

/** The sentence for a refusal, in the customer's language. Never Saleor's English. */
export function promoCodeRefusalMessage(refusal: PromoCodeRefusal, t: PromoCodeTranslator): string {
	switch (refusal) {
		case "empty":
			return t("checkout.promo.empty");
		case "invalid":
			return t("checkout.promo.invalid");
		case "notApplicable":
			return t("checkout.promo.notApplicable");
		case "locked":
			return t("checkout.promo.paymentInProgress");
		default:
			return t("checkout.promo.failed");
	}
}

type MoneyLike = { amount: number; currency: string };

export type AppliedVoucher = {
	code: string;
	/** The discount's own name in the market's language, when Saleor has one and it says more than the code. */
	name: string | null;
	/** What Saleor took off for it; `null` while it is nothing (a delivery voucher before a delivery is chosen). */
	discount: MoneyLike | null;
};

export type AppliedGiftCard = {
	id: string;
	/** The last characters of the card's code, as Saleor shows them to the customer. */
	displayCode: string;
	balance: MoneyLike | null;
};

export type AppliedPromoCodes = { voucher: AppliedVoucher | null; giftCards: AppliedGiftCard[] };

export type PromoCheckoutLike = {
	voucherCode?: string | null;
	discountName?: string | null;
	translatedDiscountName?: string | null;
	discount?: MoneyLike | null;
	giftCards?: ReadonlyArray<{
		id: string;
		displayCode: string;
		currentBalance?: MoneyLike | null;
	}> | null;
};

/** What the checkout carries as applied, in the shape both the cart and the checkout summary show. */
export function appliedPromoCodes(checkout: PromoCheckoutLike | null | undefined): AppliedPromoCodes {
	const code = checkout?.voucherCode?.trim() || "";
	// Only the translation: `discountName` is the name staff gave the voucher in the Dashboard, in their language
	// and for their eyes ("Zľava 5 % na celý nákup"), and a German customer must not be shown it.
	const name = (checkout?.translatedDiscountName || "").trim();
	const discount = checkout?.discount && checkout.discount.amount > 0 ? checkout.discount : null;
	return {
		voucher: code
			? { code, name: name && name.toLowerCase() !== code.toLowerCase() ? name : null, discount }
			: null,
		giftCards: (checkout?.giftCards ?? []).map((card) => ({
			id: card.id,
			displayCode: card.displayCode,
			balance: card.currentBalance ?? null,
		})),
	};
}

export function hasAppliedPromoCodes(applied: AppliedPromoCodes): boolean {
	return applied.voucher !== null || applied.giftCards.length > 0;
}

/** Which applied code to take off: a voucher by its code, a gift card by its id (its full code is never shown). */
export type PromoCodeRemoval = { promoCode: string } | { promoCodeId: string };
