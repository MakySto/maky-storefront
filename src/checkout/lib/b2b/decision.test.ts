import { describe, expect, it } from "vitest";

import { B2B_DECISIONS, type B2bInputV1 } from "./contract";
import {
	isExemptionExpired,
	outcomeAllowsPayment,
	outcomeFromBackendState,
	planB2bEvaluation,
	type B2bEvaluationContext,
} from "./decision";

const input = (patch: Partial<B2bInputV1> = {}): B2bInputV1 => ({
	schema: 1,
	isBusiness: true,
	registrationId: "",
	taxId: "",
	vatId: "DE123456789",
	...patch,
});

const context = (patch: Partial<B2bEvaluationContext> = {}): B2bEvaluationContext => ({
	channelSlug: "de-eur",
	input: input(),
	billingCompanyName: "Muster GmbH",
	shippingCountry: "DE",
	deliveryKind: "shipping",
	...patch,
});

describe("planB2bEvaluation", () => {
	it("export markets and checkouts without input are skipped entirely", () => {
		expect(planB2bEvaluation(context({ channelSlug: "us-usd" }))).toEqual({ kind: "skip" });
		expect(planB2bEvaluation(context({ channelSlug: "ca-cad" }))).toEqual({ kind: "skip" });
		expect(planB2bEvaluation(context({ input: null }))).toEqual({ kind: "skip" });
	});

	it("verifies only a foreign EU VAT ID delivered to its own country", () => {
		expect(planB2bEvaluation(context())).toEqual({ kind: "verify", vatId: "DE123456789", vatCountry: "DE" });
		// The delivery method is not required for the VIES answer.
		expect(planB2bEvaluation(context({ deliveryKind: "none" }))).toMatchObject({ kind: "verify" });
	});

	it.each([
		[{ input: input({ isBusiness: false }) }, "not_company"],
		[{ billingCompanyName: " " }, "incomplete"],
		[{ input: input({ vatId: "" }) }, "no_vat_id"],
		[{ input: input({ vatId: "SK2122890660" }), shippingCountry: "SK" }, "sk_vat"],
		[{ deliveryKind: "pickup" as const }, "domestic_delivery"],
		[{ shippingCountry: "SK" }, "domestic_delivery"],
		[{ shippingCountry: null }, "incomplete"],
		[{ shippingCountry: "AT" }, "country_mismatch"],
	])("revokes when %o (%s)", (patch, reason) => {
		expect(planB2bEvaluation(context(patch))).toEqual({ kind: "revoke", reason });
	});
});

describe("outcomeFromBackendState", () => {
	const state = (decision: string, effectiveTaxExemption = false) => ({
		decision,
		effectiveTaxExemption,
		checkedAt: "2026-11-02T10:00:00Z",
		expiresAt: "2026-11-03T10:00:00Z",
	});

	it("says 'bez DPH' only for EXEMPT with the effective flag on", () => {
		expect(outcomeFromBackendState(state("EXEMPT", true))).toEqual({
			kind: "exempt",
			checkedAt: "2026-11-02T10:00:00Z",
			expiresAt: "2026-11-03T10:00:00Z",
		});
		expect(outcomeFromBackendState(state("EXEMPT", false))).toEqual({ kind: "unconfirmed" });
	});

	it("an effective exemption under a taxed decision is a contradiction, not a discount", () => {
		expect(outcomeFromBackendState(state("TAXED_INVALID", true))).toEqual({ kind: "unconfirmed" });
	});

	it("maps every contract decision; unknown or missing is unconfirmed", () => {
		for (const decision of B2B_DECISIONS) {
			const outcome = outcomeFromBackendState(state(decision, decision === "EXEMPT"));
			expect(outcome.kind).not.toBe("unconfirmed");
		}
		expect(outcomeFromBackendState(state("SOMETHING_NEW"))).toEqual({ kind: "unconfirmed" });
		expect(outcomeFromBackendState(null)).toEqual({ kind: "unconfirmed" });
	});

	it("asks for a taxed confirmation only where an exemption was asked for and not granted", () => {
		expect(outcomeFromBackendState(state("TAXED_INVALID"))).toEqual({
			kind: "taxed",
			reason: "invalid",
			needsTaxedConfirmation: true,
		});
		expect(outcomeFromBackendState(state("TAXED_UNAVAILABLE"))).toMatchObject({
			needsTaxedConfirmation: true,
		});
		expect(outcomeFromBackendState(state("TAXED_COUNTRY_MISMATCH"))).toMatchObject({
			needsTaxedConfirmation: false,
		});
		expect(outcomeFromBackendState(state("TAXED_NO_VAT_ID"))).toMatchObject({
			needsTaxedConfirmation: false,
		});
	});

	it("out of scope and not-a-company are off; stale is changed", () => {
		expect(outcomeFromBackendState(state("OUT_OF_SCOPE"))).toEqual({ kind: "off" });
		expect(outcomeFromBackendState(state("TAXED_NOT_COMPANY"))).toEqual({ kind: "off" });
		expect(outcomeFromBackendState(state("TAXED_STALE"))).toEqual({ kind: "changed" });
	});

	it("payment may start on off, exempt and taxed only", () => {
		expect(outcomeAllowsPayment({ kind: "off" })).toBe(true);
		expect(outcomeAllowsPayment({ kind: "unconfirmed" })).toBe(false);
		expect(outcomeAllowsPayment({ kind: "changed" })).toBe(false);
		expect(outcomeAllowsPayment({ kind: "locked" })).toBe(false);
	});
});

describe("isExemptionExpired", () => {
	const now = Date.parse("2026-11-02T12:00:00Z");
	it("counts from the backend's expiresAt with a safety margin", () => {
		const base = { decision: "EXEMPT", effectiveTaxExemption: true, checkedAt: null };
		expect(isExemptionExpired({ ...base, expiresAt: "2026-11-03T11:00:00Z" }, now)).toBe(false);
		expect(isExemptionExpired({ ...base, expiresAt: "2026-11-02T12:00:30Z" }, now)).toBe(true);
		expect(isExemptionExpired({ ...base, expiresAt: null }, now)).toBe(true);
		expect(isExemptionExpired({ ...base, expiresAt: "garbage" }, now)).toBe(true);
	});
});
