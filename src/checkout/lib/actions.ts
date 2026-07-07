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
 * injected here so callers omit it. Payment actions (`transactionInitialize`, `checkoutComplete`)
 * are wired to Saleor but have NO gateway registry behind them yet — that is B.4.4 (Dummy) / B.8
 * (Stripe); they compile and call Saleor but are not end-to-end runnable until then.
 */

type NoLang<T> = Omit<T, "languageCode">;

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

export async function checkoutEmailUpdateAction(variables: NoLang<CheckoutEmailUpdateMutationVariables>) {
	return executeAuthenticatedGraphQL(emailUpdateDoc, {
		variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
		cache: "no-cache",
	});
}

export async function checkoutShippingAddressUpdateAction(
	variables: NoLang<CheckoutShippingAddressUpdateMutationVariables>,
) {
	return executeAuthenticatedGraphQL(shippingAddressUpdateDoc, {
		variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
		cache: "no-cache",
	});
}

export async function checkoutBillingAddressUpdateAction(
	variables: NoLang<CheckoutBillingAddressUpdateMutationVariables>,
) {
	return executeAuthenticatedGraphQL(billingAddressUpdateDoc, {
		variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
		cache: "no-cache",
	});
}

export async function checkoutDeliveryMethodUpdateAction(
	variables: NoLang<CheckoutDeliveryMethodUpdateMutationVariables>,
) {
	return executeAuthenticatedGraphQL(deliveryMethodUpdateDoc, {
		variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
		cache: "no-cache",
	});
}

export async function checkoutCustomerAttachAction(
	variables: NoLang<CheckoutCustomerAttachMutationVariables>,
) {
	return executeAuthenticatedGraphQL(customerAttachDoc, {
		variables: { ...variables, ...checkoutGraphqlLocaleVariables() },
		cache: "no-cache",
	});
}

export async function checkoutCompleteAction(variables: CheckoutCompleteMutationVariables) {
	return executeAuthenticatedGraphQL(completeDoc, { variables, cache: "no-cache" });
}

export async function addressValidationRulesAction(variables: AddressValidationRulesQueryVariables) {
	return executePublicGraphQL(validationRulesDoc, { variables, cache: "no-cache" });
}

export async function userRegisterAction(variables: UserRegisterMutationVariables) {
	return executePublicGraphQL(userRegisterDoc, { variables, cache: "no-cache" });
}

export async function requestPasswordResetAction(variables: RequestPasswordResetMutationVariables) {
	return executePublicGraphQL(requestPasswordResetDoc, { variables, cache: "no-cache" });
}

export async function userSetDefaultAddressAction(variables: UserSetDefaultAddressMutationVariables) {
	return executeAuthenticatedGraphQL(setDefaultAddressDoc, { variables, cache: "no-cache" });
}

export async function transactionInitializeAction(variables: TransactionInitializeMutationVariables) {
	return executeAuthenticatedGraphQL(transactionInitializeDoc, { variables, cache: "no-cache" });
}
