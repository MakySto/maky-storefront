/**
 * Exported as the contract Lane B consumes: its configurator switches on
 * `reason` to pick a message, so this union is public even though nothing
 * inside Lane A imports it by name yet.
 *
 * Why an add-to-cart did not happen. Each arm is a different sentence to the
 * customer, and — more importantly — a different answer to "may I retry?".
 */
export type AddToCartRejection =
	/** Sold out, not published, not purchasable, or not in this channel. */
	| "unavailable"
	/** The request itself was wrong: zero quantity, over the limit, bad field. */
	| "invalid"
	/** Saleor does not know this variant or checkout. */
	| "not-found"
	/** The checkout could not be created or read at all. Nothing was attempted. */
	| "checkout"
	/** Saleor refused for a reason we do not model. */
	| "rejected";

export type AddToCartResult =
	/** Saleor answered and the line is in the checkout. */
	| { status: "added" }
	/**
	 * Saleor answered, and said no. Safe to tell the customer it did not happen,
	 * and safe to let them try again.
	 */
	| { status: "rejected"; reason: AddToCartRejection; message: string }
	/**
	 * We do not know whether the line was added.
	 *
	 * This is its own arm on purpose. A transport failure on a mutation that was
	 * already sent is NOT a failure — the write may well have landed — so it must
	 * never be retried automatically, or the customer gets the item twice. It must
	 * also never be reported as success.
	 */
	| { status: "unconfirmed"; message: string };

/** Shape of one `CheckoutError`, narrowed to what the classifier reads. */
interface CheckoutErrorLike {
	code?: string | null;
	field?: string | null;
	message?: string | null;
}

/**
 * Saleor's `CheckoutErrorCode`, grouped by what the customer should be told.
 *
 * The mutation used to select only `message`, so there was nothing to classify
 * on even if anyone had looked — and nobody did: both call sites checked the
 * transport's `result.ok` and treated a domain rejection as a success.
 */
const UNAVAILABLE = new Set([
	"INSUFFICIENT_STOCK",
	"PRODUCT_NOT_PUBLISHED",
	"PRODUCT_UNAVAILABLE_FOR_PURCHASE",
	"UNAVAILABLE_VARIANT_IN_CHANNEL",
	"CHANNEL_INACTIVE",
]);

const INVALID = new Set(["ZERO_QUANTITY", "QUANTITY_GREATER_THAN_LIMIT", "INVALID", "REQUIRED"]);

/** The rejected arm alone — this classifier can never produce the other two. */
type AddToCartRejected = Extract<AddToCartResult, { status: "rejected" }>;

export function classifyCheckoutErrors(errors: readonly CheckoutErrorLike[]): AddToCartRejected | null {
	if (errors.length === 0) return null;

	// Report the most actionable one rather than the first: "out of stock" is
	// worth saying, "GRAPHQL_ERROR" is not.
	const pick =
		errors.find((error) => error.code && UNAVAILABLE.has(error.code)) ??
		errors.find((error) => error.code && INVALID.has(error.code)) ??
		errors.find((error) => error.code === "NOT_FOUND") ??
		errors[0];

	const code = pick.code ?? "";
	const message = pick.message?.trim() || code || "the checkout rejected this line";

	if (UNAVAILABLE.has(code)) return { status: "rejected", reason: "unavailable", message };
	if (INVALID.has(code)) return { status: "rejected", reason: "invalid", message };
	if (code === "NOT_FOUND") return { status: "rejected", reason: "not-found", message };
	return { status: "rejected", reason: "rejected", message };
}

/**
 * What one read of the checkout says about a write whose response was lost.
 *
 * `unchanged` is deliberately NOT called "rejected". A read that comes back
 * unchanged is a statement about *this instant*, not about the future: the
 * mutation whose response we lost may still be in flight at Saleor, and a
 * timeout is precisely the case where it most likely arrived. Naming that
 * moment "nothing was added" invites a second click, and `checkoutLinesAdd` is
 * not idempotent — the same call three times takes a line from 1 to 3.
 */
export type ReadBackVerdict =
	/** At least the requested quantity is now on the line. The write landed. */
	| "landed"
	/** The line moved, but not by what we asked for. Somebody else, or a clamp. */
	| "partial"
	/** Nothing has moved yet. Not evidence that nothing ever will. */
	| "unchanged"
	/** The read itself failed, so we learned nothing at all. */
	| "unreadable";

/**
 * Read one observation of the cart. Pure, so the rule is testable without a
 * server action, a checkout, or a clock.
 *
 * `after: null` means the read failed — which is not a failed write.
 */
export function readBackVerdict(input: {
	before: number;
	requested: number;
	after: number | null;
}): ReadBackVerdict {
	const { before, requested, after } = input;
	if (after === null) return "unreadable";
	if (after >= before + requested) return "landed";
	if (after === before) return "unchanged";
	return "partial";
}

/**
 * How long to keep asking before admitting we do not know, in milliseconds.
 *
 * Bounded on purpose. Saleor may commit the lost write after we have stopped
 * looking, and no schedule can rule that out — so the deadline exists to end
 * the *waiting*, never to convert the uncertainty into a verdict.
 */
export const READ_BACK_DELAYS_MS: readonly number[] = [250, 750];
