import { type WithdrawalCopy } from "./copy-de";

/**
 * United States English copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Nothing imports this, and that is correct. Returns V2 pins `market: "SK"` and
 * `locale: "sk"` as literal types (`contract.ts`), so the Payload endpoint rejects a
 * notice submitted from `/us`. Rendering the form there would offer a customer a button
 * that cannot produce a legal record — the one outcome the feature exists to prevent.
 * `servesOnlineFunction()` keeps the form Slovak-only, and `/us/odstupenie-od-zmluvy`
 * renders the "preview not activated" notice instead.
 *
 * ## This market is NOT in the position Italy, France and Romania are in
 *
 * Those three acquired a statutory online-withdrawal function on 19 June 2026, so their
 * preview state is a dated gap. The United States has no equivalent duty, and the package does not
 * invent one: the 14/30 days here are a MAKY benefit under the agreed Slovak framework,
 * not a US federal statutory cooling-off period. The FTC's three-day Cooling-Off Rule does not
 * reach purchases made entirely online, which is exactly why the page says so.
 *
 * That makes the preview state defensible for longer than it is elsewhere. It does not
 * make it good, and it is not a reason to wire the form incorrectly.
 *
 * ## Routine pickup is not offered, and `pickupInterest` must not imply it is
 *
 * `data/form-capabilities.en-US.json` says `showPickupInterest: false`, and the delivered
 * `pickupHelp` says so in the customer's words. The key is kept because the schema keeps
 * it and dropping it would make this file structurally unlike the other nine — not because
 * the field should be rendered. **Do not render it as an available offer**, and do not
 * reach for the existing SK `returnMethod: merchantPickup` to describe a customer shipping
 * the parcel themselves: that would write a false method into a legal record. `collection_offered`
 * belongs only to a real, separately evidenced offer in a specific case.
 *
 * ## Provenance
 *
 * Every string is the delivered editorial value, verbatim, from `data/ui.en-US.json`
 * (`schema maky-editorial-ui/1`, `locale en-US`), GENERATED from that JSON rather than
 * typed out — a hand-written Polish draft once drifted from the approved export in 21 of
 * 38 strings.
 *
 * `privacyHref` (`/us/ochrana-osobnych-udajov`) and the `formExtras` block are in the delivered
 * JSON but not in `WithdrawalCopy`. They are recorded in the R handoff rather than bolted
 * onto a shared type this thread does not own.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * 1. The form's strings still live inline in `withdrawal-form.tsx` JSX. Wiring a second
 *    language means extracting them into a copy map first.
 * 2. **The storefront prints no time at all, and must not start.** `WithdrawalV2Accepted`
 *    carries no timestamp, `withdrawal-form.tsx` renders none, and `formsTimestampSeconds()`
 *    is the HMAC replay window, not a business time. Both time labels are dormant in every
 *    language, Slovak included. `acceptedBody` promises the time the notice was SENT, so an
 *    ordinary check that Payload's confirmation prints that is enough. Never mint a second
 *    timestamp here, and never fill `receivedTimeLabel` by copying another field.
 * 3. **Never submit `us` as `market: "SK"`.** It would write a legal record naming the
 *    wrong market.
 */
export const WITHDRAWAL_COPY_EN_US: WithdrawalCopy = {
	entryLabel: "Cancel a purchase",
	formTitle: "Online cancellation",
	intro: "You can send a cancellation notice without a customer account. You do not need to give a reason.",
	fullName: {
		label: "Full name",
		help: "Enter the name of the person canceling the purchase.",
		requiredError: "Enter your full name.",
	},
	email: {
		label: "Email for your confirmation",
		help: "We will send a copy of your notice and an acknowledgment to this address.",
		requiredError: "Enter an email address for the confirmation.",
		invalidError: "Check that the email address is correct.",
	},
	contractReference: {
		label: "Order number or other purchase details",
		help: "Your order confirmation includes the order number. If you cannot find it, describe the purchase, for example the product and approximate order date.",
		requiredError: "Enter details that let us identify the purchase.",
	},
	scopeLabel: "What would you like to cancel?",
	scopeWhole: "The whole order",
	scopePartial: "Selected products only",
	itemsLabel: "Products and quantities",
	itemsHelp:
		"Enter the product name or code and quantity. It does not need to match the catalog wording exactly, but we need to identify the items.",
	itemsRequiredError: "Enter the products and quantities you are canceling.",
	pickupInterest: "I would like a quote for return pickup",
	pickupHelp:
		"Routine return pickup is not offered for this market. This field is not available for a standard change-of-mind return.",
	noteLabel: "Additional message (optional)",
	privacyNotice:
		"We use these details to receive and handle your cancellation and meet our legal obligations. See the Privacy policy for more information.",
	reviewButton: "Review details",
	reviewTitle: "Review your cancellation notice",
	declarationWhole: "I hereby cancel the entire purchase contract identified below.",
	declarationPartial:
		"I hereby cancel the purchase contract identified below in respect of the listed products and quantities.",
	finalExplanation:
		"The button below sends your cancellation notice. It is not just a question for customer support.",
	editButton: "Edit details",
	submitButton: "Confirm cancellation",
	submitting: "Sending your notice…",
	acceptedTitle: "We have received your cancellation notice",
	acceptedBody:
		"We will email your confirmation with a copy of the notice and the date and time it was sent. We will also explain the next steps.",
	receiptNumberLabel: "Reference number",
	submissionTimeLabel: "Date and time sent",
	receivedTimeLabel: "Date and time received",
	saveReceipt: "Save confirmation",
	emailIssue:
		"Your notice has been recorded, but we have not yet been able to send the confirmation email. We will retry. You can also save the confirmation here; your notice remains recorded as received.",
	failedTitle: "We could not record your notice",
	failedBody: "Try again or email your notice to info@maky.store. Your entries remain in the form.",
	unknownTitle: "We could not confirm whether your notice was received",
	unknownBody:
		"We cannot reliably determine whether your notice was received. Please check your email. A retry will use the same identifier to avoid a duplicate notice. You can also email your notice to info@maky.store.",
	rateLimit: "Sending is temporarily limited. Try again later or email your notice to info@maky.store.",
	unavailable:
		"Online submission is temporarily unavailable. You can email your notice to info@maky.store or send it by mail. We are working to restore online submission.",
	noScript:
		"The interactive form needs JavaScript. You can also email your notice to info@maky.store or use the printable cancellation form.",
};
