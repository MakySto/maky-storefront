/**
 * MAKY-B2B-V1 — the storefront side of the contract shared with the Saleor backend patch.
 *
 * Source: `MAKY-B2B-V1-CONTRACT.md` of MakySto/maky-saleor (revision 2, 2026-11-02; backend PR #16). The GraphQL
 * pieces it names (`Checkout.b2bTaxState`, `checkoutB2bTaxAttestationUpdate`, `checkoutB2bPaymentLockRelease`) are
 * fork-only: they do not exist in Saleor 3.23.31. The documents that use them live in `./graphql.ts`, outside the
 * codegen glob, and are validated by `graphql.test.ts` against `./maky-b2b-v1.graphql`, which
 * `scripts/b2b-schema-extension.mjs` generates from the backend's committed schema. A rename on either side is
 * written into both handoffs first.
 *
 * Client-safe: no token, no environment, no I/O. The browser gets only `B2bClientState` (an outcome summary).
 */

/** Public checkout metadata key holding the customer's input. Input only — never proof of anything. */
export const B2B_INPUT_METADATA_KEY = "maky.b2b.input.v1";

/** `maky.b2b.input.v1` — numbers travel as strings, never as JavaScript numbers (leading zeros, letters). */
export type B2bInputV1 = {
	schema: 1;
	isBusiness: boolean;
	/** IČO — required for a Slovak invoiced company, else may be empty. */
	registrationId: string;
	/** DIČ — optional. */
	taxId: string;
	/** Full normalized VAT number including its VIES prefix (`DE123456789`, `ATU12345678`), or "". */
	vatId: string;
};

/** `B2bVatVerificationStatus` in the proposed SDL. */
export type B2bVatVerificationStatus = "VALID" | "INVALID" | "UNAVAILABLE";

/** `decision` of `b2bTaxState` — the backend's verdict, mapped by code, never by translated text. */
export const B2B_DECISIONS = [
	"EXEMPT",
	"TAXED_NOT_COMPANY",
	"TAXED_NO_VAT_ID",
	"TAXED_SK_VAT",
	"TAXED_DOMESTIC_DELIVERY",
	"TAXED_COUNTRY_MISMATCH",
	"TAXED_UNVERIFIED",
	"TAXED_INVALID",
	"TAXED_UNAVAILABLE",
	"TAXED_IDENTITY_REVIEW",
	"TAXED_STALE",
	"TAXED_DISABLED",
	"OUT_OF_SCOPE",
] as const;

export type B2bDecision = (typeof B2B_DECISIONS)[number];

export function isB2bDecision(value: unknown): value is B2bDecision {
	return typeof value === "string" && (B2B_DECISIONS as readonly string[]).includes(value);
}

/**
 * `status` of `checkoutB2bPaymentLockRelease` (contract revision 2, §5 "Obnova po začatej platbe"):
 *
 * - `RELEASED` — no attempt can take money any more; the checkout may be changed again;
 * - `CANCELATION_REQUESTED` — attempts without money were asked to cancel through the payment app; the lock ends when
 *   the app confirms (`b2bTaxState.paymentLocked` turns false), not before;
 * - `ATTEMPT_BEING_CREATED` — a `transactionInitialize` is still running; ask again in a few seconds;
 * - `PAYMENT_HAS_FUNDS` — money is authorized, charged or pending: no change is offered, the order is finished on the
 *   original offer. The backend never refunds or cancels money for this, and neither does the storefront.
 */
export const B2B_PAYMENT_LOCK_RELEASE_STATUSES = [
	"RELEASED",
	"CANCELATION_REQUESTED",
	"ATTEMPT_BEING_CREATED",
	"PAYMENT_HAS_FUNDS",
] as const;

export type B2bPaymentLockReleaseStatus = (typeof B2B_PAYMENT_LOCK_RELEASE_STATUSES)[number];

export function isB2bPaymentLockReleaseStatus(value: unknown): value is B2bPaymentLockReleaseStatus {
	return (
		typeof value === "string" && (B2B_PAYMENT_LOCK_RELEASE_STATUSES as readonly string[]).includes(value)
	);
}

/** Error codes of `checkoutB2bTaxAttestationUpdate` the storefront acts on (minimum set from the contract). */
export const B2B_ATTESTATION_ERROR_CODES = [
	"STALE_CONTEXT",
	"INVALID_ATTESTATION",
	"CHECKOUT_LOCKED",
	"UNMANAGED_EXEMPTION_CONFLICT",
	"NOT_FOUND",
] as const;

export type B2bAttestationErrorCode = (typeof B2B_ATTESTATION_ERROR_CODES)[number];

/**
 * Codes the backend adds to the EXISTING mutations' error enums (contract §0 and §8). Compared as strings: Saleor
 * 3.23.31's generated `CheckoutErrorCode` does not know them.
 *
 * `B2B_CHECKOUT_LOCKED` answers a change during an active payment snapshot: addresses, delivery, the company input,
 * lines and quantities (`checkoutLinesAdd/Update/Delete`, `checkoutLineDelete`) and promo codes
 * (`checkoutAddPromoCode`/`checkoutRemovePromoCode`, `field` = `promoCode`). It is a payment state, never a bad field;
 * the way out is `checkoutB2bPaymentLockRelease`. `B2B_TAX_CONTEXT_CHANGED` at `checkoutComplete` means the order
 * would differ from the confirmed offer (also when more was paid): no order was created.
 */
export const B2B_TAX_CONTEXT_CHANGED = "B2B_TAX_CONTEXT_CHANGED";
export const B2B_CHECKOUT_LOCKED = "B2B_CHECKOUT_LOCKED";

/** Any error code that means "a payment for this checkout is in progress" — a payment state, not a bad field. */
export function isCheckoutLockedCode(code: unknown): boolean {
	const value = typeof code === "string" ? code : code == null ? "" : String(code);
	return value === B2B_CHECKOUT_LOCKED || value === "CHECKOUT_LOCKED";
}

/** Any error code that means "the tax context moved under you" — refresh, do not show a field error. */
export function isTaxContextChangedCode(code: unknown): boolean {
	const value = typeof code === "string" ? code : code == null ? "" : String(code);
	return value === B2B_TAX_CONTEXT_CHANGED || value === "STALE_CONTEXT";
}

/**
 * Markets the automated § 43 workflow can apply to: the EU channels. `us-usd` and `ca-cad` are export markets and
 * stay entirely outside this logic (no VIES, no attestation call, existing tax regime unchanged).
 */
export const B2B_EU_CHANNELS: readonly string[] = [
	"sk-eur",
	"at-eur",
	"cz-czk",
	"de-eur",
	"es-eur",
	"fr-eur",
	"hu-huf",
	"it-eur",
	"pl-pln",
	"ro-ron",
];

export const B2B_EXPORT_CHANNELS: readonly string[] = ["us-usd", "ca-cad"];

export function isB2bEuChannel(channelSlug: string | null | undefined): boolean {
	return !!channelSlug && B2B_EU_CHANNELS.includes(channelSlug);
}

/** The seller's home country. Goods leave from Slovakia in this model. */
export const SELLER_COUNTRY = "SK";

/**
 * What the browser is told about the B2B outcome. A summary, never the private attestation.
 *
 * - `exempt` — the backend decided EXEMPT and its effective flag is on: the totals shown are without VAT.
 * - `taxed` — normal VAT applies; `reason` says why, so the UI can pick the right sentence.
 * - `unconfirmed` — the final state could not be confirmed (write or recalculation failed). No payment.
 * - `changed` — the context moved while we worked (STALE_CONTEXT twice). Review and try again.
 * - `locked` — a payment for this checkout is already in progress.
 * - `off` — the workflow does not apply (UI disabled, export market, not a company).
 */
export type B2bUiOutcome =
	| { kind: "off" }
	| { kind: "exempt"; checkedAt: string | null; expiresAt: string | null }
	| {
			kind: "taxed";
			reason: B2bTaxedReason;
			/** True when the customer asked for an exemption we could not grant: they confirm the taxed total. */
			needsTaxedConfirmation: boolean;
	  }
	| { kind: "unconfirmed" }
	| { kind: "changed" }
	| { kind: "locked" };

export type B2bTaxedReason =
	| "invalid"
	| "unavailable"
	| "country_mismatch"
	| "identity_review"
	| "sk_vat"
	| "domestic_delivery"
	| "no_vat_id"
	| "not_company"
	| "incomplete"
	| "disabled";

/** What a server action returns to the browser after an evaluation. */
export type B2bClientState = {
	outcome: B2bUiOutcome;
	/** Monotonic per evaluation, so a late answer can be told from a fresh one. */
	evaluatedAt: number;
};
