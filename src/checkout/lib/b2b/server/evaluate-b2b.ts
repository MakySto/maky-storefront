import "server-only";

import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import { parseB2bInput } from "../b2b-input";
import type { B2bEvaluationView } from "../b2b-view";
import {
	isB2bEuChannel,
	isCheckoutLockedCode,
	isTaxContextChangedCode,
	type B2bUiOutcome,
} from "../contract";
import {
	isExemptionExpired,
	outcomeFromBackendState,
	planB2bEvaluation,
	type B2bDeliveryKind,
	type B2bEvaluationPlan,
} from "../decision";
import type {
	B2bCheckoutTotals,
	B2bTaxStateFields,
	CheckoutB2bTaxAttestationInput,
	MakyB2bApplyVerificationMutation,
	MakyB2bCheckoutStateQuery,
} from "../graphql";
import type { B2bAppResult } from "./b2b-saleor-client";
import type { ViesResult } from "./vies-client";

/**
 * evaluateB2B — the storefront half of MAKY-B2B-V1 (zadanie 02, §3 "Algoritmus evaluateB2B").
 *
 * Everything the decision rests on is read on the server from Saleor: the B2B input (public metadata), the billing
 * company, the shipping country, the delivery method and the backend's `contextVersion`. The browser sends nothing
 * but the checkout id, so it cannot point a VIES answer at a number the checkout does not carry.
 *
 * The storefront never decides an exemption. It sends the VIES answer (or a revocation) with the version it read,
 * and states what the backend then says. Whenever that cannot be established — a failed read or write, a lock, an
 * inconsistent total — the outcome is `unconfirmed` or `locked`, and no payment may start on it.
 *
 * Two states write nothing: a started payment (`paymentLocked`, the backend refuses every change until it ends) and
 * a process whose B2B app access is not ready. In both the backend's own decision is read (publicly: the state is a
 * field of the checkout like any other) and stated as it stands; it is never replaced by "off".
 */

export type EvaluateB2bMode =
	/** After a customer action (company toggled, VAT ID or address saved, delivery chosen, "verify again"). */
	| "evaluate"
	/**
	 * Before a payment (and when the payment step opens): the backend's protected record is reused where it still
	 * answers for the current context, so VIES is not asked again and a taxed total the customer has already
	 * accepted does not change under them.
	 */
	| "confirm";

export type EvaluateB2bResult = B2bEvaluationView;

export type EvaluateB2bDeps = {
	readCheckout: (
		checkoutId: string,
	) => Promise<{ ok: true; checkout: ServerCheckout | null } | { ok: false }>;
	/** The checkout id stored in this browser's cookie for the channel, `null`/empty when there is none. */
	cookieCheckoutId: (channelSlug: string) => Promise<string | null>;
	uiEnabled: () => boolean;
	readiness: () => Promise<{ ok: boolean }>;
	/** The backend's state, read WITHOUT the app token (public, contract §4). */
	readState: (checkoutId: string) => Promise<B2bAppResult<MakyB2bCheckoutStateQuery>>;
	applyAttestation: (
		checkoutId: string,
		input: CheckoutB2bTaxAttestationInput,
	) => Promise<B2bAppResult<MakyB2bApplyVerificationMutation>>;
	verifyVatId: (vatId: string, checkoutId: string) => Promise<ViesResult>;
	now: () => number;
	log?: (cause: string) => void;
};

/** Decisions that come from the context alone; a revocation over them changes nothing. */
const CONTEXT_ONLY_DECISIONS = new Set([
	"OUT_OF_SCOPE",
	"TAXED_NOT_COMPANY",
	"TAXED_NO_VAT_ID",
	"TAXED_SK_VAT",
	"TAXED_DOMESTIC_DELIVERY",
	"TAXED_COUNTRY_MISMATCH",
	"TAXED_UNVERIFIED",
	"TAXED_DISABLED",
]);

/** Decisions made on a VIES answer for the current context; reused before a payment, re-asked on request. */
const VERIFIED_TAXED_DECISIONS = new Set(["TAXED_INVALID", "TAXED_UNAVAILABLE", "TAXED_IDENTITY_REVIEW"]);

/** "The number cannot be verified now": the customer may wait and try again, or continue with VAT. */
const NOT_VERIFIABLE_NOW: B2bUiOutcome = {
	kind: "taxed",
	reason: "unavailable",
	needsTaxedConfirmation: true,
};

/**
 * What may be said when the decision would need an attestation write and this process cannot make one (the B2B
 * app's access is not ready): the backend's decision where it stands for these data, never "off" over it.
 *
 * - An effective exemption stays: the backend counts its 24 h, also before every payment (`transactionInitialize`).
 *   Only over data our plan says no longer support one (a revocation was due) nobody can vouch for it.
 * - "Not verified (yet)" or "stale" is what a VIES answer would change. It cannot be asked now, so the customer is
 *   told so and may continue with VAT — the total Saleor states for a taxed decision.
 * - Every other taxed decision is the backend's answer for these data (an INVALID answer, a Slovak VAT ID, …).
 */
function outcomeWithoutAttestation(plan: B2bEvaluationPlan, state: B2bTaxStateFields): B2bUiOutcome {
	const current = outcomeFromBackendState(state);
	switch (current.kind) {
		case "exempt":
			return plan.kind === "revoke" ? { kind: "unconfirmed" } : current;
		case "taxed":
			return current.reason === "incomplete" && plan.kind === "verify" ? NOT_VERIFIABLE_NOW : current;
		case "changed":
			return plan.kind === "verify"
				? NOT_VERIFIABLE_NOW
				: plan.kind === "revoke"
					? { kind: "taxed", reason: plan.reason, needsTaxedConfirmation: false }
					: { kind: "unconfirmed" };
		default:
			return current;
	}
}

/** Saleor global ids are base64 of `Type:pk`; a Warehouse delivery method is click & collect. */
export function deliveryKindOf(checkout: Pick<ServerCheckout, "deliveryMethod">): B2bDeliveryKind {
	const id = checkout.deliveryMethod?.id;
	if (!id) return "none";
	let decoded = "";
	try {
		decoded = Buffer.from(id, "base64").toString("utf8");
	} catch {
		decoded = "";
	}
	return decoded.startsWith("Warehouse:") ? "pickup" : "shipping";
}

type Totals = NonNullable<B2bCheckoutTotals>;

function grossOf(totals: { gross?: { amount: number; currency: string } | null } | null | undefined) {
	const gross = totals?.gross;
	return gross && typeof gross.amount === "number" ? gross : null;
}

function sameTotal(publicCheckout: ServerCheckout, state: Totals | null): boolean {
	const a = grossOf(publicCheckout.totalPrice);
	const b = grossOf(state);
	return !!a && !!b && a.currency === b.currency && Math.abs(a.amount - b.amount) <= 0.005;
}

/**
 * The public quote must not contradict what is said about it: "bez DPH" over a total that still carries tax, or
 * "s DPH" (the customer is asked to continue with VAT) over a positive total that carries none — the second is an old
 * exemption nobody can vouch for, exactly the fallback zadanie 02 forbids.
 */
function contradiction(outcome: B2bUiOutcome, checkout: ServerCheckout): string | null {
	const tax = checkout.totalPrice?.tax?.amount;
	const gross = checkout.totalPrice?.gross?.amount;
	if (typeof tax !== "number" || typeof gross !== "number") return "totals-missing";
	if (outcome.kind === "exempt" && tax > 0.005) return "exempt-but-taxed-total";
	if (outcome.kind === "taxed" && gross > 0.005 && tax <= 0.005) return "taxed-but-untaxed-total";
	return null;
}

type Step =
	| { kind: "done"; result: EvaluateB2bResult }
	| {
			kind: "retry";
			why: "stale" | "inconsistent";
			checkout: ServerCheckout | null;
			exemptionAvailable: boolean;
	  };

function done(
	outcome: B2bUiOutcome,
	checkout: ServerCheckout | null,
	cause: string,
	extra: Partial<Pick<EvaluateB2bResult, "vies" | "exemptionAvailable">> = {},
): Step {
	return {
		kind: "done",
		result: {
			outcome,
			checkout,
			cause,
			vies: extra.vies ?? null,
			exemptionAvailable: extra.exemptionAvailable ?? false,
		},
	};
}

async function evaluateOnce(checkoutId: string, mode: EvaluateB2bMode, deps: EvaluateB2bDeps): Promise<Step> {
	const read = await deps.readCheckout(checkoutId);
	if (!read.ok) return done({ kind: "unconfirmed" }, null, "checkout-read-failed");
	const checkout = read.checkout;
	if (!checkout) return done({ kind: "unconfirmed" }, null, "checkout-not-found");

	const channelSlug = checkout.channel.slug;
	if (!isB2bEuChannel(channelSlug)) return done({ kind: "off" }, checkout, "export-market");
	if (!deps.uiEnabled()) return done({ kind: "off" }, checkout, "ui-disabled");

	const input = parseB2bInput(checkout.b2bInput);
	if (!input) return done({ kind: "off" }, checkout, "no-input");

	// From here on the backend's B2B state is read for this checkout. The same capability as the checkout page: the
	// id is the credential, and a browser whose channel cookie names a different checkout is sent to its own
	// (checkout-session-loader) — nothing B2B is read or written for it. (Checked only here, so an ordinary B2C
	// payment is never refused for it.)
	const cookieId = await deps.cookieCheckoutId(channelSlug);
	if (cookieId && cookieId !== checkoutId)
		return done({ kind: "unconfirmed" }, null, "checkout-access-denied");

	// Not ready (no token, missing permissions, backend without the contract, writes blocked): nothing is written
	// with the app token — no VIES answer is sent, no new exemption granted. The state is still read and stated.
	const canAttest = (await deps.readiness()).ok;
	const available = { exemptionAvailable: canAttest } as const;

	const stateRead = await deps.readState(checkoutId);
	if (!stateRead.ok)
		return done({ kind: "unconfirmed" }, checkout, `state-read-${stateRead.error.kind}`, available);
	const stateCheckout = stateRead.data.checkout;
	const state = stateCheckout?.b2bTaxState ?? null;
	if (!stateCheckout || !state) return done({ kind: "unconfirmed" }, checkout, "state-missing", available);

	const plan = planB2bEvaluation({
		channelSlug,
		input,
		billingCompanyName: checkout.billingAddress?.companyName,
		shippingCountry: checkout.shippingAddress?.country?.code,
		deliveryKind: deliveryKindOf(checkout),
	});

	let decided: B2bTaxStateFields = state;
	let decidedTotals: Totals | null = stateCheckout.totalPrice;
	let vies: ViesResult | null = null;
	let wrote = false;

	const reuse = (): boolean => {
		if (plan.kind === "skip") return true;
		if (plan.kind === "revoke") {
			return !state.effectiveTaxExemption && CONTEXT_ONLY_DECISIONS.has(state.decision);
		}
		if (state.decision === "EXEMPT") {
			return state.effectiveTaxExemption && !isExemptionExpired(state, deps.now());
		}
		// The backend grants nothing new right now: a VIES call would only be spent.
		if (state.decision === "TAXED_DISABLED" && !state.effectiveTaxExemption) return true;
		return mode === "confirm" && !state.effectiveTaxExemption && VERIFIED_TAXED_DECISIONS.has(state.decision);
	};

	// A started payment froze the context: the backend refuses every write until it ends, and its snapshot's decision
	// is what that payment is held to (also after the VIES answer's 24 h). So nothing is asked or written; the frozen
	// decision is stated as it is, and a retry of the same payment can join it.
	const frozen = state.paymentLocked === true;
	const needsWrite = !frozen && !reuse();
	let override: B2bUiOutcome | null = null;
	let causePrefix = "";
	if (needsWrite && !canAttest) {
		override = outcomeWithoutAttestation(plan, state);
		causePrefix = "no-access-";
	}

	if (needsWrite && canAttest) {
		let attestation: CheckoutB2bTaxAttestationInput;
		if (plan.kind === "verify") {
			vies = await deps.verifyVatId(plan.vatId, checkoutId);
			attestation = {
				expectedContextVersion: state.contextVersion,
				verification: {
					vatId: vies.vatId,
					status: vies.status,
					checkedAt: vies.checkedAt,
					requestIdentifier: vies.requestIdentifier,
					name: vies.name,
					address: vies.address,
				},
			};
		} else {
			attestation = { expectedContextVersion: state.contextVersion, verification: null };
		}

		const applied = await deps.applyAttestation(checkoutId, attestation);
		if (!applied.ok) {
			return done({ kind: "unconfirmed" }, checkout, `apply-${applied.error.kind}`, {
				...available,
				vies: vies?.status,
			});
		}
		const payload = applied.data.checkoutB2bTaxAttestationUpdate;
		if (!payload) return done({ kind: "unconfirmed" }, checkout, "apply-no-payload", available);

		const codes = payload.errors.map((error) => error.code);
		if (codes.some(isTaxContextChangedCode)) return { kind: "retry", why: "stale", checkout, ...available };
		if (codes.some(isCheckoutLockedCode)) {
			return done({ kind: "locked" }, checkout, "checkout-locked", { ...available, vies: vies?.status });
		}
		if (codes.length) {
			const code = codes.includes("UNMANAGED_EXEMPTION_CONFLICT") ? "UNMANAGED_EXEMPTION_CONFLICT" : codes[0];
			return done({ kind: "unconfirmed" }, checkout, `apply-error-${code}`, {
				...available,
				vies: vies?.status,
			});
		}

		const next = payload.checkout?.b2bTaxState;
		if (!payload.checkout || !next)
			return done({ kind: "unconfirmed" }, checkout, "apply-no-state", available);
		decided = next;
		decidedTotals = payload.checkout.totalPrice;
		wrote = true;
	}

	let outcome = override ?? outcomeFromBackendState(decided);
	// The context moved under a started payment (the backend's frozen decision says stale): nothing can be written
	// until that payment ends.
	if (frozen && outcome.kind === "changed") outcome = { kind: "locked" };
	if (frozen) causePrefix = "payment-locked-";
	// "No new exemptions right now" asks for a confirmation only from someone who asked for one: a company without a
	// VAT ID buys with VAT as it would have anyway.
	if (outcome.kind === "taxed" && outcome.reason === "disabled" && !input.vatId) {
		outcome = { ...outcome, needsTaxedConfirmation: false };
	}
	// Our own write answered "stale": the context moved between the read and the write.
	if (wrote && outcome.kind === "changed") return { kind: "retry", why: "stale", checkout, ...available };

	// The quote the customer is shown and pays is the PUBLIC checkout (lines, delivery, totals); it has to be the
	// one the decision was made on. Read after the write, compared by its gross total.
	let quote = checkout;
	if (wrote || !sameTotal(checkout, decidedTotals)) {
		const refreshed = await deps.readCheckout(checkoutId);
		if (!refreshed.ok || !refreshed.checkout) {
			return done({ kind: "unconfirmed" }, null, "refresh-failed", { ...available, vies: vies?.status });
		}
		quote = refreshed.checkout;
		if (!sameTotal(quote, decidedTotals)) {
			return { kind: "retry", why: "inconsistent", checkout: quote, ...available };
		}
	}

	const clash = contradiction(outcome, quote);
	if (clash) return done({ kind: "unconfirmed" }, quote, clash, { ...available, vies: vies?.status });

	return done(
		outcome,
		quote,
		wrote ? `applied-${decided.decision}` : `${causePrefix || "reused-"}${decided.decision}`,
		{ ...available, vies: vies?.status },
	);
}

/**
 * At most one repetition: a `STALE_CONTEXT` (or a quote that moved under the decision) reads everything again and
 * decides once more. If it moves again, the customer is still editing — they get the new quote to review
 * (`changed`), never the old "verified".
 */
export async function evaluateB2b(
	params: { checkoutId: string; mode: EvaluateB2bMode },
	deps: EvaluateB2bDeps,
): Promise<EvaluateB2bResult> {
	let last: Extract<Step, { kind: "retry" }> | null = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		const step = await evaluateOnce(params.checkoutId, params.mode, deps);
		if (step.kind === "done") {
			deps.log?.(step.result.cause);
			return step.result;
		}
		last = step;
	}

	const why = last?.why ?? "stale";
	const cause = why === "stale" ? "context-still-changing" : "totals-inconsistent";
	deps.log?.(cause);
	// The newest quote we can read, so the customer reviews what is true now.
	const fresh = await deps.readCheckout(params.checkoutId);
	const checkout = fresh.ok ? fresh.checkout : last?.checkout ?? null;
	return {
		outcome: why === "stale" ? { kind: "changed" } : { kind: "unconfirmed" },
		checkout,
		vies: null,
		exemptionAvailable: last?.exemptionAvailable ?? true,
		cause,
	};
}
