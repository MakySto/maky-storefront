/**
 * The Contact wire contract, revision 1.3.0.
 *
 * Values mirror `__fixtures__/forms-backend-v1/manifest.json` — the provider's own
 * machine-readable contract, vendored verbatim — and `contact-contract.test.ts` reads
 * that manifest and fails if these drift from it. Two independent readings of one wire
 * format is how the storefront and Payload were both green while every real request
 * would have failed; that is the mistake this file exists not to repeat.
 */

/** `POST` target, relative to the forms base URL. */
export const CONTACT_ENDPOINT = "/api/forms/contact";

export const CONTACT_LIMITS = {
	/** The provider refuses a larger body; we refuse it first rather than spend a trip. */
	bodyBytes: 65_536,
	timestampSkewSeconds: 300,
} as const;

export const CONTACT_SOURCES = ["guest", "account"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const CONTACT_TOPICS = [
	"productAdvice",
	"orderStatus",
	"shipping",
	"returns",
	"complaint",
	"payment",
	"account",
	"businessCooperation",
	"other",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/**
 * The market/locale pairs the provider accepts.
 *
 * Twelve markets over ten locales: AT and DE both send `de`, US and CA both send `en`.
 * The pair is validated rather than the two halves separately, because `{DE, sk}` is
 * two individually valid values and one invalid request.
 */
export const CONTACT_MARKET_LOCALES: Readonly<Record<string, string>> = {
	SK: "sk",
	CZ: "cs",
	PL: "pl",
	HU: "hu",
	RO: "ro",
	AT: "de",
	DE: "de",
	IT: "it",
	FR: "fr",
	ES: "es",
	US: "en",
	CA: "en",
};

export function isAllowedMarketLocale(market: string, locale: string): boolean {
	return CONTACT_MARKET_LOCALES[market] === locale;
}

/** The request body, exactly as the provider's `contact.schema.json` describes it. */
export interface ContactSubmission {
	readonly submissionId: string;
	readonly source: ContactSource;
	readonly market: string;
	readonly locale: string;
	readonly customer: {
		readonly name: string;
		readonly email: string;
		readonly phone: string | null;
	};
	readonly topic: ContactTopic;
	readonly order: string | null;
	readonly message: string;
	readonly privacyNoticeVersion: string;
}

/**
 * Per-channel delivery state, as the provider reports it.
 *
 * Customer and internal are tracked separately on purpose: one can succeed while the
 * other fails, and collapsing them would let a failed internal notification hide behind
 * a delivered customer confirmation.
 */
export interface ContactEmailDelivery {
	readonly customerStatus: string;
	readonly customerSentAt: string | null;
	readonly customerAttemptCount: number;
	readonly customerLastAttemptAt: string | null;
	readonly internalStatus: string;
	readonly internalSentAt: string | null;
	readonly internalAttemptCount: number;
	readonly internalLastAttemptAt: string | null;
}

export interface ContactAccepted {
	readonly id: string;
	readonly submissionId: string;
	/** `KON-YYYY-NNNNNN`. The reference a customer can quote. */
	readonly submissionNumber: string;
	readonly submittedAt: string;
	readonly emailDelivery: ContactEmailDelivery;
	/** True when this request replayed an existing record rather than creating one. */
	readonly duplicate: boolean;
}

const SUBMISSION_NUMBER_PATTERN = /^KON-\d{4}-\d{6}$/;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function parseDelivery(value: unknown): ContactEmailDelivery | null {
	if (typeof value !== "object" || value === null) return null;
	const d = value as Record<string, unknown>;
	const channel = (prefix: "customer" | "internal") =>
		isNonEmptyString(d[`${prefix}Status`]) && typeof d[`${prefix}AttemptCount`] === "number";
	if (!channel("customer") || !channel("internal")) return null;
	return {
		customerStatus: d.customerStatus as string,
		customerSentAt: (d.customerSentAt as string | null) ?? null,
		customerAttemptCount: d.customerAttemptCount as number,
		customerLastAttemptAt: (d.customerLastAttemptAt as string | null) ?? null,
		internalStatus: d.internalStatus as string,
		internalSentAt: (d.internalSentAt as string | null) ?? null,
		internalAttemptCount: d.internalAttemptCount as number,
		internalLastAttemptAt: (d.internalLastAttemptAt as string | null) ?? null,
	};
}

/**
 * Read an acknowledgement, requiring `duplicate` to agree with the status line.
 *
 * 201 means created, 200 means the record already existed. If the body disagreed with
 * the status, we would be telling the customer something the provider did not say —
 * so a disagreement is a contract violation, not a detail to smooth over.
 */
export function parseContactAccepted(body: unknown, expectDuplicate: boolean): ContactAccepted | null {
	if (typeof body !== "object" || body === null) return null;
	const envelope = body as { ok?: unknown; duplicate?: unknown; submission?: unknown };
	if (envelope.ok !== true) return null;
	if (envelope.duplicate !== expectDuplicate) return null;
	if (typeof envelope.submission !== "object" || envelope.submission === null) return null;

	const s = envelope.submission as Record<string, unknown>;
	const delivery = parseDelivery(s.emailDelivery);
	if (
		!isNonEmptyString(s.id) ||
		!isNonEmptyString(s.submissionId) ||
		!isNonEmptyString(s.submissionNumber) ||
		!SUBMISSION_NUMBER_PATTERN.test(s.submissionNumber) ||
		!isNonEmptyString(s.submittedAt) ||
		!delivery
	) {
		return null;
	}

	return {
		id: s.id,
		submissionId: s.submissionId,
		submissionNumber: s.submissionNumber,
		submittedAt: s.submittedAt,
		emailDelivery: delivery,
		duplicate: expectDuplicate,
	};
}
