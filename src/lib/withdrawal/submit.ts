import {
	LEGAL_NOTICE_VERSION,
	PRIVACY_NOTICE_VERSION,
	WITHDRAWAL_LOCALE,
	WITHDRAWAL_MARKET,
	type WithdrawalCustomerOrderItem,
	type WithdrawalSubmission,
	type WithdrawalV2Accepted,
	withdrawalCustomerStatement,
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
	/** Validation failed before transport. */
	| { readonly status: "invalid"; readonly errors: readonly FieldError[] }
	| {
			readonly status: "notReceived";
			readonly reason: "unavailable" | "rejected" | "notConfigured";
			readonly code: FormsErrorCode | null;
			readonly detail: string;
	  }
	/** The record may already exist; retry the identical body to obtain its artifacts. */
	| { readonly status: "confirmationPending" }
	/** Durable. The notice is legally given, whatever the e-mail did. */
	| {
			readonly status: "received";
			readonly accepted: WithdrawalV2Accepted;
			readonly submission: WithdrawalSubmission;
	  };

export interface PersistPort {
	(
		submission: WithdrawalSubmission,
	): Promise<
		| { status: "ok"; value: WithdrawalV2Accepted }
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
	/** Whole-order lines from the server-verified Saleor order, never from hidden form input. */
	readonly customerOrderItems?: readonly WithdrawalCustomerOrderItem[];
}

function customerSafeOrderItems(
	items: readonly WithdrawalCustomerOrderItem[] | undefined,
): WithdrawalCustomerOrderItem[] {
	return (items ?? []).slice(0, 100).flatMap((item) => {
		const name = item.name
			.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 300);
		if (!name || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return [];
		return [{ name, quantity: Math.min(item.quantity, 10_000) }];
	});
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
		experienceVersion: "returns-v2",
		customerStatement: withdrawalCustomerStatement(input.orderNumber, input.scope),
		customerOrderItems:
			input.scope === "wholeOrder" && deps.verifiedOrder
				? customerSafeOrderItems(deps.customerOrderItems)
				: [],
		returnMethod: "merchantPickup",
		source: input.source,
		market: WITHDRAWAL_MARKET,
		locale: WITHDRAWAL_LOCALE,
		customer: { name: input.name, email: input.email, phone: input.phone },
		contract: {
			orderNumber: input.orderNumber,
			// Only ever the server's own answer about ownership.
			saleorOrderId: deps.verifiedOrder?.saleorOrderId ?? null,
			saleorCustomerId: deps.verifiedOrder?.saleorCustomerId ?? null,
		},
		scope: input.scope,
		// A whole-order notice carries no item list. The schema is explicit about it —
		// `scope: "wholeOrder"` requires `items` to be null or empty — so passing lines
		// through here would be a 400 rather than harmless extra detail. The form already
		// sends `[]` in that case; this makes the guarantee the caller's rather than the
		// UI's, because `submitWithdrawal` is a library function and the next caller will
		// not have read the form.
		items: input.scope === "selectedItems" ? input.items : [],
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
		// A timeout, unreadable proxy response or malformed 2xx can happen after Payload
		// durably stored the notice. Never claim it was not received: retrying the exact
		// submissionId/body either returns the immutable original or completes normally.
		return { status: "confirmationPending" };
	}
	if (persisted.status === "rejected") {
		if (persisted.code === "WITHDRAWAL_CONFIRMATION_PENDING") {
			return { status: "confirmationPending" };
		}
		return {
			status: "notReceived",
			reason: "rejected",
			code: persisted.code,
			detail: `HTTP ${persisted.httpStatus} ${persisted.code}`,
		};
	}

	return { status: "received", accepted: persisted.value, submission };
}
