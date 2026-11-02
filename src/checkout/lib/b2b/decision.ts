import {
	isB2bDecision,
	isB2bEuChannel,
	SELLER_COUNTRY,
	type B2bInputV1,
	type B2bTaxedReason,
	type B2bUiOutcome,
} from "./contract";
import { countryOfVatId } from "./vat-id";

/**
 * Two pure questions, no I/O:
 *
 * 1. `planB2bEvaluation` — does this checkout need a VIES answer, or only a revocation, or nothing at all?
 *    This only decides whether to SPEND a VIES call. The backend decides the exemption; a "verify" here grants
 *    nothing.
 * 2. `outcomeFromBackendState` — what the browser should say about the backend's decision.
 */

export type B2bDeliveryKind = "shipping" | "pickup" | "none";

export type B2bEvaluationContext = {
	channelSlug: string;
	input: B2bInputV1 | null;
	billingCompanyName: string | null | undefined;
	/** ISO code of the stored shipping address, if any. */
	shippingCountry: string | null | undefined;
	deliveryKind: B2bDeliveryKind;
};

export type B2bEvaluationPlan =
	/** Export market or no B2B input at all: the workflow does not apply and nothing is sent. */
	| { kind: "skip" }
	/** No automatic exemption is possible: revoke any previous approval (`verification: null`). */
	| { kind: "revoke"; reason: B2bTaxedReason }
	/** An exemption may be possible: get a VIES answer for exactly this number. */
	| { kind: "verify"; vatId: string; vatCountry: string };

export function planB2bEvaluation(context: B2bEvaluationContext): B2bEvaluationPlan {
	if (!isB2bEuChannel(context.channelSlug)) return { kind: "skip" };
	const input = context.input;
	if (!input) return { kind: "skip" };

	if (!input.isBusiness) return { kind: "revoke", reason: "not_company" };
	if (!context.billingCompanyName?.trim()) return { kind: "revoke", reason: "incomplete" };
	if (!input.vatId) return { kind: "revoke", reason: "no_vat_id" };

	const vatCountry = countryOfVatId(input.vatId);
	if (!vatCountry) return { kind: "revoke", reason: "incomplete" };
	if (vatCountry === SELLER_COUNTRY) return { kind: "revoke", reason: "sk_vat" };

	if (context.deliveryKind === "pickup") return { kind: "revoke", reason: "domestic_delivery" };
	const shippingCountry = context.shippingCountry?.toUpperCase();
	if (!shippingCountry) return { kind: "revoke", reason: "incomplete" };
	if (shippingCountry === SELLER_COUNTRY) return { kind: "revoke", reason: "domestic_delivery" };
	// Same country of VAT ID and delivery is a limit of THIS automation, not a legal condition of § 43.
	if (shippingCountry !== vatCountry) return { kind: "revoke", reason: "country_mismatch" };

	// A missing delivery method is not a reason to withhold the VIES answer: the customer learns about a wrong
	// number on the first step, and the backend decides "incomplete" until the method is chosen.
	return { kind: "verify", vatId: input.vatId, vatCountry };
}

const TAXED_REASON_BY_DECISION: Readonly<Record<string, { reason: B2bTaxedReason; confirm: boolean }>> = {
	TAXED_INVALID: { reason: "invalid", confirm: true },
	TAXED_UNAVAILABLE: { reason: "unavailable", confirm: true },
	TAXED_IDENTITY_REVIEW: { reason: "identity_review", confirm: true },
	// The shop does not grant new exemptions right now; the customer typed a VAT ID expecting one.
	TAXED_DISABLED: { reason: "disabled", confirm: true },
	TAXED_COUNTRY_MISMATCH: { reason: "country_mismatch", confirm: false },
	TAXED_SK_VAT: { reason: "sk_vat", confirm: false },
	TAXED_DOMESTIC_DELIVERY: { reason: "domestic_delivery", confirm: false },
	TAXED_NO_VAT_ID: { reason: "no_vat_id", confirm: false },
	TAXED_UNVERIFIED: { reason: "incomplete", confirm: false },
};

export type BackendTaxState = {
	decision: string;
	effectiveTaxExemption: boolean;
	checkedAt: string | null;
	expiresAt: string | null;
};

/**
 * The backend's verdict, as the browser may state it.
 *
 * "Bez DPH" is said only when the backend says EXEMPT AND its effective flag is on. Any disagreement between the
 * two is not resolved in the storefront's favour — it is `unconfirmed`, and no payment starts on it. A zero tax
 * amount alone is never read as § 43 (export, a 100 % discount and a zero price all show tax 0).
 */
export function outcomeFromBackendState(state: BackendTaxState | null | undefined): B2bUiOutcome {
	if (!state || !isB2bDecision(state.decision)) return { kind: "unconfirmed" };
	const { decision, effectiveTaxExemption } = state;

	if (decision === "EXEMPT") {
		return effectiveTaxExemption
			? { kind: "exempt", checkedAt: state.checkedAt, expiresAt: state.expiresAt }
			: { kind: "unconfirmed" };
	}
	if (effectiveTaxExemption) return { kind: "unconfirmed" };

	if (decision === "OUT_OF_SCOPE" || decision === "TAXED_NOT_COMPANY") return { kind: "off" };
	// A previous approval no longer matches: the caller re-evaluates; if it is still stale, the customer reviews.
	if (decision === "TAXED_STALE") return { kind: "changed" };

	const taxed = TAXED_REASON_BY_DECISION[decision];
	return taxed
		? { kind: "taxed", reason: taxed.reason, needsTaxedConfirmation: taxed.confirm }
		: { kind: "unconfirmed" };
}

/** The outcome is something a payment may start on (after the customer confirmed a taxed total, where needed). */
export function outcomeAllowsPayment(outcome: B2bUiOutcome): boolean {
	return outcome.kind === "off" || outcome.kind === "exempt" || outcome.kind === "taxed";
}

/** Whether the outcome is a positive B2B approval that has run out by `now` (the 24 h of the original check). */
export function isExemptionExpired(state: BackendTaxState, now: number, marginMs = 60_000): boolean {
	if (!state.expiresAt) return true;
	const expires = Date.parse(state.expiresAt);
	return !Number.isFinite(expires) || expires - marginMs <= now;
}
