"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/auth/auth-rate-limit";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { REVERSE_MAP } from "@/lib/channel-map";
import { submitWithdrawalToPayload, type FormsErrorCode } from "@/lib/forms/payload-forms-client";
import { verifyOrderSelection } from "@/lib/withdrawal/account-orders";
import {
	WITHDRAWAL_LIMITS,
	WITHDRAWAL_LOCALE,
	WITHDRAWAL_MARKET,
	isWithdrawalFormServable,
} from "@/lib/withdrawal/contract";
import { renderNoticeFromSnapshot } from "@/lib/withdrawal/notice";
import { submitWithdrawal } from "@/lib/withdrawal/submit";
import { type WithdrawalField } from "@/lib/withdrawal/validate";

/**
 * The withdrawal server action.
 *
 * A Server Action rather than a route handler, for three reasons that all matter here:
 * Next verifies the Origin against the Host on every action invocation, which is the
 * same-origin check the brief asks for; the result comes back as action state, so the
 * confirmation renders without a redirect and no personal data ever reaches a URL; and
 * the whole path is server-only, so no credential can be reachable from the bundle.
 */

/** Whether the customer's confirmation e-mail went out. `unknown` is not `failed`. */
export type CustomerEmailState = "sent" | "failed" | "unknown";

export interface WithdrawalReceipt {
	readonly submissionNumber: string;
	readonly submittedAt: string;
	/** Rendered from the snapshot Payload stored — never rebuilt from the form input. */
	readonly notice: string;
	readonly customerEmail: CustomerEmailState;
	readonly orderNumber: string;
	/** True when this was a retry and the original record was returned. */
	readonly duplicate: boolean;
}

/** Why nothing was stored, in terms the UI can act on. */
export type FailureKind = "conflict" | "tooLarge" | "unavailable";

export type WithdrawalFormState =
	| { readonly status: "idle" }
	| {
			readonly status: "invalid";
			readonly errors: Partial<Record<WithdrawalField, string>>;
			/** First field to move focus to — the browser cannot know the server's order. */
			readonly focus: WithdrawalField;
	  }
	| { readonly status: "blocked"; readonly retryAfterSeconds: number }
	| { readonly status: "failed"; readonly kind: FailureKind }
	| { readonly status: "received"; readonly receipt: WithdrawalReceipt };

/**
 * Wording lives here, not in the validator.
 *
 * The validator emits stable codes so it can be tested and reused; turning a code into
 * a sentence is a presentation concern. These are field-level UI messages, not the
 * legal notice — that text is versioned separately and is pending review.
 */
const MESSAGES: Record<string, string> = {
	"customerName:required": "Zadajte meno a priezvisko.",
	"customerEmail:required": "Zadajte e-mailovú adresu.",
	"customerEmail:invalid": "Skontrolujte tvar e-mailovej adresy.",
	// Both phone errors say the field can simply be left out, because it can. Nobody
	// should lose a withdrawal to a formatting argument about an optional field.
	"customerPhone:invalid": "Telefónne číslo obsahuje neplatné znaky. Opravte ho alebo pole nechajte prázdne.",
	"customerPhone:tooLong":
		"Telefónne číslo môže mať najviac 32 znakov. Skráťte ho alebo pole nechajte prázdne.",
	"orderNumber:required": "Zadajte číslo objednávky alebo iné označenie zmluvy.",
	"scope:required": "Vyberte, či odstupujete od celej objednávky alebo od vybraných položiek.",
	"items:required": "Uveďte aspoň jednu položku — názov tovaru a počet kusov.",
	"items:invalidQuantity": "Počet kusov musí byť aspoň 1.",
	"items:tooMany": "Naraz je možné uviesť najviac 100 položiek.",
	"note:tooLong": "Poznámka je príliš dlhá.",
	"market:unsupportedMarket": "Tento formulár je zatiaľ dostupný len na slovenskom trhu.",
	"submissionId:invalid": "Formulár vypršal. Načítajte stránku znova a skúste to ešte raz.",
};

function messageFor(field: WithdrawalField, code: string): string {
	return MESSAGES[`${field}:${code}`] ?? "Skontrolujte prosím túto položku.";
}

/**
 * Payload's error codes, mapped to what the customer should do about it.
 *
 * The backend's own message text never reaches the page. It is written for an operator,
 * and echoing it would risk putting submitted values in front of whoever is looking at
 * the screen — including, on a shared machine, somebody who should not see them.
 *
 * Almost everything here is our bug rather than the customer's, so it collapses to the
 * same honest answer: the notice was not stored, here are the other ways to give it.
 * Two codes are worth distinguishing, because the customer can actually act on them.
 */
function failureKindFor(code: FormsErrorCode | null): FailureKind {
	switch (code) {
		// Same submissionId, different content: a stale tab re-posted after an edit.
		case "SUBMISSION_ID_CONFLICT":
			return "conflict";
		case "BODY_TOO_LARGE":
			return "tooLarge";
		case "INVALID_TIMESTAMP":
		case "STALE_TIMESTAMP":
		case "INVALID_SIGNATURE":
		case "INVALID_REQUEST":
		case "FORMS_AUTH_UNAVAILABLE":
		case "FORMS_INTERNAL_ERROR":
		default:
			return "unavailable";
	}
}

/** Order the fields appear in, so focus lands on the first problem the user can see. */
const FIELD_ORDER: readonly WithdrawalField[] = [
	"customerName",
	"customerEmail",
	"customerPhone",
	"orderNumber",
	"scope",
	"items",
	"note",
	"submissionId",
	"market",
];

function clientIp(headerBag: Headers): string {
	const forwarded = headerBag.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return headerBag.get("x-real-ip") ?? "unknown";
}

function readItems(
	formData: FormData,
): { orderLineId: string | null; productName: string; quantity: number }[] {
	const raw = formData.get("items");
	if (typeof raw !== "string" || raw.length === 0) return [];
	if (raw.length > WITHDRAWAL_LIMITS.bodyBytes) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.slice(0, WITHDRAWAL_LIMITS.items).map((entry) => {
			const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
			return {
				orderLineId: typeof record.orderLineId === "string" ? record.orderLineId : null,
				productName: typeof record.productName === "string" ? record.productName : "",
				quantity: Number(record.quantity) || 0,
			};
		});
	} catch {
		return [];
	}
}

export async function submitWithdrawalAction(
	channel: string,
	_previous: WithdrawalFormState,
	formData: FormData,
): Promise<WithdrawalFormState> {
	if (REVERSE_MAP[channel] !== "sk") return { status: "failed", kind: "unavailable" };

	// The page stops rendering the form while the online function is off, but a form
	// already open in a tab would still post here. The gate has to sit on both, or it is
	// only a suggestion.
	if (!isWithdrawalFormServable()) return { status: "failed", kind: "unavailable" };

	// A field no human sees and no assistive technology announces. A filled one is a
	// bot, and it is dropped rather than answered — but as a *blocked* state, never as
	// a fake success, because a false positive here would silently swallow a real
	// notice from someone using an aggressive autofill extension.
	if ((formData.get("website") ?? "") !== "") {
		return { status: "blocked", retryAfterSeconds: 0 };
	}

	const headerBag = await headers();
	const email = String(formData.get("customerEmail") ?? "")
		.trim()
		.toLowerCase();

	// Two buckets, both generous. The limiter exists to stop a script, not a determined
	// customer retrying after a timeout — the alternative routes are shown on rejection
	// so a legal notice never dead-ends here.
	const ipCheck = checkRateLimit(`withdrawal:ip:${clientIp(headerBag)}`, {
		limit: 12,
		windowMs: 15 * 60 * 1000,
	});
	const emailCheck = email
		? checkRateLimit(`withdrawal:email:${email}`, { limit: 6, windowMs: 15 * 60 * 1000 })
		: ({ allowed: true } as const);

	if (!ipCheck.allowed || !emailCheck.allowed) {
		const retryAfterSeconds = Math.max(
			ipCheck.allowed ? 0 : ipCheck.retryAfterSeconds,
			emailCheck.allowed ? 0 : emailCheck.retryAfterSeconds,
		);
		console.warn("[withdrawal] rate-limited", JSON.stringify({ retryAfterSeconds }));
		return { status: "blocked", retryAfterSeconds };
	}

	const claimedItems = readItems(formData);
	const claimedOrderId = String(formData.get("saleorOrderId") ?? "").trim() || null;

	// Account mode. The session decides, not the form: a signed-out visitor who posts
	// an order id gets nothing, and a signed-in one only ever gets their own order back.
	let verifiedOrder: { saleorOrderId: string | null; saleorCustomerId: string | null } | undefined;
	let orderNumber = String(formData.get("orderNumber") ?? "");
	let items = claimedItems;

	if (claimedOrderId && (await hasAuthSession())) {
		const verified = await verifyOrderSelection({
			claimedOrderId,
			claimedLines: claimedItems.map((item) => ({
				orderLineId: item.orderLineId,
				quantity: item.quantity,
			})),
		});
		if (verified) {
			verifiedOrder = { saleorOrderId: verified.saleorOrderId, saleorCustomerId: null };
			// The server's own view of the order wins over anything that was posted.
			orderNumber = verified.orderNumber;
			items = verified.lines.map((line) => ({
				orderLineId: line.id,
				productName: line.productName,
				quantity: line.quantity,
			}));
		}
	}

	const outcome = await submitWithdrawal(
		{
			submissionId: formData.get("submissionId"),
			source: verifiedOrder ? "account" : "guest",
			market: WITHDRAWAL_MARKET,
			locale: WITHDRAWAL_LOCALE,
			name: formData.get("customerName"),
			email: formData.get("customerEmail"),
			phone: formData.get("customerPhone"),
			orderNumber,
			scope: formData.get("scope"),
			items,
			note: formData.get("note"),
		},
		{ persist: submitWithdrawalToPayload, verifiedOrder },
	);

	if (outcome.status === "invalid") {
		const errors: Partial<Record<WithdrawalField, string>> = {};
		for (const error of outcome.errors) {
			errors[error.field] ??= messageFor(error.field, error.code);
		}
		const focus = FIELD_ORDER.find((field) => errors[field]) ?? "customerName";
		return { status: "invalid", errors, focus };
	}

	if (outcome.status === "notReceived") {
		// No record exists. Say so — a success page here would be the worst possible
		// outcome, because the customer would stop pursuing a right they still have.
		console.error(
			"[withdrawal] not-received",
			JSON.stringify({ reason: outcome.reason, code: outcome.code, detail: outcome.detail }),
		);
		return { status: "failed", kind: failureKindFor(outcome.code) };
	}

	const { accepted } = outcome;

	return {
		status: "received",
		receipt: {
			submissionNumber: accepted.submissionNumber,
			submittedAt: accepted.submittedAt,
			// The authoritative snapshot, rendered. Not a second copy of the notice.
			notice: renderNoticeFromSnapshot(accepted.noticeSnapshot),
			// Only a definitive `failed` is reported as failed. `pending` means the attempt
			// has not finished and `unknown` means it finished ambiguously — the contract
			// requires an operator to reconcile that against the provider's log before
			// anyone concludes anything. Both are "we do not know yet", and saying
			// otherwise would tell a customer their confirmation did not arrive when it
			// may well have.
			customerEmail: !accepted.emailDelivery
				? "unknown"
				: accepted.emailDelivery.customerStatus === "sent"
					? "sent"
					: accepted.emailDelivery.customerStatus === "failed"
						? "failed"
						: "unknown",
			orderNumber: accepted.noticeSnapshot.contract.orderNumber,
			duplicate: accepted.duplicate,
		},
	};
}
