import "server-only";

import { parseRequesterVatId, VIES_DEFAULT_BASE_URL, type ViesRequester } from "./vies-client";

/**
 * Server runtime settings of the B2B checkout. Read at request time (not inlined), so a PM2 restart after
 * `sync-secrets.sh` or a `.env` change takes effect without a rebuild.
 *
 * | Variable                  | Owner / meaning                                                              |
 * | ------------------------- | ---------------------------------------------------------------------------- |
 * | `B2B_CHECKOUT_UI_ENABLED` | storefront; `true` shows the company block. Default off. Not the backend's   |
 * |                           | authority: `MAKY_B2B_VAT_EXEMPTION_MODE` on the backend decides new grants.   |
 * | `SALEOR_B2B_APP_TOKEN`    | storefront server only, from SSM `/maky/storefront/saleor/b2b-app-token`.     |
 * |                           | Never `NEXT_PUBLIC_*`, never the existing `SALEOR_APP_TOKEN` (that one        |
 * |                           | changes the build's channel discovery).                                       |
 * | `MAKY_VAT_ID`             | the seller's VAT ID as the VIES requester, so VIES returns a request id.     |
 * | `VIES_REST_BASE_URL`      | optional override of the official VIES REST base URL.                        |
 */

export type B2bRuntimeConfig = {
	uiEnabled: boolean;
	hasAppToken: boolean;
	requester: ViesRequester | null;
	viesBaseUrl: string;
};

/** Only the literal `true` switches it on — a typo stays off, which is the safe direction. */
export function isB2bCheckoutUiEnabled(): boolean {
	return process.env.B2B_CHECKOUT_UI_ENABLED?.trim().toLowerCase() === "true";
}

export function readB2bRuntimeConfig(): B2bRuntimeConfig {
	const base = process.env.VIES_REST_BASE_URL?.trim();
	return {
		uiEnabled: isB2bCheckoutUiEnabled(),
		hasAppToken: Boolean(b2bAppToken()),
		requester: parseRequesterVatId(process.env.MAKY_VAT_ID),
		viesBaseUrl: base && /^https:\/\//.test(base) ? base : VIES_DEFAULT_BASE_URL,
	};
}

/**
 * The B2B app token, for `b2b-saleor-client.ts` ONLY. Not exported from any module the client can import; never
 * logged, never returned, never put into an error message.
 */
export function b2bAppToken(): string | null {
	const token = process.env.SALEOR_B2B_APP_TOKEN?.trim();
	return token ? token : null;
}
