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
	PaymentGatewaysInitializeDocument,
	type PaymentGatewaysInitializeMutation,
	type PaymentGatewaysInitializeMutationVariables,
	RequestPasswordResetDocument,
	type RequestPasswordResetMutation,
	type RequestPasswordResetMutationVariables,
	TransactionInitializeDocument,
	type TransactionInitializeMutation,
	type TransactionInitializeMutationVariables,
	TransactionProcessDocument,
	type TransactionProcessMutation,
	type TransactionProcessMutationVariables,
	UserRegisterDocument,
	type UserRegisterMutation,
	type UserRegisterMutationVariables,
	UserSetDefaultAddressDocument,
	type UserSetDefaultAddressMutation,
	type UserSetDefaultAddressMutationVariables,
} from "@/checkout/graphql";
import type {
	CheckoutCompleteActionResult,
	PaymentGatewaysInitializeActionResult,
	TransactionInitializeActionResult,
	TransactionProcessActionResult,
} from "@/checkout/lib/checkout-action-types";
import type { CheckoutFetchResult } from "@/checkout/lib/checkout-types";
import {
	getCheckoutPayAmount,
	hasMaterialCheckoutTotalChange,
} from "@/checkout/lib/payment/checkout-pay-amount";
import { getDummyPaymentGuardError } from "@/checkout/lib/payment/providers/dummy";
import { isDummyPaymentAllowed } from "@/checkout/lib/payment/providers/dummy";
import { getStripePaymentGuardError, isStripePaymentEnabled } from "@/checkout/lib/payment/providers/stripe";
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

// ---------------------------------------------------------------------------
// {ok}-shaped payment actions (B.4.4) — the CheckoutTransport surface.
//
// All four use `executePublicGraphQL`, a deliberate divergence from upstream's
// authenticated path: MAKY guest checkouts carry no customer session, and the
// checkout id IS the credential (c0fcfa1, same §10-approved rule as the other
// checkout-data mutations). Guards below are defense in depth against direct
// server-action invocation with disabled gateways or tampered amounts.
// ---------------------------------------------------------------------------

const paymentGatewaysInitializeDoc = toTypedDocument<
	PaymentGatewaysInitializeMutation,
	PaymentGatewaysInitializeMutationVariables
>(PaymentGatewaysInitializeDocument);
const transactionProcessDoc = toTypedDocument<
	TransactionProcessMutation,
	TransactionProcessMutationVariables
>(TransactionProcessDocument);

// Hardcoded EN (D1) — SK localisation lands with the checkout i18n pass (B.7).
const NO_SALEOR_RESPONSE_MESSAGE = "No response from Saleor. Please try again.";
const GATEWAY_INIT_FAILED_MESSAGE = "Payment gateway initialization failed.";
const PAYMENT_INIT_FAILED_MESSAGE =
	"Payment could not be initialized. Check that the payment app is running in Saleor.";
const TOTAL_VERIFY_FAILED_MESSAGE = "Could not verify the checkout total. Please try again.";
const TOTAL_CHANGED_MESSAGE = "Order total changed. Review the updated amount and try again.";
const PAYMENTS_DISABLED_MESSAGE = "Payments are not enabled in this environment.";
const PAYMENT_PROCESS_FAILED_MESSAGE = "Payment could not be processed. Please try again.";
const COMPLETE_ORDER_FAILED_MESSAGE = "Could not complete your order. Please try again.";
const ORDER_CREATE_FAILED_MESSAGE = "Order was not created. Please try again.";

export async function initializePaymentGatewaysAction(
	variables: PaymentGatewaysInitializeMutationVariables,
): Promise<PaymentGatewaysInitializeActionResult> {
	const result = await executePublicGraphQL(paymentGatewaysInitializeDoc, {
		variables,
		cache: "no-cache",
	});

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	// Operation is `paymentGatewaysInitialize` (plural) but the Saleor payload
	// field is `paymentGatewayInitialize` (singular).
	const payload = result.data.paymentGatewayInitialize;
	if (!payload) {
		return { ok: false, error: NO_SALEOR_RESPONSE_MESSAGE };
	}

	if (payload.errors?.length) {
		return { ok: false, error: payload.errors[0].message ?? GATEWAY_INIT_FAILED_MESSAGE };
	}

	return { ok: true, data: payload };
}

export async function initializeCheckoutTransactionAction(
	variables: TransactionInitializeMutationVariables,
): Promise<TransactionInitializeActionResult> {
	const dummyGuardError = getDummyPaymentGuardError(variables.paymentGateway?.id);
	if (dummyGuardError) {
		return { ok: false, error: dummyGuardError };
	}

	const stripeGuardError = getStripePaymentGuardError(variables.paymentGateway?.id);
	if (stripeGuardError) {
		return { ok: false, error: stripeGuardError };
	}

	// Defense in depth: never trust the client-supplied amount. Saleor re-validates
	// coverage at checkoutComplete, but rejecting here avoids authorizing a wrong amount.
	if (typeof variables.amount === "number") {
		const live = await fetchCheckoutOnServer(variables.checkoutId);
		if (!live.ok || !live.checkout) {
			return { ok: false, error: TOTAL_VERIFY_FAILED_MESSAGE };
		}

		const liveAmount = getCheckoutPayAmount(live.checkout);
		if (liveAmount === null || hasMaterialCheckoutTotalChange(liveAmount, variables.amount)) {
			return { ok: false, error: TOTAL_CHANGED_MESSAGE };
		}
	}

	const result = await executePublicGraphQL(transactionInitializeDoc, { variables, cache: "no-cache" });

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.transactionInitialize;
	if (!payload) {
		return { ok: false, error: NO_SALEOR_RESPONSE_MESSAGE };
	}

	if (payload.errors?.length) {
		return { ok: false, error: payload.errors[0].message ?? PAYMENT_INIT_FAILED_MESSAGE };
	}

	return { ok: true, data: payload };
}

export async function processCheckoutTransactionAction(
	variables: TransactionProcessMutationVariables,
): Promise<TransactionProcessActionResult> {
	// Mirror the initialize guards: when every integrated gateway is disabled for this
	// environment, a direct call to this action must not drive transactions either.
	if (!isStripePaymentEnabled() && !isDummyPaymentAllowed()) {
		return { ok: false, error: PAYMENTS_DISABLED_MESSAGE };
	}

	const result = await executePublicGraphQL(transactionProcessDoc, { variables, cache: "no-cache" });

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.transactionProcess;
	if (!payload) {
		return { ok: false, error: NO_SALEOR_RESPONSE_MESSAGE };
	}

	if (payload.errors?.length) {
		return { ok: false, error: payload.errors[0].message ?? PAYMENT_PROCESS_FAILED_MESSAGE };
	}

	return { ok: true, data: payload };
}

export async function runCheckoutCompleteAction(checkoutId: string): Promise<CheckoutCompleteActionResult> {
	const result = await executePublicGraphQL(completeDoc, {
		variables: { checkoutId },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.checkoutComplete;
	if (!payload) {
		return { ok: false, error: NO_SALEOR_RESPONSE_MESSAGE };
	}

	if (payload.errors?.length) {
		return {
			ok: false,
			error: payload.errors[0].message ?? COMPLETE_ORDER_FAILED_MESSAGE,
			fieldErrors: payload.errors.map((error) => ({
				field: error.field,
				message: error.message ?? COMPLETE_ORDER_FAILED_MESSAGE,
				code: error.code,
			})),
		};
	}

	const orderId = payload.order?.id;
	if (!orderId) {
		return { ok: false, error: ORDER_CREATE_FAILED_MESSAGE };
	}

	// Return orderId for the client `navigateToOrderConfirmation()` — do not `redirect()`
	// here (see @/checkout/lib/navigate-to-order). No cookie clear / chrome revalidation
	// yet — that is B.4.5 (needs order.channel{slug} in the selection + after()).
	return { ok: true, orderId };
}
