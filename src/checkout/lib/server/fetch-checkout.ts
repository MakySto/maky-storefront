import "server-only";

import { CheckoutDocument, type CheckoutQuery, type CheckoutQueryVariables } from "@/checkout/graphql";
import type { CheckoutFetchResult } from "@/checkout/lib/checkout-types";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executePublicGraphQL } from "@/lib/graphql";

const checkoutQueryDocument = toTypedDocument<CheckoutQuery, CheckoutQueryVariables>(CheckoutDocument);

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
