import "server-only";
import { randomUUID } from "crypto";
import {
	formsTimestampSeconds,
	WITHDRAWAL_LIMITS,
	type WithdrawalSubmission,
	type WithdrawalV2Accepted,
} from "../withdrawal/contract";
import { missingFormsSettings, readFormsConnection } from "./env";
import { signFormsRequest } from "./signature";

/**
 * Server-side client for the Payload forms endpoints.
 *
 *   Next.js server ──CF-Access service token──▶ Cloudflare Access ──▶ Payload
 *                   ──HMAC over timestamp+body─▶ /api/forms/withdrawal
 *
 * The browser never talks to the CMS, and the raw Payload collection REST endpoint is
 * never called: `withdrawal-requests` refuses anonymous creates outright — even for an
 * authenticated admin — so writing goes exclusively through the signed application
 * endpoint, which is what applies the server-owned rules.
 *
 * ## Two details that decide whether a request works at all
 *
 * The timestamp is Unix **seconds**. `Date.now()` returns milliseconds, and Payload
 * accepts a 10–11 digit value, so a millisecond timestamp fails every request with
 * `INVALID_TIMESTAMP` — silently correct-looking code that never succeeds once.
 *
 * The body is serialised **once** and those exact bytes are both signed and sent.
 * Re-serialising after signing eventually diverges over key order or unicode escaping,
 * and the symptom is an unreproducible `INVALID_SIGNATURE`.
 *
 * ## Response contract
 *
 * `POST /api/forms/withdrawal`
 *   201 → created            `{ ok: true, duplicate: false, submission: {…} }`
 *   200 → already existed    `{ ok: true, duplicate: true,  submission: {…} }`
 *   4xx/5xx → `{ ok: false, error: { code, message } }`
 *
 * For `returns-v2`, `submission` carries only the customer-safe ODS number and the
 * immutable A4/slip HTML artifacts rendered by Payload. Internal ids, delivery state
 * and audit snapshots never cross this customer boundary.
 */

/** Payload's documented error codes. Anything else is treated as unknown. */
export const FORMS_ERROR_CODES = [
	"INVALID_CONTENT_LENGTH",
	"INVALID_REQUEST_BODY",
	"INVALID_REQUEST",
	"INVALID_RECORD_ID",
	"MISSING_TIMESTAMP",
	"INVALID_TIMESTAMP",
	"STALE_TIMESTAMP",
	"MISSING_SIGNATURE",
	"INVALID_SIGNATURE",
	"INVALID_SUBMISSION_ID_HEADER",
	"FORM_NOT_FOUND",
	"SUBMISSION_ID_CONFLICT",
	"SUBMISSION_TARGET_MISMATCH",
	"DELIVERY_STATUS_REGRESSION",
	"WITHDRAWAL_EXPERIENCE_REQUIRED",
	"WITHDRAWAL_EXPERIENCE_UNAVAILABLE",
	"WITHDRAWAL_CONFIRMATION_PENDING",
	"BODY_TOO_LARGE",
	"UNSUPPORTED_MEDIA_TYPE",
	"FORMS_INTERNAL_ERROR",
	"FORMS_AUTH_UNAVAILABLE",
] as const;

export type FormsErrorCode = (typeof FORMS_ERROR_CODES)[number] | "UNKNOWN";

function toErrorCode(value: unknown): FormsErrorCode {
	return (FORMS_ERROR_CODES as readonly string[]).includes(value as string)
		? (value as FormsErrorCode)
		: "UNKNOWN";
}

export type FormsOutcome<T> =
	/** The record is durable. */
	| { readonly status: "ok"; readonly value: T }
	/** The endpoint refused the request. Carries Payload's code, never its message. */
	| { readonly status: "rejected"; readonly httpStatus: number; readonly code: FormsErrorCode }
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

const SUBMISSION_NUMBER_PATTERN = /^ODS-\d{4}-\d{6}$/;

function isRequiredArtifact(value: unknown, maxLength: number): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function parseAccepted(body: unknown, expectedDuplicate: boolean): WithdrawalV2Accepted | null {
	if (typeof body !== "object" || body === null) return null;
	const envelope = body as Record<string, unknown>;
	if (envelope.ok !== true) return null;
	if (typeof envelope.duplicate !== "boolean" || envelope.duplicate !== expectedDuplicate) return null;

	const raw = envelope.submission;
	if (typeof raw !== "object" || raw === null) return null;
	const submission = raw as Record<string, unknown>;

	const { submissionNumber, printConfirmationHTML, parcelSlipHTML } = submission;
	if (typeof submissionNumber !== "string" || !SUBMISSION_NUMBER_PATTERN.test(submissionNumber)) return null;
	if (!isRequiredArtifact(printConfirmationHTML, 1_000_000)) return null;
	if (parcelSlipHTML !== null && !isRequiredArtifact(parcelSlipHTML, 200_000)) return null;

	return {
		submissionNumber,
		duplicate: envelope.duplicate,
		printConfirmationHTML,
		parcelSlipHTML,
	};
}

/**
 * Persist a withdrawal notice.
 *
 * Idempotent by `submissionId`: Payload holds a unique index on it, so a retry after a
 * timeout returns the original record — with its original `submittedAt` and snapshot —
 * instead of creating a second one. The database constraint is the authoritative gate;
 * the UI's double-click guard is a courtesy and an in-memory token would not survive a
 * restart or a second process.
 */
export async function submitWithdrawalToPayload(
	submission: WithdrawalSubmission,
): Promise<FormsOutcome<WithdrawalV2Accepted>> {
	const connection = readFormsConnection();
	if (!connection) {
		const missing = missingFormsSettings();
		logForms("error", "not-configured", { missing });
		return { status: "notConfigured", missing };
	}

	// Serialise ONCE. These exact bytes are signed and these exact bytes are sent.
	const rawBody = JSON.stringify(submission);

	const byteLength = Buffer.byteLength(rawBody, "utf8");
	if (byteLength > WITHDRAWAL_LIMITS.bodyBytes) {
		// Refuse locally rather than spending a round trip on a guaranteed 413.
		logForms("error", "body-too-large", { submissionId: submission.submissionId, byteLength });
		return { status: "rejected", httpStatus: 413, code: "BODY_TOO_LARGE" };
	}

	const timestamp = formsTimestampSeconds();
	const signature = signFormsRequest(connection.hmacSecret, timestamp, rawBody);

	let response: Response;
	try {
		response = await fetch(`${connection.baseUrl}/api/forms/withdrawal`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"CF-Access-Client-Id": connection.accessClientId,
				"CF-Access-Client-Secret": connection.accessClientSecret,
				"X-Maky-Forms-Timestamp": timestamp,
				"X-Maky-Forms-Submission-Id": submission.submissionId,
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
		logForms("error", "fetch-failed", { submissionId: submission.submissionId, reason });
		return { status: "unavailable", reason };
	}

	// A 3xx is Cloudflare Access answering with an HTML login page, so there is no
	// contract body to read and nothing to classify beyond "upstream refused us".
	if (response.status >= 300 && response.status < 400) {
		logForms("error", "upstream-status", {
			submissionId: submission.submissionId,
			httpStatus: response.status,
		});
		return { status: "unavailable", reason: `upstream HTTP ${response.status}` };
	}

	let text: string;
	try {
		text = await response.text();
	} catch {
		return { status: "unavailable", reason: "unreadable response body" };
	}

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		// A proxy 502 returns HTML, not our error envelope. Unreadable is retryable.
		logForms(response.ok ? "error" : "warn", "malformed-json", {
			submissionId: submission.submissionId,
			httpStatus: response.status,
		});
		return { status: "unavailable", reason: `upstream HTTP ${response.status}` };
	}

	if (response.ok) {
		if (response.status !== 200 && response.status !== 201) {
			logForms("error", "contract-violation", {
				submissionId: submission.submissionId,
				httpStatus: response.status,
			});
			return { status: "unavailable", reason: "unexpected successful HTTP status" };
		}
		// 200 means the record already existed; 201 means it was created now. Requiring
		// `duplicate` to agree prevents a malformed acknowledgement from changing the
		// customer's understanding of whether this was a replay.
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

	const code = toErrorCode((body as { error?: { code?: unknown } } | null)?.error?.code);

	// The code, never the message: Payload's text is written for an operator and could
	// echo submitted values back into a log or, worse, onto the page.
	logForms("error", "rejected", {
		submissionId: submission.submissionId,
		httpStatus: response.status,
		code,
	});

	// The body's code classifies the failure, not the status line. Payload answers 503
	// for a missing HMAC secret, which looks transient and is not: retrying will fail
	// identically until an operator acts, so it is a rejection carrying a code somebody
	// can act on. FORMS_INTERNAL_ERROR is the genuinely transient one, and an unknown
	// code on a 5xx is treated as transient because assuming otherwise would tell a
	// customer to stop trying when they should not.
	if (code === "FORMS_INTERNAL_ERROR" || (code === "UNKNOWN" && response.status >= 500)) {
		return { status: "unavailable", reason: `upstream HTTP ${response.status}` };
	}

	return { status: "rejected", httpStatus: response.status, code };
}

/** One id per form attempt, generated server-side when the page renders. */
export function newSubmissionId(): string {
	return randomUUID();
}
