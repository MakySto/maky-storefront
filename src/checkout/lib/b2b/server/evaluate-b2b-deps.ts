import "server-only";

import { fetchCheckoutOnServer } from "@/checkout/lib/server/fetch-checkout";
import * as Checkout from "@/lib/checkout";

import {
	MakyB2bApplyVerificationDocument,
	MakyB2bCheckoutStateDocument,
	MakyB2bReleasePaymentLockDocument,
} from "../graphql";
import { isB2bCheckoutUiEnabled, readB2bRuntimeConfig } from "./b2b-config";
import { checkB2bReadiness } from "./b2b-readiness";
import { executeB2bAppGraphQL, executeB2bPublicGraphQL } from "./b2b-saleor-client";
import type { EvaluateB2bDeps } from "./evaluate-b2b";
import type { PaymentLockDeps } from "./payment-lock";
import { cachedViesCheck } from "./vies-cache";
import { checkVatNumber } from "./vies-client";

/** A read that waits longer than this is answered `unconfirmed` and the customer can try again. */
const STATE_READ_DEADLINE_MS = 10_000;
/** The write is one backend transaction plus a recalculation of the quote. */
const ATTESTATION_DEADLINE_MS = 15_000;
/** One backend transaction; the payment app hears of the cancelation afterwards (Celery), not inside it. */
const RELEASE_DEADLINE_MS = 15_000;

/** The production wiring of `evaluateB2b`. Tests build their own `EvaluateB2bDeps`. */
export function productionEvaluateB2bDeps(localeSlug?: string): EvaluateB2bDeps {
	const config = readB2bRuntimeConfig();
	return {
		readCheckout: (checkoutId) => fetchCheckoutOnServer(checkoutId, localeSlug),
		cookieCheckoutId: async (channelSlug) => (await Checkout.getIdFromCookies(channelSlug)) || null,
		uiEnabled: isB2bCheckoutUiEnabled,
		readiness: () => checkB2bReadiness(),
		// Public, without the token (contract §4): so the state is read, and stated, also when the app's access is not
		// ready. Only the attestation below is made as the app.
		readState: (checkoutId) =>
			executeB2bPublicGraphQL(
				MakyB2bCheckoutStateDocument,
				{ id: checkoutId },
				{ signal: AbortSignal.timeout(STATE_READ_DEADLINE_MS) },
			),
		applyAttestation: (checkoutId, input) =>
			executeB2bAppGraphQL(
				MakyB2bApplyVerificationDocument,
				{ id: checkoutId, input },
				{ signal: AbortSignal.timeout(ATTESTATION_DEADLINE_MS) },
			),
		verifyVatId: async (vatId, checkoutId) =>
			(
				await cachedViesCheck({
					vatId,
					checkoutId,
					check: () => checkVatNumber({ vatId, requester: config.requester, baseUrl: config.viesBaseUrl }),
				})
			).result,
		now: Date.now,
		// Only the outcome code: no checkout id (it is the guest's credential), no VAT number, no company.
		log: (cause) => {
			if (!cause.startsWith("reused-") && cause !== "no-input" && cause !== "export-market") {
				console.info(`[b2b] ${cause}`);
			}
		},
	};
}

/** The production wiring of `releaseB2bPaymentLock` / `readB2bPaymentLock`. Tests build their own `PaymentLockDeps`. */
export function productionPaymentLockDeps(localeSlug?: string): PaymentLockDeps {
	return {
		readCheckout: (checkoutId) => fetchCheckoutOnServer(checkoutId, localeSlug),
		cookieCheckoutId: async (channelSlug) => (await Checkout.getIdFromCookies(channelSlug)) || null,
		uiEnabled: isB2bCheckoutUiEnabled,
		readiness: () => checkB2bReadiness(),
		release: (checkoutId) =>
			executeB2bAppGraphQL(
				MakyB2bReleasePaymentLockDocument,
				{ id: checkoutId },
				{ signal: AbortSignal.timeout(RELEASE_DEADLINE_MS) },
			),
		readState: (checkoutId) =>
			executeB2bPublicGraphQL(
				MakyB2bCheckoutStateDocument,
				{ id: checkoutId },
				{ signal: AbortSignal.timeout(STATE_READ_DEADLINE_MS) },
			),
		// Only the outcome code: no checkout id (it is the guest's credential). The polls say nothing unless they fail.
		log: (cause) => console.info(`[b2b] payment-lock ${cause}`),
	};
}
