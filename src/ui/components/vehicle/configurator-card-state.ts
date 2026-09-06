import { type AddSetFailure } from "@/lib/fitment/cart-result";

/**
 * How one result card presents a failed add — and, more importantly, what it offers to
 * do next.
 *
 * Pure and separate from the component because the invariant worth protecting is a
 * decision, not a layout: `checkoutLinesAdd` is not idempotent (live-verified, the same
 * call three times takes a line from 1 to 3), so after an outcome we could not confirm,
 * the control sitting under the shopper's cursor must not be the one that sends it again.
 *
 * `unconfirmed` therefore does three things at once, and they belong together:
 *
 *   - it is NOT an error. Neutral tone, `role="status"`, no red — a refusal-looking
 *     message is an invitation to click again;
 *   - the card's primary action becomes "look at your cart", because the write may well
 *     have landed and looking is the only thing that settles it;
 *   - adding again stays possible, but as a separate, differently-labelled control. This
 *     is a UX guard, not a claim of idempotency, and nothing here retries on a timer.
 *
 * `catalogue-unavailable` is deliberately NOT treated this way. Nothing was sent, the
 * cart cannot have changed, and "check your cart" would send the shopper to look at
 * something that certainly did not happen. "Try again" is the truthful offer there.
 */
export type CardFailurePresentation = {
	/** i18n key. A `__common.` prefix selects the `common` namespace instead. */
	messageKey: string;
	/** `status` is neutral and polite; `alert` is a refusal we can stand behind. */
	tone: "status" | "alert";
	/** What the card's PRIMARY control does now. */
	primaryAction: "add" | "check-cart";
};

const MESSAGE_KEY: Record<AddSetFailure, string> = {
	simulation: "errorSimulation",
	"provider-unavailable": "errorProviderUnavailable",
	"vehicle-changed": "errorVehicleChanged",
	"not-verified": "errorNotVerified",
	"not-available": "errorNotAvailable",
	"out-of-stock": "__common.outOfStock",
	"catalogue-unavailable": "errorCatalogueUnavailable",
	"cart-rejected": "errorCartRejected",
	"lookup-failed": "errorLookupFailed",
	"invalid-input": "errorGeneric",
};

/**
 * Every failure the action can produce, guaranteed complete: `MESSAGE_KEY` is typed
 * `Record<AddSetFailure, string>`, so a new failure fails to compile until it is added
 * here, and the tests then iterate the real set rather than a list someone maintains.
 */
export const ADD_SET_FAILURES = Object.keys(MESSAGE_KEY) as AddSetFailure[];

/** The one outcome that means "we do not know whether the cart changed". */
const UNCONFIRMED: AddSetFailure = "lookup-failed";

export function presentCardFailure(failure: AddSetFailure | undefined): CardFailurePresentation | null {
	if (!failure) return null;

	return failure === UNCONFIRMED
		? { messageKey: MESSAGE_KEY[failure], tone: "status", primaryAction: "check-cart" }
		: { messageKey: MESSAGE_KEY[failure], tone: "alert", primaryAction: "add" };
}
