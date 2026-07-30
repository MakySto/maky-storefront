import "server-only";
import { companyInfo } from "@/config/company";
import { type WithdrawalAccepted, type WithdrawalSubmission } from "./contract";

/**
 * Notification of a received withdrawal notice.
 *
 * ## Why this is a seam and not an implementation
 *
 * `maky-smtp-app` cannot send this e-mail today, and the gap is structural rather than
 * a matter of configuration. It is the Saleor SMTP app; every HTTP entry point it
 * exposes is one of:
 *
 *   /api/manifest, /api/register    Saleor app lifecycle
 *   /api/trpc/[trpc]                admin configuration, authenticated as a Saleor app
 *   /api/webhooks/*                 Saleor-signed webhook receivers
 *
 * and each webhook is bound to one member of a closed union — `MessageEventTypes` in
 * `apps/smtp/src/modules/event-handlers/message-event-types.ts` — of fifteen
 * Saleor-originated events (ACCOUNT_*, ORDER_*, GIFT_CARD_SENT, INVOICE_SENT). There is
 * no generic transactional send, and a withdrawal notice is not a Saleor event at all,
 * so nothing in that list can carry it.
 *
 * Inventing an endpoint would produce code that compiles, passes review and silently
 * fails to notify anyone. So the mailer is an interface with a truthful default: it
 * reports that it cannot send. The orchestration treats that exactly like any other
 * send failure, which is a path the law already requires us to handle properly — the
 * withdrawal stays received, the customer gets printable proof, and delivery is
 * recorded as failed for retry.
 *
 * See the handoff document for the exact contract the SMTP app needs to grow.
 */

export type MailResult =
	| { readonly status: "sent" }
	| { readonly status: "failed"; readonly reason: string }
	/** No transport exists yet. Distinct from a failure so alerts can say so. */
	| { readonly status: "unsupported"; readonly missingContract: string };

export interface WithdrawalMailer {
	sendCustomerConfirmation(input: {
		submission: WithdrawalSubmission;
		accepted: WithdrawalAccepted;
		/** Absolute, market-prefixed. Every link in the mail must survive leaving the site. */
		returnsPageUrl: string;
	}): Promise<MailResult>;

	sendInternalNotification(input: {
		submission: WithdrawalSubmission;
		accepted: WithdrawalAccepted;
		recipient: string;
	}): Promise<MailResult>;
}

const MISSING_CONTRACT =
	"maky-smtp-app exposes only Saleor-signed webhooks for the fifteen MessageEventTypes " +
	"events plus its tRPC admin API; it has no authenticated transactional-send endpoint " +
	"that accepts an arbitrary recipient, template key and payload.";

/** The internal notification recipient, fixed by the brief. */
export const INTERNAL_NOTIFICATION_RECIPIENT = companyInfo.email;

/**
 * The default mailer: honest about being unable to send.
 *
 * Returning `unsupported` rather than throwing keeps the failure inside the normal
 * delivery-status flow instead of turning it into an exception that could be mistaken
 * for a persistence failure — the one thing that must never be confused.
 */
export const unavailableMailer: WithdrawalMailer = {
	async sendCustomerConfirmation() {
		return { status: "unsupported", missingContract: MISSING_CONTRACT };
	},
	async sendInternalNotification() {
		return { status: "unsupported", missingContract: MISSING_CONTRACT };
	},
};

/**
 * What the customer confirmation must contain, per the brief.
 *
 * Exported as data so a test can assert the requirement list is covered the day a real
 * transport arrives, instead of the checklist living only in prose.
 */
export const CUSTOMER_CONFIRMATION_REQUIRED_CONTENT = [
	"sellerIdentity",
	"submissionNumber",
	"completeNoticeSnapshot",
	"submittedAt",
	"orderIdentifier",
	"scopeAndItems",
	"receiptExplanation",
	"returnInstructions",
] as const;
