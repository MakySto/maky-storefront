"use server";

import {
	AddressValidationRulesDocument,
	type AddressValidationRulesQuery,
	type AddressValidationRulesQueryVariables,
	CheckoutBillingAddressUpdateDocument,
	type CheckoutBillingAddressUpdateMutation,
	type CheckoutBillingAddressUpdateMutationVariables,
	CheckoutCompleteDocument,
	type CheckoutCompleteMutation,
	type CheckoutCompleteMutationVariables,
	CheckoutCustomerAttachDocument,
	type CheckoutCustomerAttachMutation,
	type CheckoutCustomerAttachMutationVariables,
	CheckoutDeliveryMethodUpdateDocument,
	type CheckoutDeliveryMethodUpdateMutation,
	type CheckoutDeliveryMethodUpdateMutationVariables,
	CheckoutEmailUpdateDocument,
	type CheckoutEmailUpdateMutation,
	type CheckoutEmailUpdateMutationVariables,
	CheckoutShippingAddressUpdateDocument,
	type CheckoutShippingAddressUpdateMutation,
	type CheckoutShippingAddressUpdateMutationVariables,
	RequestPasswordResetDocument,
	type RequestPasswordResetMutation,
	type RequestPasswordResetMutationVariables,
	TransactionInitializeDocument,
	type TransactionInitializeMutation,
	type TransactionInitializeMutationVariables,
	UserRegisterDocument,
	type UserRegisterMutation,
	type UserRegisterMutationVariables,
	UserSetDefaultAddressDocument,
	type UserSetDefaultAddressMutation,
	type UserSetDefaultAddressMutationVariables,
} from "@/checkout/graphql";
import type { CheckoutFetchResult } from "@/checkout/lib/checkout-types";
import { fetchCheckoutOnServer } from "@/checkout/lib/server/fetch-checkout";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executeAuthenticatedGraphQL, executePublicGraphQL } from "@/lib/graphql";

/**
 * Checkout server actions (Track B.4.2).
 *
 * These replace the browser-side urql mutation/query hooks the checkout views used. Checkout
 * mutations carry the static-`sk` `languageCode` (variant C — see `@/lib/checkout-locale`),
 * injected here so callers omit it. Results are returned in a small urql-compatible shape
 * (`{ data?, error? }`) so the existing view call-sites keep reading `result.data?.…` /
 * `result.error`. Payment actions (`transactionInitialize`, `checkoutComplete`) call Saleor but
 * have NO gateway registry behind them yet — that is B.4.4 (Dummy) / B.8 (Stripe); they compile
 * and call Saleor but are not end-to-end runnable until then.
 */

type NoLang<T> = Omit<T, "languageCode">;

/** urql-compatible result shape for the checkout view call-sites. */
type MutationResult<T> = { data?: T; error?: { message: string } };

function toResult<T>(
	result: { ok: true; data: T } | { ok: false; error: { message: string } },
): MutationResult<T> {
	return result.ok ? { data: result.data } : { error: { message: result.error.message } };
}

const emailUpdateDoc = toTypedDocument<CheckoutEmailUpdateMutation, CheckoutEmailUpdateMutationVariables>(
	CheckoutEmailUpdateDocument,
);
const shippingAddressUpdateDoc = toTypedDocument<
	CheckoutShippingAddressUpdateMutation,
	CheckoutShippingAddressUpdateMutationVariables
>(CheckoutShippingAddressUpdateDocument);
const billingAddressUpdateDoc = toTypedDocument<
	CheckoutBillingAddressUpdateMutation,
	CheckoutBillingAddressUpdateMutationVariables
>(CheckoutBillingAddressUpdateDocument);
const deliveryMethodUpdateDoc = toTypedDocument<
	CheckoutDeliveryMethodUpdateMutation,
	CheckoutDeliveryMethodUpdateMutationVariables
>(CheckoutDeliveryMethodUpdateDocument);
const customerAttachDoc = toTypedDocument<
	CheckoutCustomerAttachMutation,
	CheckoutCustomerAttachMutationVariables
>(CheckoutCustomerAttachDocument);
const completeDoc = toTypedDocument<CheckoutCompleteMutation, CheckoutCompleteMutationVariables>(
	CheckoutCompleteDocument,
);
const validationRulesDoc = toTypedDocument<AddressValidationRulesQuery, AddressValidationRulesQueryVariables>(
	AddressValidationRulesDocument,
);
const userRegisterDoc = toTypedDocument<UserRegisterMutation, UserRegisterMutationVariables>(
	UserRegisterDocument,
);
const requestPasswordResetDoc = toTypedDocument<
	RequestPasswordResetMutation,
	RequestPasswordResetMutationVariables
>(RequestPasswordResetDocument);
const setDefaultAddressDoc = toTypedDocument<
	UserSetDefaultAddressMutation,
	UserSetDefaultAddressMutationVariables
>(UserSetDefaultAddressDocument);
const transactionInitializeDoc = toTypedDocument<
	TransactionInitializeMutation,
	TransactionInitializeMutationVariables
>(TransactionInitializeDocument);

/** Live checkout read bypassing the client context cache. */
export async function refreshCheckoutAction(checkoutId: string): Promise<CheckoutFetchResult> {
	return fetchCheckoutOnServer(checkoutId);
}

// Checkout-data mutations are keyed by `checkoutId` — the checkout id IS the credential (the same
// §10-approved public-access rule as the checkout read, B.4.2 D2). They MUST use the public path:
// a guest checkout has no customer session, and the authenticated `fetchWithAuth` path does not
// reliably persist for guests. Only the user/account mutations (customer-attach, set-default-address)
// keep the authenticated path — they are account-scoped, not checkoutId-scoped.
export async function checkoutEmailUpdateAction(variables: NoLang<CheckoutEmailUpdateMutationVariables>) {
	return toResult(
		await executePublicGraphQL(emailUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
			cache: "no-cache",
		}),
	);
}

export async function checkoutShippingAddressUpdateAction(
	variables: NoLang<CheckoutShippingAddressUpdateMutationVariables>,
) {
	return toResult(
		await executePublicGraphQL(shippingAddressUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
			cache: "no-cache",
		}),
	);
}

export async function checkoutBillingAddressUpdateAction(
	variables: NoLang<CheckoutBillingAddressUpdateMutationVariables>,
) {
	return toResult(
		await executePublicGraphQL(billingAddressUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
			cache: "no-cache",
		}),
	);
}

export async function checkoutDeliveryMethodUpdateAction(
	variables: NoLang<CheckoutDeliveryMethodUpdateMutationVariables>,
) {
	return toResult(
		await executePublicGraphQL(deliveryMethodUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
			cache: "no-cache",
		}),
	);
}

export async function checkoutCustomerAttachAction(
	variables: NoLang<CheckoutCustomerAttachMutationVariables>,
) {
	return toResult(
		await executeAuthenticatedGraphQL(customerAttachDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
			cache: "no-cache",
		}),
	);
}

// checkoutComplete + transactionInitialize are checkoutId-keyed (the checkout id is the guest
// credential) — same public-access rule as the checkout-data mutations. A guest has no customer
// session, so the authenticated path silently no-ops for them (see 0039bdf). Public it is.
export async function checkoutCompleteAction(variables: CheckoutCompleteMutationVariables) {
	return toResult(await executePublicGraphQL(completeDoc, { variables, cache: "no-cache" }));
}

export async function addressValidationRulesAction(variables: AddressValidationRulesQueryVariables) {
	return toResult(await executePublicGraphQL(validationRulesDoc, { variables, cache: "no-cache" }));
}

export async function userRegisterAction(variables: UserRegisterMutationVariables) {
	return toResult(await executePublicGraphQL(userRegisterDoc, { variables, cache: "no-cache" }));
}

export async function requestPasswordResetAction(variables: RequestPasswordResetMutationVariables) {
	return toResult(await executePublicGraphQL(requestPasswordResetDoc, { variables, cache: "no-cache" }));
}

export async function userSetDefaultAddressAction(variables: UserSetDefaultAddressMutationVariables) {
	return toResult(await executeAuthenticatedGraphQL(setDefaultAddressDoc, { variables, cache: "no-cache" }));
}

export async function transactionInitializeAction(variables: TransactionInitializeMutationVariables) {
	return toResult(await executePublicGraphQL(transactionInitializeDoc, { variables, cache: "no-cache" }));
}
