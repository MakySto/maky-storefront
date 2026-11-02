/**
 * MAKY-B2B-V1 — the storefront side of the contract shared with the Saleor backend patch.
 *
 * Source: `02_MAKY_Storefront_4_5_B2B_Zadanie.md` §1 "Spoločný kontrakt MAKY-B2B-V1" (2026-11-02), identical in
 * the backend brief. The GraphQL pieces it names (`checkoutB2bTaxAttestationUpdate`, `Checkout.b2bTaxState`) are a
 * PROPOSAL the backend implements; they do not exist in Saleor 3.23.31. Until the backend hands over its generated
 * schema, the documents that use them live in `./graphql.ts`, outside the codegen glob, and are validated against
 * `./maky-b2b-v1.graphql` (the proposed SDL) by `graphql.test.ts`. A rename on either side is written into both
 * handoffs first.
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
 * Codes the backend adds to the EXISTING payment/address/metadata mutations' error enums (backend brief §3.4).
 * Compared as strings: Saleor 3.23.31's generated `CheckoutErrorCode` does not know them yet.
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
