import "server-only";

import { UserDocument, type UserQuery, type UserQueryVariables } from "@/checkout/graphql";
import type { CheckoutUser } from "@/checkout/lib/checkout-types";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { fetchAuthenticatedUserIfSession } from "@/lib/auth/fetch-authenticated-user";

const userQueryDocument = toTypedDocument<UserQuery, UserQueryVariables>(UserDocument);

/** Customer profile for checkout — same server auth path as the storefront account (B.2 BFF). */
export async function fetchCheckoutUserOnServer(): Promise<CheckoutUser | null> {
	const result = await fetchAuthenticatedUserIfSession(userQueryDocument, {
		cache: "no-cache",
	});

	if (!result.ok || !result.data.user) {
		return null;
	}

	return result.data.user;
}
