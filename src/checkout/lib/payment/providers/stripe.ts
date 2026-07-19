import { type PaymentGatewayLike } from "../types";

/**
 * Saleor Stripe app gateway id (v2).
 * @see https://docs.saleor.io/developer/app-store/apps/stripe
 *
 * B.4.4 (MAKY): PREDICATES-ONLY trim of the upstream provider module — the registry needs the
 * id/env predicates; the config/transaction parsers and payment-method resolver arrive with the
 * Stripe UI adoption (B.8). Verified against the live sk-eur checkout contract 2026-07-18:
 * availablePaymentGateways = [{ id: "saleor.app.payment.stripe", name: "Stripe",
 * currencies: ["EUR"], config: [] }] — the id is the app manifest identifier (stable across
 * app reinstalls), not the installation-specific App global id.
 */
export const STRIPE_GATEWAY_ID = "saleor.app.payment.stripe";

/** Shown when Stripe is on the checkout but the storefront flag is off. */
export const STRIPE_PAYMENT_NOT_ENABLED_MESSAGE =
	"Platby kartou nie sú v tomto prostredí povolené.";

export function isStripeGateway(gatewayId: string): boolean {
	return gatewayId === STRIPE_GATEWAY_ID;
}

export function findStripeGateway(
	gateways: ReadonlyArray<PaymentGatewayLike> | null | undefined,
): PaymentGatewayLike | undefined {
	return gateways?.find((gateway) => isStripeGateway(gateway.id));
}

/**
 * Stripe Elements checkout — opt-in via env (required on cloud/staging where NODE_ENV is production).
 * Publishable keys come from Saleor's paymentGatewayInitialize, not from env.
 */
export function isStripePaymentEnabled(): boolean {
	if (process.env.ENABLE_STRIPE_PAYMENTS === "true") {
		return true;
	}
	if (process.env.NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS === "true") {
		return true;
	}
	return process.env.NODE_ENV === "development";
}

/** Payment-step wallet buttons (Apple Pay / Google Pay / Link). Opt out with `false`. */
export function isStripeExpressCheckoutEnabled(): boolean {
	if (!isStripePaymentEnabled()) {
		return false;
	}

	if (process.env.NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT === "false") {
		return false;
	}

	return true;
}

/**
 * Server-side guard for transactionInitialize — blocks Stripe when the storefront flag is off.
 */
export function getStripePaymentGuardError(gatewayId: string | null | undefined): string | null {
	if (!gatewayId || !isStripeGateway(gatewayId)) {
		return null;
	}
	if (isStripePaymentEnabled()) {
		return null;
	}
	return STRIPE_PAYMENT_NOT_ENABLED_MESSAGE;
}
