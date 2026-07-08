import "server-only";

import { OrderDocument, type OrderQuery, type OrderQueryVariables } from "@/checkout/graphql";
import type { ServerOrder } from "@/checkout/lib/checkout-types";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executePublicGraphQL } from "@/lib/graphql";

const orderQueryDocument = toTypedDocument<OrderQuery, OrderQueryVariables>(OrderDocument);

/**
 * Fetch an order for the confirmation route (`/checkout/complete`).
 *
 * Public read (§10, approved): the order ID in the URL is the credential — no customer session or
 * app token is required for Saleor to return the order by id. Mirrors `fetchCheckoutOnServer`.
 */
export async function fetchOrderOnServer(orderId: string, localeSlug?: string): Promise<ServerOrder | null> {
	const result = await executePublicGraphQL(orderQueryDocument, {
		variables: { id: orderId, ...checkoutGraphqlLocaleVariables(localeSlug) },
		cache: "no-cache",
	});

	if (!result.ok) {
		if (process.env.NODE_ENV === "development") {
			console.error(
				"[fetchOrderOnServer] failed:",
				result.error.type,
				result.error.message || "(no message)",
				{ orderId },
			);
		}
		return null;
	}

	return result.data.order ?? null;
}
