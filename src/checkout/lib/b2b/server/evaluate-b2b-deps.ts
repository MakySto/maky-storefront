import "server-only";

import { fetchCheckoutOnServer } from "@/checkout/lib/server/fetch-checkout";
import * as Checkout from "@/lib/checkout";

import { MakyB2bApplyVerificationDocument, MakyB2bCheckoutStateDocument } from "../graphql";
import { isB2bCheckoutUiEnabled, readB2bRuntimeConfig } from "./b2b-config";
import { checkB2bReadiness } from "./b2b-readiness";
import { executeB2bAppGraphQL } from "./b2b-saleor-client";
import type { EvaluateB2bDeps } from "./evaluate-b2b";
import { cachedViesCheck } from "./vies-cache";
import { checkVatNumber } from "./vies-client";

/** A read that waits longer than this is answered `unconfirmed` and the customer can try again. */
const STATE_READ_DEADLINE_MS = 10_000;
/** The write is one backend transaction plus a recalculation of the quote. */
const ATTESTATION_DEADLINE_MS = 15_000;

/** The production wiring of `evaluateB2b`. Tests build their own `EvaluateB2bDeps`. */
export function productionEvaluateB2bDeps(localeSlug?: string): EvaluateB2bDeps {
	const config = readB2bRuntimeConfig();
	return {
		readCheckout: (checkoutId) => fetchCheckoutOnServer(checkoutId, localeSlug),
		cookieCheckoutId: async (channelSlug) => (await Checkout.getIdFromCookies(channelSlug)) || null,
		uiEnabled: isB2bCheckoutUiEnabled,
		readiness: () => checkB2bReadiness(),
		readState: (checkoutId) =>
			executeB2bAppGraphQL(
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
