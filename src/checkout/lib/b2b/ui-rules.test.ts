import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	billingWithoutCompany,
	companyBillingAddressInput,
	companyFieldErrorKey,
	defaultSameAsShipping,
	initialCompanyFieldsValue,
	isSameAddress,
	type B2bCompanyFieldsValue,
} from "./company-form-state";
import type { B2bTaxedReason, B2bUiOutcome, B2bVatVerificationStatus } from "./contract";
import { b2bPaymentGate, taxedQuoteKey } from "./payment-gate";
import { b2bStatusMessage } from "./status-message";
import { vatFieldLabelKey } from "./vat-id";

/** The company block's rules, without a DOM: which address is shown, what is said, when "pay" is allowed. */

const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
];
const messages = Object.fromEntries(
	LOCALES.map((locale) => [
		locale,
		JSON.parse(
			readFileSync(path.join(process.cwd(), "src/i18n/messages", `${locale}.json`), "utf8"),
		) as Record<string, unknown>,
	]),
);
const lookup = (locale: string, key: string): unknown =>
	key
		.split(".")
		.reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[locale]);

const shipping = {
	firstName: "Max",
	lastName: "Muster",
	companyName: "Delivery Recipient GmbH",
	streetAddress1: "Musterstr. 1",
	city: "Berlin",
	postalCode: "10115",
	country: { code: "DE" },
};

describe("billing address: the sameAsBilling overwrite (zadanie 02, §2)", () => {
	it("an ordinary checkout without a billing address starts with 'same as delivery'", () => {
		expect(
			defaultSameAsShipping({ isShippingRequired: true, shippingAddress: shipping, billingAddress: null }),
		).toBe(true);
	});

	it("a stored billing company different from the delivery one is never replaced by a copy", () => {
		const billing = { ...shipping, companyName: "Invoice Company s. r. o." };
		expect(
			defaultSameAsShipping({ isShippingRequired: true, shippingAddress: shipping, billingAddress: billing }),
		).toBe(false);
	});

	it("an identical billing address (company included) keeps 'same as delivery' after a reload", () => {
		expect(
			defaultSameAsShipping({
				isShippingRequired: true,
				shippingAddress: shipping,
				billingAddress: { ...shipping },
			}),
		).toBe(true);
	});

	it("isSameAddress can ignore the company: invoicing to the delivery address of another company", () => {
		const billing = { ...shipping, companyName: "Invoice Company" };
		expect(isSameAddress(billing, shipping, { includeCompany: false })).toBe(true);
		expect(isSameAddress(billing, shipping, { includeCompany: true })).toBe(false);
		expect(isSameAddress({ ...billing, city: "München" }, shipping, { includeCompany: false })).toBe(false);
	});

	it("the company purchase writes the company it was given, not the delivery 'Firma'", () => {
		const value: B2bCompanyFieldsValue = {
			isBusiness: true,
			companyName: "Invoice Company",
			registrationId: "",
			taxId: "",
			vatId: "",
			billingSameAsShipping: true,
			billingCountry: "DE",
			billingForm: {},
		};
		const shippingInput = { ...shipping, country: "DE" } as never;
		expect(companyBillingAddressInput(value, "Invoice Company", shippingInput)).toMatchObject({
			companyName: "Invoice Company",
			city: "Berlin",
		});
		const separate = companyBillingAddressInput(
			{
				...value,
				billingSameAsShipping: false,
				billingCountry: "AT",
				billingForm: { city: "Wien", streetAddress1: " " },
			},
			"Invoice Company",
			shippingInput,
		);
		expect(separate).toEqual({ city: "Wien", country: "AT", companyName: "Invoice Company" });
	});

	it("switching the company purchase off keeps the address and drops the company", () => {
		expect(billingWithoutCompany({ ...shipping, companyName: "Invoice Company" })).toEqual({
			firstName: "Max",
			lastName: "Muster",
			streetAddress1: "Musterstr. 1",
			city: "Berlin",
			postalCode: "10115",
			country: "DE",
		});
		expect(billingWithoutCompany({ ...shipping, companyName: "" })).toBeNull();
	});

	it("restores the stored company block after a reload", () => {
		const value = initialCompanyFieldsValue(
			{ billingAddress: { ...shipping, companyName: "Invoice Company" }, shippingAddress: shipping },
			{ schema: 1, isBusiness: true, registrationId: "", taxId: "", vatId: "DE123456789" },
			"SK",
		);
		expect(value).toMatchObject({
			isBusiness: true,
			companyName: "Invoice Company",
			vatId: "DE123456789",
			billingSameAsShipping: true,
			billingCountry: "DE",
		});
	});
});

describe("b2bPaymentGate", () => {
	const gate = (outcome: B2bUiOutcome | null, patch: Partial<Parameters<typeof b2bPaymentGate>[0]> = {}) =>
		b2bPaymentGate({
			businessMode: true,
			euMarket: true,
			outcome,
			pending: false,
			taxedConfirmed: false,
			...patch,
		});

	it("an ordinary or export checkout is never held", () => {
		expect(gate(null, { businessMode: false })).toEqual({ allowed: true, state: "ready" });
		expect(gate(null, { euMarket: false })).toEqual({ allowed: true, state: "ready" });
	});

	it("waits for the confirmed state", () => {
		expect(gate(null)).toEqual({ allowed: false, state: "pending" });
		expect(gate({ kind: "off" }, { pending: true })).toEqual({ allowed: false, state: "pending" });
	});

	it("an exemption that was asked for and not granted needs 'Pokračovať s DPH' first", () => {
		const outcome: B2bUiOutcome = { kind: "taxed", reason: "unavailable", needsTaxedConfirmation: true };
		expect(gate(outcome)).toEqual({ allowed: false, state: "needs_confirmation" });
		expect(gate(outcome, { taxedConfirmed: true })).toEqual({ allowed: true, state: "ready" });
		expect(gate({ kind: "taxed", reason: "sk_vat", needsTaxedConfirmation: false })).toEqual({
			allowed: true,
			state: "ready",
		});
	});

	it("unconfirmed, changed and locked never allow a payment", () => {
		for (const kind of ["unconfirmed", "changed", "locked"] as const) {
			expect(gate({ kind })).toEqual({ allowed: false, state: "blocked" });
		}
	});

	it("a confirmation belongs to one taxed total and reason", () => {
		const outcome: B2bUiOutcome = { kind: "taxed", reason: "invalid", needsTaxedConfirmation: true };
		const quote = (amount: number) => ({ totalPrice: { gross: { amount, currency: "EUR" } } });
		expect(taxedQuoteKey(quote(154.98), outcome)).toBe("invalid|EUR|154.9800");
		expect(taxedQuoteKey(quote(154.98), outcome)).not.toBe(taxedQuoteKey(quote(160), outcome));
		expect(taxedQuoteKey(quote(126), { kind: "exempt", checkedAt: null, expiresAt: null })).toBeNull();
	});
});

describe("b2bStatusMessage", () => {
	const message = (
		outcome: B2bUiOutcome | null,
		patch: Partial<Parameters<typeof b2bStatusMessage>[0]> = {},
	) =>
		b2bStatusMessage({
			outcome,
			pending: false,
			vies: null,
			hasVatId: true,
			exemptionAvailable: true,
			...patch,
		});
	const taxed = (reason: B2bTaxedReason): B2bUiOutcome => ({
		kind: "taxed",
		reason,
		needsTaxedConfirmation: true,
	});

	it("a VIES outage is never called an invalid number", () => {
		expect(message(taxed("unavailable"))).toEqual({
			key: "b2b.status.unavailable",
			tone: "warning",
			actions: ["retry", "continueWithVat"],
		});
		expect(message(taxed("invalid"))?.key).toBe("b2b.status.invalid");
	});

	it("'bez DPH' only after the backend decided; pending says it is being checked", () => {
		expect(message(null, { pending: true })?.key).toBe("b2b.status.verifying");
		expect(message(null, { pending: true, hasVatId: false })).toBeNull();
		expect(message({ kind: "exempt", checkedAt: null, expiresAt: null })?.key).toBe("b2b.status.exempt");
		expect(message(taxed("incomplete"), { vies: "VALID" as B2bVatVerificationStatus })?.key).toBe(
			"b2b.status.validPendingDelivery",
		);
	});

	it("readiness off: says the automatic check is unavailable, not 'with VAT'", () => {
		expect(message({ kind: "off" }, { exemptionAvailable: false })?.key).toBe("b2b.status.serviceOff");
		expect(message({ kind: "off" })).toBeNull();
	});

	it("payment states use the payment sentences", () => {
		expect(message({ kind: "unconfirmed" })?.key).toBe("payment.finalStateUnconfirmed");
		expect(message({ kind: "changed" })?.key).toBe("payment.orderUpdated");
		expect(message({ kind: "locked" })?.key).toBe("payment.checkoutLocked");
	});

	it("every key it can return exists in all 12 locales", () => {
		const outcomes: B2bUiOutcome[] = [
			{ kind: "off" },
			{ kind: "exempt", checkedAt: null, expiresAt: null },
			{ kind: "unconfirmed" },
			{ kind: "changed" },
			{ kind: "locked" },
			...(
				[
					"invalid",
					"unavailable",
					"country_mismatch",
					"identity_review",
					"sk_vat",
					"domestic_delivery",
					"no_vat_id",
					"not_company",
					"incomplete",
					"disabled",
				] as B2bTaxedReason[]
			).map(taxed),
		];
		const keys = new Set<string>();
		for (const outcome of outcomes) {
			for (const vies of [null, "VALID"] as const) {
				for (const exemptionAvailable of [true, false]) {
					const found = message(outcome, { vies, exemptionAvailable });
					if (found) {
						keys.add(found.key);
						found.actions.forEach((action) => keys.add(`b2b.actions.${action}`));
					}
				}
			}
		}
		keys.add("b2b.status.verifying");
		for (const locale of LOCALES) {
			for (const key of keys) {
				expect(typeof lookup(locale, `checkout.${key}`), `${locale}: checkout.${key}`).toBe("string");
			}
		}
	});
});

describe("labels the company block uses", () => {
	it("the VAT field label exists for every key vatFieldLabelKey returns, in every locale", () => {
		const keys = new Set(
			["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO", "NL", "GR", null].map(vatFieldLabelKey),
		);
		for (const locale of LOCALES) {
			for (const key of keys) {
				expect(typeof lookup(locale, `checkout.b2b.vatLabel.${key}`), `${locale}: ${key}`).toBe("string");
			}
		}
		// The national names are the same in every language: it is the invoiced company's country that names the field.
		expect(lookup("en-US", "checkout.b2b.vatLabel.SK")).toBe("IČ DPH");
		expect(lookup("de-DE", "checkout.b2b.vatLabel.AT")).toBe("UID-Nummer");
	});

	it("every form error code has its sentence in every locale", () => {
		const keys = [
			companyFieldErrorKey("companyName", "required"),
			companyFieldErrorKey("registrationId", "required"),
			companyFieldErrorKey("registrationId", "registrationIdFormat"),
			companyFieldErrorKey("taxId", "taxIdFormat"),
			companyFieldErrorKey("vatId", "vatIdFormat"),
			companyFieldErrorKey("vatId", "tooLong"),
		];
		for (const locale of LOCALES) {
			for (const key of keys) {
				expect(typeof lookup(locale, `checkout.${key}`), `${locale}: ${key}`).toBe("string");
			}
		}
	});

	it("the Slovak sentences are the brief's own", () => {
		expect(lookup("sk-SK", "checkout.b2b.summaryExempt")).toBe("Bez DPH — oslobodené podľa § 43");
		expect(lookup("sk-SK", "checkout.b2b.status.verifying")).toBe("Overujeme IČ DPH…");
		expect(lookup("sk-SK", "checkout.b2b.status.exempt")).toBe(
			"IČ DPH overené. Dodanie je oslobodené od DPH; uvedená cena je bez DPH.",
		);
		expect(lookup("sk-SK", "checkout.b2b.status.countryMismatch")).toBe(
			"Bez DPH vieme automaticky spracovať doručenie do krajiny vášho IČ DPH. Pri inom doručení nás kontaktujte.",
		);
		expect(lookup("sk-SK", "checkout.payment.orderUpdated")).toBe(
			"Objednávka sa aktualizovala. Skontrolujte novú sumu pred platbou.",
		);
		expect(lookup("sk-SK", "checkout.payment.finalStateUnconfirmed")).toBe(
			"Konečnú cenu sa teraz nepodarilo potvrdiť. Skúste to znova.",
		);
		expect(lookup("sk-SK", "checkout.b2b.actions.continueWithVat")).toBe("Pokračovať s DPH");
	});

	it("no sentence promises a refund", () => {
		for (const locale of LOCALES) {
			const b2b = JSON.stringify(lookup(locale, "checkout.b2b"));
			expect(b2b).not.toMatch(
				/refund|vrát|vrac|erstatt|rembours|reembols|rimbors|zwrot|visszatérít|rambursa/i,
			);
		}
	});
});
