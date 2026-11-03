import "server-only";

import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import { parseB2bInput } from "../b2b-input";
import type { B2bPaymentLockResult } from "../b2b-view";
import { isB2bPaymentLockReleaseStatus } from "../contract";
import type { MakyB2bCheckoutStateQuery, MakyB2bReleasePaymentLockMutation } from "../graphql";
import type { B2bAppResult } from "./b2b-saleor-client";

/**
 * The way out of a started payment (contract revision 2, §0 point 2 and §5 "Obnova po začatej platbe").
 *
 * A started payment keeps the checkout locked while any of its attempts holds money or may still take it; neither
 * time nor a declined card ends that. The same offer can always be paid again. To CHANGE something (company, VAT,
 * address, delivery, lines, promo code) the customer first ends the attempt: `releaseB2bPaymentLock` asks the backend
 * (as the B2B app, server-side only) to cancel the attempts that hold no money, and `readB2bPaymentLock` reads, without
 * the token, whether the lock has gone. The browser lets the customer change anything only once the backend says
 * `paymentLocked: false`. Nothing here refunds, cancels money, or starts a new cart or payment.
 *
 * Every answer is the backend's own status, a boolean and a stable code: never a Saleor message, never the token.
 */

export type PaymentLockDeps = {
	readCheckout: (
		checkoutId: string,
	) => Promise<{ ok: true; checkout: ServerCheckout | null } | { ok: false }>;
	/** The checkout id stored in this browser's cookie for the channel, `null`/empty when there is none. */
	cookieCheckoutId: (channelSlug: string) => Promise<string | null>;
	uiEnabled: () => boolean;
	readiness: () => Promise<{ ok: boolean }>;
	/** `checkoutB2bPaymentLockRelease`, made as the B2B app. */
	release: (checkoutId: string) => Promise<B2bAppResult<MakyB2bReleasePaymentLockMutation>>;
	/** The backend's state, read WITHOUT the app token (public, contract §4). */
	readState: (checkoutId: string) => Promise<B2bAppResult<MakyB2bCheckoutStateQuery>>;
	log?: (cause: string) => void;
};

/**
 * Asks the backend to end the started payment's attempts that hold no money.
 *
 * The same gates as every other write with the B2B app's token: the B2B checkout switched on, a checkout this browser
 * holds (its channel cookie must not name another one), a company input on it (only such a checkout can be locked
 * against a change), and a process whose B2B app access is ready. Then one call; its answer is passed on as it is.
 */
export async function releaseB2bPaymentLock(
	checkoutId: string,
	deps: PaymentLockDeps,
): Promise<B2bPaymentLockResult> {
	const result = await releaseOnce(checkoutId, deps);
	deps.log?.(result.cause);
	return result;
}

async function releaseOnce(checkoutId: string, deps: PaymentLockDeps): Promise<B2bPaymentLockResult> {
	if (!deps.uiEnabled()) return { kind: "unavailable", cause: "ui-disabled" };

	const read = await deps.readCheckout(checkoutId);
	if (!read.ok) return { kind: "failed", cause: "checkout-read-failed" };
	const checkout = read.checkout;
	if (!checkout) return { kind: "failed", cause: "checkout-not-found" };

	// The same capability as the checkout page: the id is the credential, and a browser whose channel cookie names a
	// different checkout is not acting for this one.
	const cookieId = await deps.cookieCheckoutId(checkout.channel.slug);
	if (cookieId && cookieId !== checkoutId) return { kind: "unavailable", cause: "checkout-access-denied" };

	// A checkout without the company input is never locked against a change (the backend guards only a managed one),
	// so there is nothing to release for it with the app's token.
	if (!parseB2bInput(checkout.b2bInput)) return { kind: "unavailable", cause: "no-input" };

	if (!(await deps.readiness()).ok) return { kind: "unavailable", cause: "not-ready" };

	const released = await deps.release(checkoutId);
	if (!released.ok) return { kind: "failed", cause: `release-${released.error.kind}` };
	const payload = released.data.checkoutB2bPaymentLockRelease;
	if (!payload) return { kind: "failed", cause: "release-no-payload" };
	if (payload.errors.length) {
		// NOT_FOUND or GRAPHQL_ERROR: the customer is offered the original order or the shop, never a guess.
		return { kind: "failed", cause: `release-error-${payload.errors[0]?.code ?? "unknown"}` };
	}
	if (!isB2bPaymentLockReleaseStatus(payload.status)) return { kind: "failed", cause: "release-no-status" };

	const locked = payload.checkout?.b2bTaxState?.paymentLocked;
	return {
		kind: "release",
		status: payload.status,
		paymentLocked: typeof locked === "boolean" ? locked : null,
		cause: `release-${payload.status}`,
	};
}

/**
 * Is the checkout still locked? A public read of `b2bTaxState.paymentLocked` (no token, nothing written), for the
 * wait after `CANCELATION_REQUESTED`.
 */
export async function readB2bPaymentLock(
	checkoutId: string,
	deps: Pick<PaymentLockDeps, "uiEnabled" | "readState" | "log">,
): Promise<B2bPaymentLockResult> {
	if (!deps.uiEnabled()) return { kind: "unavailable", cause: "ui-disabled" };
	const state = await deps.readState(checkoutId);
	if (!state.ok) {
		const cause = `state-read-${state.error.kind}`;
		deps.log?.(cause);
		return { kind: "failed", cause };
	}
	const checkout = state.data.checkout;
	if (!checkout) return { kind: "failed", cause: "checkout-not-found" };
	const locked = checkout.b2bTaxState?.paymentLocked;
	if (typeof locked !== "boolean") return { kind: "failed", cause: "state-missing" };
	return { kind: "state", paymentLocked: locked, cause: locked ? "still-locked" : "unlocked" };
}
