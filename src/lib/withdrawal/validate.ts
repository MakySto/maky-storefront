import {
	WITHDRAWAL_LIMITS,
	WITHDRAWAL_LOCALE,
	WITHDRAWAL_MARKET,
	type WithdrawalItem,
	type WithdrawalScope,
	type WithdrawalSource,
} from "./contract";

/**
 * Authoritative server-side validation of a withdrawal notice.
 *
 * ## What this refuses, and what it deliberately does not
 *
 * It refuses input that is malformed: a missing name, an address that cannot be an
 * e-mail, a quantity of zero, a body longer than any real notice.
 *
 * It does NOT refuse a notice because the order cannot be found, because the order
 * looks older than fourteen days, because nothing has been delivered yet, or because
 * the goods might fall under a statutory exception. Every one of those has an innocent
 * explanation — a mistyped number, an order placed under another e-mail, a deadline
 * extended by missing information, a withdrawal before delivery, a genuine dispute
 * about the goods. A withdrawal is a unilateral declaration; the storefront's job is
 * to receive it and record when it arrived. Whether it succeeds is decided afterwards
 * by a human, from an internal review state.
 *
 * Refusing here would not just be rude. It would destroy the evidence that the notice
 * was ever given.
 */

export type WithdrawalField =
	| "customerName"
	| "customerEmail"
	| "customerPhone"
	| "orderNumber"
	| "scope"
	| "items"
	| "note"
	| "submissionId"
	| "market";

export interface FieldError {
	readonly field: WithdrawalField;
	/** Stable code — the UI owns the wording, this owns the meaning. */
	readonly code: string;
}

export interface ValidatedInput {
	readonly submissionId: string;
	readonly source: WithdrawalSource;
	readonly name: string;
	readonly email: string;
	readonly phone: string | null;
	readonly orderNumber: string;
	readonly scope: WithdrawalScope;
	readonly items: readonly WithdrawalItem[];
	readonly note: string | null;
}

export type ValidationResult =
	| { readonly ok: true; readonly value: ValidatedInput }
	| { readonly ok: false; readonly errors: readonly FieldError[] };

export interface RawWithdrawalInput {
	readonly submissionId: unknown;
	readonly source: unknown;
	readonly market: unknown;
	readonly locale: unknown;
	readonly name: unknown;
	readonly email: unknown;
	readonly phone: unknown;
	readonly orderNumber: unknown;
	readonly scope: unknown;
	readonly items: unknown;
	readonly note: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Deliberately permissive.
 *
 * A regex cannot decide whether an address exists, and every strict pattern in the
 * wild rejects addresses that work. This checks the shape a typo would break —
 * exactly one `@`, something either side, a dot in the domain, no whitespace — and
 * leaves the rest to the confirmation e-mail.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Trim, collapse whitespace, drop control characters.
 *
 * Control characters are stripped rather than rejected: a stray one is almost always a
 * copy-paste artefact, and refusing a whole notice over an invisible byte would be
 * exactly the avoidable rejection this module exists to prevent. They are removed
 * because the value ends up in an e-mail and a printed record, where a bare CR or a NUL
 * is at best noise.
 *
 * Written as escapes, never as literal bytes — a raw control character in a source file
 * makes git treat it as binary and the diff becomes unreviewable.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
// Same, minus \n and \t, which are meaningful in a multi-line field.
const CONTROL_CHARS_KEEP_BREAKS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function clean(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Same, but line breaks survive — a note or an item description may be multi-line. */
function cleanMultiline(value: unknown): string {
	if (typeof value !== "string") return "";
	return value
		.replace(CONTROL_CHARS_KEEP_BREAKS, " ")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function parseItems(raw: unknown, errors: FieldError[]): WithdrawalItem[] {
	if (!Array.isArray(raw)) return [];

	if (raw.length > WITHDRAWAL_LIMITS.items) {
		errors.push({ field: "items", code: "tooMany" });
		return [];
	}

	const items: WithdrawalItem[] = [];
	for (const entry of raw) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry as Record<string, unknown>;

		const productName = cleanMultiline(record.productName).slice(0, WITHDRAWAL_LIMITS.productName);
		if (productName.length === 0) continue;

		const rawQuantity = typeof record.quantity === "number" ? record.quantity : Number(record.quantity);
		if (!Number.isInteger(rawQuantity) || rawQuantity < 1) {
			errors.push({ field: "items", code: "invalidQuantity" });
			continue;
		}
		if (rawQuantity > WITHDRAWAL_LIMITS.quantityPerItem) {
			errors.push({ field: "items", code: "invalidQuantity" });
			continue;
		}

		const orderLineId = clean(record.orderLineId);
		items.push({
			orderLineId: orderLineId.length > 0 ? orderLineId.slice(0, 128) : null,
			productName,
			// Never populated in V1 — see WithdrawalItem.sku.
			sku: null,
			quantity: rawQuantity,
		});
	}

	return items;
}

export function validateWithdrawal(raw: RawWithdrawalInput): ValidationResult {
	const errors: FieldError[] = [];

	// Market and locale are fixed for V1. A mismatch means the request did not come
	// from the route that is supposed to serve this form.
	if (raw.market !== WITHDRAWAL_MARKET || raw.locale !== WITHDRAWAL_LOCALE) {
		errors.push({ field: "market", code: "unsupportedMarket" });
	}

	const submissionId = clean(raw.submissionId);
	if (!UUID_RE.test(submissionId)) errors.push({ field: "submissionId", code: "invalid" });

	// `source` is a hint about which UI produced this, not an authorisation claim.
	// Ownership is proven separately, server-side, against the session.
	const source: WithdrawalSource = raw.source === "account" ? "account" : "guest";

	const name = clean(raw.name).slice(0, WITHDRAWAL_LIMITS.name);
	if (name.length === 0) errors.push({ field: "customerName", code: "required" });

	const email = clean(raw.email).slice(0, WITHDRAWAL_LIMITS.email);
	if (email.length === 0) errors.push({ field: "customerEmail", code: "required" });
	else if (!EMAIL_RE.test(email)) errors.push({ field: "customerEmail", code: "invalid" });

	const phoneRaw = clean(raw.phone);
	const phone = phoneRaw.length > 0 ? phoneRaw.slice(0, WITHDRAWAL_LIMITS.phone) : null;

	// The contract identifier. An order number is the usual one, but any identifier the
	// customer can give is accepted — the point is that the contract is identifiable,
	// not that it matches a row we can find today.
	const orderNumber = clean(raw.orderNumber).slice(0, WITHDRAWAL_LIMITS.orderNumber);
	if (orderNumber.length === 0) errors.push({ field: "orderNumber", code: "required" });

	const scope: WithdrawalScope | null =
		raw.scope === "wholeOrder" || raw.scope === "selectedItems" ? raw.scope : null;
	if (!scope) errors.push({ field: "scope", code: "required" });

	const items = parseItems(raw.items, errors);
	// Partial withdrawal has to say what it covers, otherwise the record is meaningless.
	// Whole-order withdrawal needs no item list at all.
	if (scope === "selectedItems" && items.length === 0) {
		errors.push({ field: "items", code: "required" });
	}

	const noteRaw = cleanMultiline(raw.note);
	if (noteRaw.length > WITHDRAWAL_LIMITS.note) errors.push({ field: "note", code: "tooLong" });
	const note = noteRaw.length > 0 ? noteRaw.slice(0, WITHDRAWAL_LIMITS.note) : null;

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			submissionId,
			source,
			name,
			email,
			phone,
			orderNumber,
			// Both narrowed above; the guard is for the type checker, not for runtime.
			scope: scope ?? "wholeOrder",
			// A whole-order notice may still carry the lines, for the record. It just
			// does not need them.
			items,
			note,
		},
	};
}
