import {
	LEGAL_NOTICE_VERSION,
	PRIVACY_NOTICE_VERSION,
	WITHDRAWAL_LOCALE,
	WITHDRAWAL_MARKET,
	type WithdrawalAccepted,
	type WithdrawalSubmission,
} from "./contract";
import { INTERNAL_NOTIFICATION_RECIPIENT, type MailResult, type WithdrawalMailer } from "./mail";
import { buildNoticeSnapshot } from "./notice";
import { validateWithdrawal, type FieldError, type RawWithdrawalInput } from "./validate";

/**
 * The one place the order of operations is enforced.
 *
 *   1. validate
 *   2. persist the immutable record — this is the moment the notice is "received"
 *   3. take the server's submission number and timestamp
 *   4. notify the customer
 *   5. notify the shop
 *   6. record how 4 and 5 went
 *
 * Steps 4 to 6 are best-effort and cannot undo step 2. That asymmetry is the whole
 * point: a withdrawal is effective when it is given, not when an SMTP server feels
 * like cooperating. Telling a customer their notice failed because an e-mail bounced
 * would deny them a right they have already exercised.
 *
 * The inverse is equally strict. If step 2 fails there is no record, so the UI must
 * say so plainly and point at the e-mail and postal routes. Showing a success page
 * with no stored notice would be the worst outcome available: the customer stops
 * worrying, and nothing exists.
 *
 * Dependencies are injected so every infrastructure branch — timeout, 4xx, 5xx,
 * duplicate, mail failure, delivery-update failure — is reachable from a test without
 * a network.
 */

export interface EmailDeliveryReport {
	readonly customer: MailResult;
	readonly internal: MailResult;
	/** False when the delivery statuses could not be written back to the record. */
	readonly recorded: boolean;
}

export type WithdrawalOutcome =
	/** Nothing was stored; the customer must be told and offered the other routes. */
	| { readonly status: "invalid"; readonly errors: readonly FieldError[] }
	| {
			readonly status: "notReceived";
			readonly reason: "unavailable" | "rejected" | "notConfigured";
			readonly detail: string;
	  }
	/** Durable. The notice is legally given, whatever the e-mails did. */
	| {
			readonly status: "received";
			readonly accepted: WithdrawalAccepted;
			readonly submission: WithdrawalSubmission;
			readonly email: EmailDeliveryReport;
	  };

export interface PersistPort {
	(
		submission: WithdrawalSubmission,
	): Promise<
		| { status: "ok"; value: WithdrawalAccepted }
		| { status: "rejected"; httpStatus: number; code: string }
		| { status: "unavailable"; reason: string }
		| { status: "notConfigured"; missing: readonly string[] }
	>;
}

export interface RecordDeliveryPort {
	(
		submissionId: string,
		delivery: {
			customerStatus: "pending" | "sent" | "failed";
			internalStatus: "pending" | "sent" | "failed";
			lastError?: string | null;
		},
	): Promise<{ status: string }>;
}

export interface SubmitDeps {
	readonly persist: PersistPort;
	readonly mailer: WithdrawalMailer;
	readonly recordDelivery: RecordDeliveryPort;
	/** Absolute, market-prefixed URL of the returns page, for the customer e-mail. */
	readonly returnsPageUrl: string;
	/**
	 * Server-verified ownership, or nulls for a guest. Never derived from the request
	 * body — the client may claim any order it likes and the claim is worthless.
	 */
	readonly verifiedOrder?: { saleorOrderId: string | null; saleorCustomerId: string | null };
}

function mailStatus(result: MailResult): "sent" | "failed" {
	return result.status === "sent" ? "sent" : "failed";
}

function mailError(result: MailResult): string | null {
	if (result.status === "failed") return result.reason;
	if (result.status === "unsupported") return `unsupported: ${result.missingContract}`;
	return null;
}

/**
 * One structured alert per degraded delivery.
 *
 * Carries the submission number and never the notice or the customer's details — an
 * operational log is read by whoever is on call, not by someone entitled to the
 * personal data inside a legal notice.
 */
function alertDegradedDelivery(accepted: WithdrawalAccepted, email: EmailDeliveryReport): void {
	const customerError = mailError(email.customer);
	const internalError = mailError(email.internal);
	if (!customerError && !internalError && email.recorded) return;

	console.error(
		"[withdrawal] delivery-degraded",
		JSON.stringify({
			submissionNumber: accepted.submissionNumber,
			customerStatus: mailStatus(email.customer),
			internalStatus: mailStatus(email.internal),
			deliveryRecorded: email.recorded,
			customerError,
			internalError,
		}),
	);
}

export async function submitWithdrawal(
	raw: RawWithdrawalInput,
	deps: SubmitDeps,
): Promise<WithdrawalOutcome> {
	const validation = validateWithdrawal(raw);
	if (!validation.ok) return { status: "invalid", errors: validation.errors };

	const input = validation.value;

	const submission: WithdrawalSubmission = {
		submissionId: input.submissionId,
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
		items: input.items,
		note: input.note,
		noticeSnapshot: buildNoticeSnapshot({ ...input, legalNoticeVersion: LEGAL_NOTICE_VERSION }),
		legalNoticeVersion: LEGAL_NOTICE_VERSION,
		privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
	};

	// ---- 2. Persist. Everything before this is reversible; nothing after it is. ----
	const persisted = await deps.persist(submission);

	if (persisted.status === "notConfigured") {
		return {
			status: "notReceived",
			reason: "notConfigured",
			detail: `forms transport not configured: ${persisted.missing.join(", ")}`,
		};
	}
	if (persisted.status === "unavailable") {
		return { status: "notReceived", reason: "unavailable", detail: persisted.reason };
	}
	if (persisted.status === "rejected") {
		return {
			status: "notReceived",
			reason: "rejected",
			detail: `HTTP ${persisted.httpStatus} ${persisted.code}`,
		};
	}

	const accepted = persisted.value;

	// ---- 4 & 5. Notify. A throw here must not look like a persistence failure. ----
	const customer = await deps.mailer
		.sendCustomerConfirmation({ submission, accepted, returnsPageUrl: deps.returnsPageUrl })
		.catch((error: unknown): MailResult => ({ status: "failed", reason: describe(error) }));

	const internal = await deps.mailer
		.sendInternalNotification({ submission, accepted, recipient: INTERNAL_NOTIFICATION_RECIPIENT })
		.catch((error: unknown): MailResult => ({ status: "failed", reason: describe(error) }));

	// ---- 6. Record delivery. Best-effort; the record stands either way. ----
	let recorded = false;
	try {
		const update = await deps.recordDelivery(accepted.submissionId, {
			customerStatus: mailStatus(customer),
			internalStatus: mailStatus(internal),
			lastError: mailError(customer) ?? mailError(internal),
		});
		recorded = update.status === "ok";
	} catch {
		recorded = false;
	}

	const email: EmailDeliveryReport = { customer, internal, recorded };
	alertDegradedDelivery(accepted, email);

	return { status: "received", accepted, submission, email };
}

function describe(error: unknown): string {
	return error instanceof Error ? error.name : "unknown error";
}
