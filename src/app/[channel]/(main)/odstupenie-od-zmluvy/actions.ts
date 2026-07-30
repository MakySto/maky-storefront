"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/auth/auth-rate-limit";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { getBaseUrl } from "@/lib/seo/config";
import { submitWithdrawalToPayload, updateWithdrawalEmailDelivery } from "@/lib/forms/payload-forms-client";
import { verifyOrderSelection } from "@/lib/withdrawal/account-orders";
import { WITHDRAWAL_LIMITS, WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "@/lib/withdrawal/contract";
import { unavailableMailer } from "@/lib/withdrawal/mail";
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

export interface WithdrawalReceipt {
	readonly submissionNumber: string;
	readonly submittedAt: string;
	readonly noticeSnapshot: string;
	readonly customerEmailSent: boolean;
	readonly orderNumber: string;
}

export type WithdrawalFormState =
	| { readonly status: "idle" }
	| {
			readonly status: "invalid";
			readonly errors: Partial<Record<WithdrawalField, string>>;
			/** First field to move focus to — the browser cannot know the server's order. */
			readonly focus: WithdrawalField;
	  }
	| { readonly status: "blocked"; readonly retryAfterSeconds: number }
	| { readonly status: "failed" }
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
	"orderNumber:required": "Zadajte číslo objednávky alebo iné označenie zmluvy.",
	"scope:required": "Vyberte, či odstupujete od celej objednávky alebo od vybraných položiek.",
	"items:required": "Označte aspoň jednu položku alebo ich opíšte v poznámke.",
	"items:invalidQuantity": "Počet kusov musí byť aspoň 1.",
	"items:tooMany": "Naraz je možné uviesť najviac 50 položiek.",
	"note:tooLong": "Poznámka je príliš dlhá.",
	"market:unsupportedMarket": "Tento formulár je zatiaľ dostupný len na slovenskom trhu.",
	"submissionId:invalid": "Formulár vypršal. Načítajte stránku znova a skúste to ešte raz.",
};

function messageFor(field: WithdrawalField, code: string): string {
	return MESSAGES[`${field}:${code}`] ?? "Skontrolujte prosím túto položku.";
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
	if (REVERSE_MAP[channel] !== "sk") return { status: "failed" };

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
			// The server's own view of the order number wins over the posted one.
			orderNumber = verified.orderNumber;
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
			items: claimedItems,
			note: formData.get("note"),
		},
		{
			persist: submitWithdrawalToPayload,
			mailer: unavailableMailer,
			recordDelivery: updateWithdrawalEmailDelivery,
			returnsPageUrl: `${getBaseUrl()}${marketHref(channel, "/reklamacie-a-vratenie")}`,
			verifiedOrder,
		},
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
			JSON.stringify({ reason: outcome.reason, detail: outcome.detail }),
		);
		return { status: "failed" };
	}

	return {
		status: "received",
		receipt: {
			submissionNumber: outcome.accepted.submissionNumber,
			submittedAt: outcome.accepted.submittedAt,
			noticeSnapshot: outcome.submission.noticeSnapshot,
			customerEmailSent: outcome.email.customer.status === "sent",
			orderNumber: outcome.submission.contract.orderNumber,
		},
	};
}
