import "server-only";
import { randomUUID } from "crypto";
import {
	type OrderMatchStatus,
	type WithdrawalAccepted,
	type WithdrawalSubmission,
} from "../withdrawal/contract";
import { missingFormsSettings, readFormsConnection } from "./env";
import { signFormsRequest } from "./signature";

/**
 * Server-side client for the Payload forms endpoints.
 *
 * Network shape:
 *
 *   Next.js server ──CF-Access service token──▶ Cloudflare Access ──▶ Payload
 *                   ──HMAC over timestamp+body─▶ /api/forms/withdrawal
 *
 * The browser never talks to the CMS. The raw Payload collection REST endpoint is
 * never called either: `withdrawal-requests` refuses anonymous creates, and writing
 * goes exclusively through the signed application endpoint so that Payload can apply
 * its own rules (server-generated submission number, unique submissionId, immutable
 * submitted fields) rather than trusting whatever a networked caller posts.
 *
 * ## Response contract this client expects
 *
 * `POST /api/forms/withdrawal`
 *   201 → created            `{ ok: true, duplicate: false, submission: {...} }`
 *   200 → already existed    `{ ok: true, duplicate: true,  submission: {...} }`
 *   4xx → rejected           `{ ok: false, error: { code, message } }`
 *   5xx → upstream fault
 *
 * `submission` carries `submissionId`, `submissionNumber`, `submittedAt` (ISO 8601)
 * and `orderMatchStatus`. All four are server-owned; the storefront never invents them.
 */

export type FormsOutcome<T> =
	/** The record is durable. Everything after this point is best-effort. */
	| { readonly status: "ok"; readonly value: T }
	/** The endpoint refused the body. A bug on our side, not a customer error. */
	| { readonly status: "rejected"; readonly httpStatus: number; readonly code: string }
	/** Timeout, DNS, Access 3xx, 5xx, unparseable response. Retryable. */
	| { readonly status: "unavailable"; readonly reason: string }
	/** Settings missing. Distinct from "unavailable" because nobody should retry it. */
	| { readonly status: "notConfigured"; readonly missing: readonly string[] };

/** Structured, and deliberately free of the notice and of personal data. */
function logForms(level: "error" | "warn", event: string, detail: Record<string, unknown>): void {
	const line = `[forms] ${event}`;
	const body = JSON.stringify(detail);
	if (level === "error") console.error(line, body);
	else console.warn(line, body);
}

function isOrderMatchStatus(value: unknown): value is OrderMatchStatus {
	return (
		value === "pending" ||
		value === "matched" ||
		value === "notFound" ||
		value === "emailMismatch" ||
		value === "manualReview"
	);
}

/** The response is untrusted input like any other. */
function parseAccepted(body: unknown, duplicateFallback: boolean): WithdrawalAccepted | null {
	if (typeof body !== "object" || body === null) return null;
	const envelope = body as Record<string, unknown>;
	if (envelope.ok !== true) return null;

	const raw = envelope.submission;
	if (typeof raw !== "object" || raw === null) return null;
	const submission = raw as Record<string, unknown>;

	const submissionId = submission.submissionId;
	const submissionNumber = submission.submissionNumber;
	const submittedAt = submission.submittedAt;

	if (typeof submissionId !== "string" || submissionId.length === 0) return null;
	if (typeof submissionNumber !== "string" || submissionNumber.length === 0) return null;
	if (typeof submittedAt !== "string" || Number.isNaN(Date.parse(submittedAt))) return null;

	return {
		submissionId,
		submissionNumber,
		submittedAt,
		orderMatchStatus: isOrderMatchStatus(submission.orderMatchStatus)
			? submission.orderMatchStatus
			: "pending",
		duplicate: typeof envelope.duplicate === "boolean" ? envelope.duplicate : duplicateFallback,
	};
}

async function postSigned(
	path: string,
	submissionId: string,
	payload: unknown,
): Promise<
	| { kind: "response"; response: Response; rawBody: string }
	| { kind: "notConfigured"; missing: string[] }
	| { kind: "unavailable"; reason: string }
> {
	const connection = readFormsConnection();
	if (!connection) {
		const missing = missingFormsSettings();
		logForms("error", "not-configured", { path, missing });
		return { kind: "notConfigured", missing };
	}

	// Serialise ONCE and sign exactly these bytes. Re-serialising for the signature
	// would eventually diverge from what is sent, and the symptom is an unreproducible
	// signature mismatch.
	const rawBody = JSON.stringify(payload);
	const timestamp = String(Date.now());
	const signature = signFormsRequest(connection.hmacSecret, timestamp, rawBody);

	let response: Response;
	try {
		response = await fetch(`${connection.baseUrl}${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"CF-Access-Client-Id": connection.accessClientId,
				"CF-Access-Client-Secret": connection.accessClientSecret,
				"X-Maky-Forms-Timestamp": timestamp,
				"X-Maky-Forms-Submission-Id": submissionId,
				"X-Maky-Forms-Signature": signature,
			},
			body: rawBody,
			// Cloudflare Access refuses with a 302 to an HTML login page rather than a
			// 401. Following it would hand us a 200 HTML page to parse as JSON, so
			// redirects are never followed and any 3xx is an upstream fault.
			redirect: "manual",
			signal: AbortSignal.timeout(connection.timeoutMs),
			cache: "no-store",
		});
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		const reason = timedOut ? `timeout after ${connection.timeoutMs}ms` : "network error";
		logForms("error", "fetch-failed", { path, submissionId, reason });
		return { kind: "unavailable", reason };
	}

	let text: string;
	try {
		text = await response.text();
	} catch {
		return { kind: "unavailable", reason: "unreadable response body" };
	}

	return { kind: "response", response, rawBody: text };
}

/**
 * Persist a withdrawal notice.
 *
 * Idempotent by `submissionId`: Payload holds a unique index on it, so a retry after a
 * timeout returns the original record instead of creating a second one. The database
 * constraint is the authoritative gate — the UI's double-click guard is a courtesy and
 * an in-memory token would not survive a restart or a second process.
 */
export async function submitWithdrawalToPayload(
	submission: WithdrawalSubmission,
): Promise<FormsOutcome<WithdrawalAccepted>> {
	const result = await postSigned("/api/forms/withdrawal", submission.submissionId, submission);

	if (result.kind === "notConfigured") return { status: "notConfigured", missing: result.missing };
	if (result.kind === "unavailable") return { status: "unavailable", reason: result.reason };

	const { response, rawBody } = result;

	if (response.status >= 500 || (response.status >= 300 && response.status < 400)) {
		logForms("error", "upstream-status", {
			submissionId: submission.submissionId,
			httpStatus: response.status,
		});
		return { status: "unavailable", reason: `upstream HTTP ${response.status}` };
	}

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		logForms("error", "malformed-json", {
			submissionId: submission.submissionId,
			httpStatus: response.status,
		});
		return { status: "unavailable", reason: "malformed json" };
	}

	if (response.ok) {
		// 200 means the record already existed; 201 means it was created now. Payload
		// should also say so in `duplicate`, but the status code is the fallback.
		const accepted = parseAccepted(body, response.status === 200);
		if (!accepted) {
			logForms("error", "contract-violation", {
				submissionId: submission.submissionId,
				httpStatus: response.status,
			});
			return { status: "unavailable", reason: "response did not match the forms contract" };
		}
		return { status: "ok", value: accepted };
	}

	const code =
		typeof body === "object" &&
		body !== null &&
		typeof (body as { error?: { code?: unknown } }).error?.code === "string"
			? (body as { error: { code: string } }).error.code
			: "unknown";

	logForms("error", "rejected", {
		submissionId: submission.submissionId,
		httpStatus: response.status,
		code,
	});
	return { status: "rejected", httpStatus: response.status, code };
}

export type EmailDeliveryState = "pending" | "sent" | "failed";

/**
 * Record how the two notification e-mails went.
 *
 * A separate endpoint, and deliberately so: it may touch only the delivery fields.
 * The submitted notice is immutable once written — a path that could rewrite it would
 * undermine the entire evidential point of storing it.
 *
 * Best-effort by design. Failing to record that an e-mail was sent must never turn a
 * received withdrawal into a failed one.
 */
export async function updateWithdrawalEmailDelivery(
	submissionId: string,
	delivery: {
		customerStatus: EmailDeliveryState;
		internalStatus: EmailDeliveryState;
		lastError?: string | null;
	},
): Promise<FormsOutcome<{ updated: true }>> {
	const result = await postSigned(
		`/api/forms/withdrawal/${encodeURIComponent(submissionId)}/email-delivery`,
		submissionId,
		{
			submissionId,
			emailDelivery: delivery,
		},
	);

	if (result.kind === "notConfigured") return { status: "notConfigured", missing: result.missing };
	if (result.kind === "unavailable") return { status: "unavailable", reason: result.reason };

	if (!result.response.ok) {
		logForms("warn", "email-delivery-update-failed", {
			submissionId,
			httpStatus: result.response.status,
		});
		return { status: "unavailable", reason: `upstream HTTP ${result.response.status}` };
	}

	return { status: "ok", value: { updated: true } };
}

/** One id per form attempt, generated server-side when the page renders. */
export function newSubmissionId(): string {
	return randomUUID();
}
