import {
	LEGAL_NOTICE_VERSION,
	PRIVACY_NOTICE_VERSION,
	WITHDRAWAL_LOCALE,
	WITHDRAWAL_MARKET,
	type WithdrawalAccepted,
	type WithdrawalSubmission,
} from "./contract";
import { type FormsErrorCode } from "../forms/payload-forms-client";
import { validateWithdrawal, type FieldError, type RawWithdrawalInput } from "./validate";

/**
 * The one place the order of operations is enforced.
 *
 *   1. validate
 *   2. persist — this is the moment the notice is "received"
 *
 * There is no step 3 here any more, and the deletion is the point. The storefront used
 * to send the confirmation e-mail, the internal notification, and then patch the
 * delivery status back. Payload now does all three in the same transaction that stores
 * the record, from the same stored snapshot — so the notice, the e-mail and the
 * database row are built from one source and cannot drift. It also removes the window
 * where the record existed but the storefront process died before telling anyone.
 *
 * What survives is the asymmetry that matters. If persistence fails there is no record,
 * so the UI says so plainly and points at the e-mail and postal routes: a success page
 * with nothing stored is the worst outcome available, because the customer stops
 * worrying and nothing exists. If persistence succeeds but the confirmation e-mail did
 * not go out, the withdrawal is still received — a withdrawal is effective when it is
 * given, not when an SMTP server cooperates — and the receipt says exactly that.
 */

export type WithdrawalOutcome =
	/** Nothing was stored; the customer must be told and offered the other routes. */
	| { readonly status: "invalid"; readonly errors: readonly FieldError[] }
	| {
			readonly status: "notReceived";
			readonly reason: "unavailable" | "rejected" | "notConfigured";
			readonly code: FormsErrorCode | null;
			readonly detail: string;
	  }
	/** Durable. The notice is legally given, whatever the e-mail did. */
	| {
			readonly status: "received";
			readonly accepted: WithdrawalAccepted;
			readonly submission: WithdrawalSubmission;
	  };

export interface PersistPort {
	(
		submission: WithdrawalSubmission,
	): Promise<
		| { status: "ok"; value: WithdrawalAccepted }
		| { status: "rejected"; httpStatus: number; code: FormsErrorCode }
		| { status: "unavailable"; reason: string }
		| { status: "notConfigured"; missing: readonly string[] }
	>;
}

export interface SubmitDeps {
	readonly persist: PersistPort;
	/**
	 * Server-verified ownership, or nulls for a guest. Never derived from the request
	 * body — the client may claim any order it likes and the claim is worthless.
	 */
	readonly verifiedOrder?: { saleorOrderId: string | null; saleorCustomerId: string | null };
}

export async function submitWithdrawal(
	raw: RawWithdrawalInput,
	deps: SubmitDeps,
): Promise<WithdrawalOutcome> {
	const validation = validateWithdrawal(raw);
	if (!validation.ok) return { status: "invalid", errors: validation.errors };

	const input = validation.value;

	// Exactly the keys Payload allows, and no others: the endpoint rejects unknown keys
	// at every level, so an extra field is a 400 rather than something it ignores.
	const submission: WithdrawalSubmission = {
		submissionId: input.submissionId,
		source: input.source,
		market: WITHDRAWAL_MARKET,
		locale: WITHDRAWAL_LOCALE,
		customer: { name: input.name, email: input.email },
		contract: {
			orderNumber: input.orderNumber,
			// Only ever the server's own answer about ownership.
			saleorOrderId: deps.verifiedOrder?.saleorOrderId ?? null,
			saleorCustomerId: deps.verifiedOrder?.saleorCustomerId ?? null,
		},
		scope: input.scope,
		items: input.items,
		note: input.note,
		legalNoticeVersion: LEGAL_NOTICE_VERSION,
		privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
	};

	const persisted = await deps.persist(submission);

	if (persisted.status === "notConfigured") {
		return {
			status: "notReceived",
			reason: "notConfigured",
			code: null,
			detail: `forms transport not configured: ${persisted.missing.join(", ")}`,
		};
	}
	if (persisted.status === "unavailable") {
		return { status: "notReceived", reason: "unavailable", code: null, detail: persisted.reason };
	}
	if (persisted.status === "rejected") {
		return {
			status: "notReceived",
			reason: "rejected",
			code: persisted.code,
			detail: `HTTP ${persisted.httpStatus} ${persisted.code}`,
		};
	}

	const accepted = persisted.value;

	// A confirmation that did not go out is an operational problem, not a failed
	// submission. It is logged so somebody can retry it, and the receipt tells the
	// customer the truth without implying their notice failed.
	if (accepted.emailDelivery && accepted.emailDelivery.customerStatus !== "sent") {
		console.error(
			"[withdrawal] delivery-degraded",
			JSON.stringify({
				submissionNumber: accepted.submissionNumber,
				customerStatus: accepted.emailDelivery.customerStatus,
				internalStatus: accepted.emailDelivery.internalStatus,
			}),
		);
	}

	return { status: "received", accepted, submission };
}
