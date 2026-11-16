import "server-only";

import { getTranslations } from "next-intl/server";
import {
	CheckoutAddPromoCodeDocument,
	type CheckoutAddPromoCodeMutation,
	type CheckoutAddPromoCodeMutationVariables,
	CheckoutRemovePromoCodeDocument,
	type CheckoutRemovePromoCodeMutation,
	type CheckoutRemovePromoCodeMutationVariables,
} from "@/checkout/graphql";
import type { ServerCheckout } from "@/checkout/lib/checkout-types";
import {
	isUnknownCodeRefusal,
	promoCodeAttempts,
	promoCodeRefusal,
	promoCodeRefusalMessage,
	type PromoCodeRefusal,
	type PromoCodeRemoval,
} from "@/checkout/lib/promo-code";
import { resolveFallbackLocale } from "@/checkout/lib/server/resolve-fallback-locale";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executePublicGraphQL } from "@/lib/graphql";

const addPromoCodeDoc = toTypedDocument<CheckoutAddPromoCodeMutation, CheckoutAddPromoCodeMutationVariables>(
	CheckoutAddPromoCodeDocument,
);
const removePromoCodeDoc = toTypedDocument<
	CheckoutRemovePromoCodeMutation,
	CheckoutRemovePromoCodeMutationVariables
>(CheckoutRemovePromoCodeDocument);

/** The checkout after the change, or why there was none, with the sentence for the customer already in their language. */
export type PromoCodeResult =
	| { ok: true; checkout: ServerCheckout }
	| { ok: false; refusal: PromoCodeRefusal; message: string };

async function refused(refusal: PromoCodeRefusal, localeSlug?: string): Promise<PromoCodeResult> {
	const locale = await resolveFallbackLocale(localeSlug);
	const translate = await getTranslations({ locale });
	return {
		ok: false,
		refusal,
		message: promoCodeRefusalMessage(refusal, (key, values) => translate(key, values)),
	};
}

/**
 * Add a discount code or a gift card to a checkout. The checkout id is the credential, as for every other
 * checkout mutation (public path, see `actions.ts`).
 *
 * A code Saleor does not know is tried once more in capitals: Saleor compares letter for letter, and the codes
 * are created in capitals.
 */
export async function addPromoCodeOnServer(
	checkoutId: string,
	rawCode: string,
	localeSlug?: string,
): Promise<PromoCodeResult> {
	const attempts = promoCodeAttempts(rawCode);
	if (!checkoutId || attempts.length === 0) return refused("empty", localeSlug);

	let refusal: PromoCodeRefusal = "failed";
	for (const promoCode of attempts) {
		const result = await executePublicGraphQL(addPromoCodeDoc, {
			variables: { checkoutId, promoCode, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		});
		if (!result.ok) return refused("failed", localeSlug);

		const payload = result.data.checkoutAddPromoCode;
		if (payload?.checkout && !payload.errors.length) return { ok: true, checkout: payload.checkout };

		refusal = payload?.errors.length ? promoCodeRefusal(payload.errors) : "failed";
		if (!isUnknownCodeRefusal(refusal)) break;
	}
	return refused(refusal, localeSlug);
}

/** Take an applied code off the checkout: a voucher by its code, a gift card by its id. */
export async function removePromoCodeOnServer(
	checkoutId: string,
	removal: PromoCodeRemoval,
	localeSlug?: string,
): Promise<PromoCodeResult> {
	if (!checkoutId) return refused("failed", localeSlug);

	const result = await executePublicGraphQL(removePromoCodeDoc, {
		variables: { checkoutId, ...removal, ...checkoutGraphqlLocaleVariables(localeSlug) },
		cache: "no-cache",
	});
	if (!result.ok) return refused("failed", localeSlug);

	const payload = result.data.checkoutRemovePromoCode;
	if (payload?.checkout && !payload.errors.length) return { ok: true, checkout: payload.checkout };
	// Taking a code off has one refusal with a meaning of its own: a payment in progress.
	const locked = payload?.errors.length ? promoCodeRefusal(payload.errors) === "locked" : false;
	return refused(locked ? "locked" : "failed", localeSlug);
}
