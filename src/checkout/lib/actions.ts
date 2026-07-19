"use server";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";
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
	CheckoutMetadataUpdateDocument,
	type CheckoutMetadataUpdateMutation,
	type CheckoutMetadataUpdateMutationVariables,
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
import { resolveFallbackLocale } from "@/checkout/lib/server/resolve-fallback-locale";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import {
	revalidateStorefrontBrowsePath,
	revalidateStorefrontChrome,
} from "@/lib/auth/revalidate-storefront-chrome";
import { clearCheckoutCookieByValue } from "@/lib/checkout";
import { checkoutGraphqlLocaleVariables } from "@/lib/checkout-locale";
import { executeAuthenticatedGraphQL, executePublicGraphQL } from "@/lib/graphql";

/**
 * Checkout server actions (Track B.4.2).
 *
 * These replace the browser-side urql mutation/query hooks the checkout views used. Checkout
 * mutations carry the static-`sk` `languageCode` (variant C — see `@/lib/checkout-locale`),
 * injected here so callers omit it. Results are returned in a small urql-compatible shape
 * (`{ data?, error? }`) so the existing view call-sites keep reading `result.data?.…` /
 * `result.error`. The payment surface (B.4.4) uses the `{ok}`-shaped actions at the bottom of
 * this file instead — they back the `CheckoutTransport` seam the payment registry drives.
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
const metadataUpdateDoc = toTypedDocument<
	CheckoutMetadataUpdateMutation,
	CheckoutMetadataUpdateMutationVariables
>(CheckoutMetadataUpdateDocument);

/**
 * Durable newsletter-consent record on the checkout (public path — checkout-id-is-credential).
 * Saleor copies checkout metadata onto the order at checkoutComplete, so the consent survives as
 * an auditable record on the order (value, server timestamp, source form, market, locale) visible
 * in the Saleor dashboard. The timestamp is stamped server-side.
 */
export async function updateNewsletterConsentAction(input: {
	checkoutId: string;
	consent: boolean;
	market: string;
	localeSlug: string;
}): Promise<{ ok: boolean }> {
	const record = {
		consent: input.consent,
		at: new Date().toISOString(),
		source: "checkout-information-step",
		market: input.market,
		locale: input.localeSlug,
	};

	const result = await executePublicGraphQL(metadataUpdateDoc, {
		variables: {
			checkoutId: input.checkoutId,
			input: [{ key: "newsletter_consent", value: JSON.stringify(record) }],
		},
		cache: "no-cache",
	});

	if (!result.ok || result.data.updateMetadata?.errors?.length) {
		return { ok: false };
	}

	return { ok: true };
}

/** Live checkout read bypassing the client context cache. */
export async function refreshCheckoutAction(
	checkoutId: string,
	localeSlug?: string,
): Promise<CheckoutFetchResult> {
	return fetchCheckoutOnServer(checkoutId, localeSlug);
}

// Checkout-data mutations are keyed by `checkoutId` — the checkout id IS the credential (the same
// §10-approved public-access rule as the checkout read, B.4.2 D2). They MUST use the public path:
// a guest checkout has no customer session, and the authenticated `fetchWithAuth` path does not
// reliably persist for guests. Only the user/account mutations (customer-attach, set-default-address)
// keep the authenticated path — they are account-scoped, not checkoutId-scoped.
export async function checkoutEmailUpdateAction(
	variables: NoLang<CheckoutEmailUpdateMutationVariables>,
	localeSlug?: string,
) {
	return toResult(
		await executePublicGraphQL(emailUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		}),
	);
}

export async function checkoutShippingAddressUpdateAction(
	variables: NoLang<CheckoutShippingAddressUpdateMutationVariables>,
	localeSlug?: string,
) {
	return toResult(
		await executePublicGraphQL(shippingAddressUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		}),
	);
}

export async function checkoutBillingAddressUpdateAction(
	variables: NoLang<CheckoutBillingAddressUpdateMutationVariables>,
	localeSlug?: string,
) {
	return toResult(
		await executePublicGraphQL(billingAddressUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		}),
	);
}

export async function checkoutDeliveryMethodUpdateAction(
	variables: NoLang<CheckoutDeliveryMethodUpdateMutationVariables>,
	localeSlug?: string,
) {
	return toResult(
		await executePublicGraphQL(deliveryMethodUpdateDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		}),
	);
}

export async function checkoutCustomerAttachAction(
	variables: NoLang<CheckoutCustomerAttachMutationVariables>,
	localeSlug?: string,
) {
	return toResult(
		await executeAuthenticatedGraphQL(customerAttachDoc, {
			variables: { ...variables, ...checkoutGraphqlLocaleVariables(localeSlug) },
			cache: "no-cache",
		}),
	);
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

// ---------------------------------------------------------------------------
// {ok}-shaped payment actions (B.4.4) — the CheckoutTransport surface.
//
// checkoutComplete + the transaction mutations are checkoutId-keyed (the checkout
// id is the guest credential) — same §10-approved public-access rule as the
// checkout-data mutations; a guest has no customer session, so the authenticated
// path silently no-ops for them (see 0039bdf). This deliberately diverges from
// upstream's authenticated path. Guards below are defense in depth against direct
// server-action invocation with disabled gateways or tampered amounts.
// ---------------------------------------------------------------------------

const transactionInitializeDoc = toTypedDocument<
	TransactionInitializeMutation,
	TransactionInitializeMutationVariables
>(TransactionInitializeDocument);
const paymentGatewaysInitializeDoc = toTypedDocument<
	PaymentGatewaysInitializeMutation,
	PaymentGatewaysInitializeMutationVariables
>(PaymentGatewaysInitializeDocument);
const transactionProcessDoc = toTypedDocument<
	TransactionProcessMutation,
	TransactionProcessMutationVariables
>(TransactionProcessDocument);

/**
 * Locale-aware translator for user-facing payment action messages (krok 2A — replaces the
 * hardcoded-SK D1 constants). Explicit `localeSlug` (threaded from the client) wins; without
 * it the market cookie decides (`resolveFallbackLocale`), defaulting to sk-SK. The cookie
 * path matters because the `CheckoutTransport` seam carries no locale parameter.
 * Returned `t` is unscoped — call it with full key paths (`checkout.errors.*` /
 * `checkout.payment.*`).
 */
async function getPaymentActionTranslator(localeSlug?: string) {
	return getTranslations({ locale: await resolveFallbackLocale(localeSlug) });
}

export async function initializePaymentGatewaysAction(
	variables: PaymentGatewaysInitializeMutationVariables,
	localeSlug?: string,
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
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.noSaleorResponse") };
	}

	if (payload.errors?.length) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: payload.errors[0].message ?? t("checkout.payment.gatewayInitFailed") };
	}

	return { ok: true, data: payload };
}

export async function initializeCheckoutTransactionAction(
	variables: TransactionInitializeMutationVariables,
	localeSlug?: string,
): Promise<TransactionInitializeActionResult> {
	// The guards return sk sentinels — translate at this boundary (the guard modules are
	// client-shared and cannot resolve server locale themselves).
	if (getDummyPaymentGuardError(variables.paymentGateway?.id)) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.testPaymentUnavailable") };
	}

	if (getStripePaymentGuardError(variables.paymentGateway?.id)) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.cardPaymentsDisabled") };
	}

	// Defense in depth: never trust the client-supplied amount. Saleor re-validates
	// coverage at checkoutComplete, but rejecting here avoids authorizing a wrong amount.
	if (typeof variables.amount === "number") {
		const live = await fetchCheckoutOnServer(variables.checkoutId);
		if (!live.ok || !live.checkout) {
			const t = await getPaymentActionTranslator(localeSlug);
			return { ok: false, error: t("checkout.errors.totalVerifyFailed") };
		}

		const liveAmount = getCheckoutPayAmount(live.checkout);
		if (liveAmount === null || hasMaterialCheckoutTotalChange(liveAmount, variables.amount)) {
			const t = await getPaymentActionTranslator(localeSlug);
			return { ok: false, error: t("checkout.payment.totalChanged") };
		}
	}

	const result = await executePublicGraphQL(transactionInitializeDoc, { variables, cache: "no-cache" });

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.transactionInitialize;
	if (!payload) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.noSaleorResponse") };
	}

	if (payload.errors?.length) {
		const t = await getPaymentActionTranslator(localeSlug);
		return {
			ok: false,
			error: payload.errors[0].message ?? t("checkout.payment.gateways.paymentInitFailed"),
		};
	}

	return { ok: true, data: payload };
}

export async function processCheckoutTransactionAction(
	variables: TransactionProcessMutationVariables,
	localeSlug?: string,
): Promise<TransactionProcessActionResult> {
	// Mirror the initialize guards: when every integrated gateway is disabled for this
	// environment, a direct call to this action must not drive transactions either.
	if (!isStripePaymentEnabled() && !isDummyPaymentAllowed()) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.paymentsDisabled") };
	}

	const result = await executePublicGraphQL(transactionProcessDoc, { variables, cache: "no-cache" });

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.transactionProcess;
	if (!payload) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.noSaleorResponse") };
	}

	if (payload.errors?.length) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: payload.errors[0].message ?? t("checkout.errors.paymentProcessFailed") };
	}

	return { ok: true, data: payload };
}

export async function runCheckoutCompleteAction(
	checkoutId: string,
	localeSlug?: string,
): Promise<CheckoutCompleteActionResult> {
	const result = await executePublicGraphQL(completeDoc, {
		variables: { checkoutId },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { ok: false, error: result.error.message };
	}

	const payload = result.data.checkoutComplete;
	if (!payload) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.noSaleorResponse") };
	}

	if (payload.errors?.length) {
		const t = await getPaymentActionTranslator(localeSlug);
		const completeOrderFailed = t("checkout.payment.completeOrderFailed");
		return {
			ok: false,
			error: payload.errors[0].message ?? completeOrderFailed,
			fieldErrors: payload.errors.map((error) => ({
				field: error.field,
				message: error.message ?? completeOrderFailed,
				code: error.code,
			})),
		};
	}

	const orderId = payload.order?.id;
	const channelSlug = payload.order?.channel?.slug;
	if (!orderId) {
		const t = await getPaymentActionTranslator(localeSlug);
		return { ok: false, error: t("checkout.errors.orderCreateFailed") };
	}

	// Return orderId for the client `navigateToOrderConfirmation()` — do not `redirect()` here
	// (see @/checkout/lib/navigate-to-order). Cookie clear + cart/chrome revalidation run in
	// `after()` so the client can leave `/checkout?checkout=…` first (B.4.5).
	after(async () => {
		await clearCheckoutCookieByValue(checkoutId);
		if (channelSlug) {
			revalidateStorefrontBrowsePath(channelSlug, "/cart");
			revalidateStorefrontChrome(channelSlug);
		}
	});

	return { ok: true, orderId };
}
