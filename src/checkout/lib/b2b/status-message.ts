import type { B2bUiOutcome, B2bVatVerificationStatus } from "./contract";

/**
 * Which sentence the company block says, and which actions it offers. Pure: the matrix is a test, not a render.
 *
 * Rules from zadanie 02, §2: a VIES outage is never called an invalid number or an invalid company; "Pokračovať s
 * DPH" promises no refund (it confirms the real taxed quote); "bez DPH" appears only after the backend decided, never
 * on a local VIES "valid".
 */

export type B2bStatusAction = "continueWithVat" | "retry" | "recheck" | "refreshStatus";

export type B2bStatusMessage = {
	/** Full key under `checkout` (`b2b.status.*` or `payment.*`). */
	key: string;
	tone: "info" | "success" | "warning" | "error";
	actions: B2bStatusAction[];
};

export function b2bStatusMessage(params: {
	outcome: B2bUiOutcome | null;
	pending: boolean;
	vies: B2bVatVerificationStatus | null;
	/** The customer typed a VAT ID (an exemption was asked for). */
	hasVatId: boolean;
	exemptionAvailable: boolean;
}): B2bStatusMessage | null {
	const { outcome, pending, vies, hasVatId, exemptionAvailable } = params;
	if (pending) return hasVatId ? { key: "b2b.status.verifying", tone: "info", actions: [] } : null;
	if (!outcome) return null;

	switch (outcome.kind) {
		case "off":
			return hasVatId && !exemptionAvailable
				? { key: "b2b.status.serviceOff", tone: "info", actions: [] }
				: null;
		case "exempt":
			return { key: "b2b.status.exempt", tone: "success", actions: [] };
		case "unconfirmed":
			return { key: "payment.finalStateUnconfirmed", tone: "error", actions: ["retry"] };
		case "changed":
			return { key: "payment.orderUpdated", tone: "warning", actions: ["recheck"] };
		case "locked":
			return { key: "payment.checkoutLocked", tone: "error", actions: ["refreshStatus"] };
		case "taxed":
			switch (outcome.reason) {
				case "invalid":
					return { key: "b2b.status.invalid", tone: "warning", actions: ["continueWithVat"] };
				case "unavailable":
					return { key: "b2b.status.unavailable", tone: "warning", actions: ["retry", "continueWithVat"] };
				case "identity_review":
					return { key: "b2b.status.identityReview", tone: "warning", actions: ["continueWithVat"] };
				case "disabled":
					return hasVatId ? { key: "b2b.status.disabled", tone: "info", actions: ["continueWithVat"] } : null;
				case "country_mismatch":
					return { key: "b2b.status.countryMismatch", tone: "info", actions: [] };
				case "sk_vat":
					return { key: "b2b.status.skVat", tone: "info", actions: [] };
				case "domestic_delivery":
					return { key: "b2b.status.domesticDelivery", tone: "info", actions: [] };
				case "incomplete":
					return vies === "VALID"
						? { key: "b2b.status.validPendingDelivery", tone: "info", actions: [] }
						: { key: "b2b.status.incomplete", tone: "info", actions: [] };
				case "no_vat_id":
				case "not_company":
					return null;
			}
	}
	return null;
}
