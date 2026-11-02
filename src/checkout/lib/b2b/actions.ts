"use server";

import { CheckoutMetadataUpdateDocument } from "@/checkout/graphql";
import type {
	CheckoutMetadataUpdateMutation,
	CheckoutMetadataUpdateMutationVariables,
} from "@/checkout/graphql";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { executePublicGraphQL } from "@/lib/graphql";

import { b2bInputMetadataEntry, parseB2bInput, serializeB2bInput } from "./b2b-input";
import type { B2bEvaluationView, B2bSaveResult } from "./b2b-view";
import { isCheckoutLockedCode, isTaxContextChangedCode, type B2bInputV1 } from "./contract";
import { countryOfVatId, normalizeVatId } from "./vat-id";
import { admitB2bAction, isPlausibleCheckoutId } from "./server/action-gate";
import { isB2bCheckoutUiEnabled } from "./server/b2b-config";
import { evaluateB2b, type EvaluateB2bMode } from "./server/evaluate-b2b";
import { productionEvaluateB2bDeps } from "./server/evaluate-b2b-deps";

/**
 * The B2B server actions the checkout views call. Next's server actions check the Origin header (same-origin) on
 * every call; nothing here is reachable cross-site.
 *
 * The browser gets a summary and the public checkout quote — never the token, never the private attestation, never
 * a Saleor error message.
 */

const metadataUpdateDoc = toTypedDocument<
	CheckoutMetadataUpdateMutation,
	CheckoutMetadataUpdateMutationVariables
>(CheckoutMetadataUpdateDocument);

/** Re-checks on the server what the form checked in the browser: shape, lengths, a VAT ID in canonical form. */
function acceptInput(value: unknown): B2bInputV1 | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Partial<B2bInputV1>;
	let serialized: string;
	try {
		serialized = serializeB2bInput({
			schema: 1,
			isBusiness: candidate.isBusiness as boolean,
			registrationId: candidate.registrationId as string,
			taxId: candidate.taxId as string,
			vatId: candidate.vatId as string,
		});
	} catch {
		return null;
	}
	const input = parseB2bInput(serialized);
	if (!input) return null;
	if (!input.isBusiness) {
		// Leaving the company purchase keeps nothing of it: the backend sees "not a company", not stale numbers.
		return { schema: 1, isBusiness: false, registrationId: "", taxId: "", vatId: "" };
	}
	if (input.vatId) {
		const normalized = normalizeVatId(input.vatId, countryOfVatId(input.vatId));
		if (!normalized.ok || normalized.vatId !== input.vatId) return null;
	}
	return input;
}

/**
 * Stores the customer's company input in the checkout's public metadata (`maky.b2b.input.v1`) — the same public,
 * checkout-id-keyed path as the newsletter consent. Input only: it is never proof of anything, and the backend
 * derives its context from it plus the stored addresses.
 */
export async function saveB2bInputAction(params: {
	checkoutId: string;
	input: unknown;
}): Promise<B2bSaveResult> {
	if (!isB2bCheckoutUiEnabled()) return { ok: false, code: "DISABLED" };
	if (!isPlausibleCheckoutId(params.checkoutId)) return { ok: false, code: "INVALID" };
	const input = acceptInput(params.input);
	if (!input) return { ok: false, code: "INVALID" };
	if (!admitB2bAction(params.checkoutId)) return { ok: false, code: "RATE_LIMITED" };

	const result = await executePublicGraphQL(metadataUpdateDoc, {
		variables: { checkoutId: params.checkoutId, input: [b2bInputMetadataEntry(input)] },
		cache: "no-cache",
	});
	if (!result.ok) return { ok: false, code: "FAILED" };
	const errors = result.data.updateMetadata?.errors ?? [];
	if (errors.some((error) => isCheckoutLockedCode(error.code))) return { ok: false, code: "CHECKOUT_LOCKED" };
	if (errors.some((error) => isTaxContextChangedCode(error.code)))
		return { ok: false, code: "CONTEXT_CHANGED" };
	if (errors.length) return { ok: false, code: "FAILED" };
	return { ok: true };
}

/**
 * Runs evaluateB2B for the checkout and returns the outcome with the consistent quote. `mode: "confirm"` reuses
 * the backend's record where it still answers for the current context (payment step).
 */
export async function evaluateB2bAction(params: {
	checkoutId: string;
	localeSlug?: string;
	mode?: EvaluateB2bMode;
}): Promise<B2bEvaluationView> {
	if (!isPlausibleCheckoutId(params.checkoutId)) {
		return {
			outcome: { kind: "unconfirmed" },
			checkout: null,
			vies: null,
			exemptionAvailable: false,
			cause: "invalid",
		};
	}
	if (!admitB2bAction(params.checkoutId)) {
		return {
			outcome: { kind: "unconfirmed" },
			checkout: null,
			vies: null,
			exemptionAvailable: false,
			cause: "rate-limited",
		};
	}
	const mode: EvaluateB2bMode = params.mode === "confirm" ? "confirm" : "evaluate";
	return evaluateB2b(
		{ checkoutId: params.checkoutId, mode },
		productionEvaluateB2bDeps(typeof params.localeSlug === "string" ? params.localeSlug : undefined),
	);
}
