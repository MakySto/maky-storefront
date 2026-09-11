"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/auth/auth-rate-limit";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { validateContact, type ContactErrors, type ContactField } from "@/lib/contact/validate";
import {
	CONTACT_MARKET_LOCALES,
	isAllowedMarketLocale,
	type ContactSubmission,
} from "@/lib/forms/contact-contract";
import { submitContactToPayload } from "@/lib/forms/payload-forms-client";
import { PRIVACY_NOTICE_VERSION } from "@/lib/withdrawal/contract";

/**
 * The contact server action.
 *
 * A Server Action rather than a route handler, for the same three reasons the
 * withdrawal form uses one: Next verifies the Origin against the Host on every action
 * invocation, which is the same-origin check the brief asks for; the result comes back
 * as action state, so the acknowledgement renders without a redirect and no personal
 * data ever reaches a URL; and the whole path is server-only, so the HMAC secret and
 * the Cloudflare Access credentials cannot be reachable from the bundle.
 *
 * ## What the browser is not trusted for
 *
 * Market and locale are derived HERE from the route's channel, never read from the
 * form. A client-supplied market would let anyone file a message against any market's
 * mailbox, and the pair is validated as a pair — `{DE, sk}` is two individually valid
 * values and one invalid request.
 *
 * ## Why the submission id comes from the client
 *
 * It is generated once when the form renders and resubmitted unchanged on a retry, so
 * the provider's unique index turns a retry into a replay rather than a second message.
 * A server-generated id would be new on every attempt, which is exactly the duplicate
 * this is meant to prevent. It is validated as a UUID and never trusted for anything
 * else.
 */

/** What the browser is told. A projection — never the provider's envelope. */
export interface ContactAcknowledgement {
	/** `KON-YYYY-NNNNNN`, the reference a customer can quote. */
	readonly submissionNumber: string;
	/** True when this retry replayed a message already on file. */
	readonly duplicate: boolean;
}

/** Why nothing is on file, in terms the UI can act on. */
export type ContactFailureKind = "conflict" | "tooLarge" | "unavailable" | "notConfigured";

export type ContactFormState =
	| { readonly status: "idle" }
	| {
			readonly status: "invalid";
			readonly errors: ContactErrors;
			/** First field to move focus to — the browser cannot know the server's order. */
			readonly focus: ContactField;
	  }
	| { readonly status: "blocked"; readonly retryAfterSeconds: number }
	| { readonly status: "failed"; readonly kind: ContactFailureKind }
	| { readonly status: "received"; readonly acknowledgement: ContactAcknowledgement };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(headerBag: Headers): string {
	const forwarded = headerBag.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return headerBag.get("x-real-ip") ?? "unknown";
}

/** One id per form attempt, generated when the page renders and kept across retries. */
export async function newContactSubmissionId(): Promise<string> {
	return randomUUID();
}

export async function submitContactAction(
	_previous: ContactFormState,
	formData: FormData,
): Promise<ContactFormState> {
	const channel = String(formData.get("channel") ?? "");
	const market = REVERSE_MAP[channel] ? CHANNEL_MAP[REVERSE_MAP[channel]]?.country : undefined;
	const locale = market ? CONTACT_MARKET_LOCALES[market] : undefined;

	// An unknown channel cannot be attributed to a market, so there is nothing to file
	// the message against. Not a validation error the customer can fix.
	if (!market || !locale || !isAllowedMarketLocale(market, locale)) {
		return { status: "failed", kind: "notConfigured" };
	}

	const headerBag = await headers();
	const input = {
		name: String(formData.get("name") ?? ""),
		email: String(formData.get("email") ?? ""),
		phone: String(formData.get("phone") ?? ""),
		topic: String(formData.get("topic") ?? ""),
		order: String(formData.get("order") ?? ""),
		message: String(formData.get("message") ?? ""),
	};

	// Rate limit before validation, so a flood of invalid submissions is as cheap to
	// refuse as a flood of valid ones. Two buckets: the address is the one an abuser
	// varies last, the IP the one they vary first.
	const emailKey = input.email.trim().toLowerCase();
	const ipCheck = checkRateLimit(`contact:ip:${clientIp(headerBag)}`, {
		limit: 12,
		windowMs: 15 * 60 * 1000,
	});
	const emailCheck = emailKey
		? checkRateLimit(`contact:email:${emailKey}`, { limit: 6, windowMs: 15 * 60 * 1000 })
		: ({ allowed: true } as const);

	if (!ipCheck.allowed || !emailCheck.allowed) {
		return {
			status: "blocked",
			retryAfterSeconds: Math.max(
				ipCheck.allowed ? 0 : ipCheck.retryAfterSeconds,
				emailCheck.allowed ? 0 : emailCheck.retryAfterSeconds,
			),
		};
	}

	const validated = validateContact(input);
	if (!validated.ok) {
		return { status: "invalid", errors: validated.errors, focus: validated.focus };
	}

	const submissionId = String(formData.get("submissionId") ?? "");
	if (!UUID.test(submissionId)) {
		// The form always supplies one. A missing or malformed id means we cannot
		// promise idempotency, and filing anyway would risk the duplicate it prevents.
		return { status: "failed", kind: "unavailable" };
	}

	const submission: ContactSubmission = {
		submissionId,
		source: (await hasAuthSession()) ? "account" : "guest",
		market,
		locale,
		customer: {
			name: validated.value.name,
			email: validated.value.email,
			phone: validated.value.phone,
		},
		topic: validated.value.topic,
		order: validated.value.order,
		message: validated.value.message,
		privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
	};

	const outcome = await submitContactToPayload(submission);

	switch (outcome.status) {
		case "ok":
			return {
				status: "received",
				acknowledgement: {
					submissionNumber: outcome.value.submissionNumber,
					duplicate: outcome.value.duplicate,
				},
			};
		case "notConfigured":
			return { status: "failed", kind: "notConfigured" };
		case "rejected":
			// `SUBMISSION_ID_CONFLICT` means this id is already on file with DIFFERENT
			// content — a genuinely different message reusing an id, which the customer
			// resolves by starting a new one. Everything else the provider refuses is
			// reported as unavailable rather than guessed at.
			if (outcome.code === "SUBMISSION_ID_CONFLICT") return { status: "failed", kind: "conflict" };
			if (outcome.code === "BODY_TOO_LARGE") return { status: "failed", kind: "tooLarge" };
			return { status: "failed", kind: "unavailable" };
		case "unavailable":
		default:
			// A timeout says the ANSWER did not arrive, not that nothing was stored. The
			// UI says so, and the retry reuses this submissionId so the provider can
			// recognise it rather than file a second message.
			return { status: "failed", kind: "unavailable" };
	}
}
