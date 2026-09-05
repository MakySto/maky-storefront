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
