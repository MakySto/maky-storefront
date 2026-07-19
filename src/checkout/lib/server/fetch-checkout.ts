import "server-only";

import {
	CheckoutDocument,
	CheckoutLanguageCodeUpdateDocument,
	type CheckoutLanguageCodeUpdateMutation,
	type CheckoutLanguageCodeUpdateMutationVariables,
	type CheckoutQuery,
	type CheckoutQueryVariables,
} from "@/checkout/graphql";
import type { CheckoutFetchResult } from "@/checkout/lib/checkout-types";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executePublicGraphQL } from "@/lib/graphql";

const checkoutQueryDocument = toTypedDocument<CheckoutQuery, CheckoutQueryVariables>(CheckoutDocument);
const checkoutLanguageCodeUpdateDocument = toTypedDocument<
	CheckoutLanguageCodeUpdateMutation,
	CheckoutLanguageCodeUpdateMutationVariables
>(CheckoutLanguageCodeUpdateDocument);

/**
 * Fetch a checkout for the checkout RSC page.
 *
 * Public read (§10, approved): the checkout ID is the credential — no customer session or
 * app token is required for Saleor to return the checkout by id.
 */
export async function fetchCheckoutOnServer(
	checkoutId: string,
	localeSlug?: string,
): Promise<CheckoutFetchResult> {
	const result = await executePublicGraphQL(checkoutQueryDocument, {
		variables: { id: checkoutId, ...checkoutGraphqlLocaleVariables(localeSlug) },
		cache: "no-cache",
	});

	if (!result.ok) {
		if (process.env.NODE_ENV === "development") {
			console.error(
				"[fetchCheckoutOnServer] failed:",
				result.error.type,
				result.error.message || "(no message)",
				{ checkoutId },
			);
		}
		return { ok: false };
	}

	return { ok: true, checkout: result.data.checkout ?? null };
}

/**
 * Align a checkout's Saleor `languageCode` with its market (public path — checkout-id-is-credential,
 * same §10-approved rule as the checkout read). Returns the updated checkout with translations in
 * the target language, so the caller can use the mutation payload as the authoritative refetch.
 * Used by the RSC loader for checkouts created before the market's languageCode was set at
 * checkoutCreate (or after a market switch); a no-op-by-value update is safe and idempotent.
 */
export async function updateCheckoutLanguageOnServer(
	checkoutId: string,
	localeSlug: string,
): Promise<CheckoutFetchResult> {
	const result = await executePublicGraphQL(checkoutLanguageCodeUpdateDocument, {
		variables: { checkoutId, ...checkoutGraphqlLocaleVariables(localeSlug) },
		cache: "no-cache",
	});

	if (!result.ok || result.data.checkoutLanguageCodeUpdate?.errors?.length) {
		if (process.env.NODE_ENV === "development") {
			console.error("[updateCheckoutLanguageOnServer] failed:", { checkoutId, localeSlug });
		}
		return { ok: false };
	}

	return { ok: true, checkout: result.data.checkoutLanguageCodeUpdate?.checkout ?? null };
}
