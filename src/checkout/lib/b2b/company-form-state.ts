import type { AddressInput, CountryCode } from "@/checkout/graphql";

import { b2bFormValuesFrom, type B2bFormErrors } from "./b2b-input";
import type { B2bInputV1 } from "./contract";

/**
 * The company block's state and the decisions around it, as pure functions — the vitest suite has no DOM, and
 * these are exactly the rules that broke before: which billing address is shown, and whether "same as delivery"
 * may be switched on by default (it must not, over a billing company that differs from the delivery one).
 */

type AddressLike = {
	firstName?: string | null;
	lastName?: string | null;
	companyName?: string | null;
	streetAddress1?: string | null;
	streetAddress2?: string | null;
	city?: string | null;
	cityArea?: string | null;
	postalCode?: string | null;
	countryArea?: string | null;
	phone?: string | null;
	country?: { code: string } | null;
};

const ADDRESS_FIELDS = [
	"firstName",
	"lastName",
	"streetAddress1",
	"streetAddress2",
	"city",
	"cityArea",
	"postalCode",
	"countryArea",
	"phone",
] as const;

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Same place? `includeCompany: false` compares the address only: a company may invoice to the delivery address
 * while the delivery address names another company (or none).
 */
export function isSameAddress(
	a: AddressLike | null | undefined,
	b: AddressLike | null | undefined,
	options: { includeCompany: boolean },
): boolean {
	if (!a || !b) return false;
	if (norm(a.country?.code) !== norm(b.country?.code)) return false;
	if (options.includeCompany && norm(a.companyName) !== norm(b.companyName)) return false;
	return ADDRESS_FIELDS.every((field) => norm(a[field]) === norm(b[field]));
}

/**
 * The ordinary (non-company) payment step's "same as delivery" default, from what is STORED — so a reload, Back and
 * Forward restore it. On only when there is no billing address yet, or the stored one IS the delivery address
 * (company included). A billing address that differs keeps the form open and is never overwritten by a copy.
 */
export function defaultSameAsShipping(checkout: {
	isShippingRequired: boolean;
	shippingAddress?: AddressLike | null;
	billingAddress?: AddressLike | null;
}): boolean {
	if (!checkout.isShippingRequired || !checkout.shippingAddress) return false;
	if (!checkout.billingAddress) return true;
	return isSameAddress(checkout.billingAddress, checkout.shippingAddress, { includeCompany: true });
}

export type B2bCompanyFieldsValue = {
	isBusiness: boolean;
	companyName: string;
	registrationId: string;
	taxId: string;
	vatId: string;
	/** "Fakturačná adresa je rovnaká ako dodacia" — the address, never the identity of the buyer. */
	billingSameAsShipping: boolean;
	billingCountry: CountryCode;
	billingForm: Record<string, string>;
};

function formFrom(address: AddressLike | null | undefined): Record<string, string> {
	return Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, address?.[field] ?? ""]));
}

/** Starting state from the checkout (reload, Back from Payment): the stored company and billing address. */
export function initialCompanyFieldsValue(
	checkout: { billingAddress?: AddressLike | null; shippingAddress?: AddressLike | null },
	input: B2bInputV1 | null,
	fallbackCountry: CountryCode,
): B2bCompanyFieldsValue {
	const values = b2bFormValuesFrom(input, checkout.billingAddress?.companyName);
	const billing = checkout.billingAddress;
	const shipping = checkout.shippingAddress;
	return {
		...values,
		billingSameAsShipping:
			!billing || !shipping || isSameAddress(billing, shipping, { includeCompany: false }),
		billingCountry: ((billing?.country?.code || shipping?.country?.code) as CountryCode) || fallbackCountry,
		billingForm: formFrom(billing),
	};
}

/**
 * The billing address a company purchase writes: the delivery ADDRESS (when "same as delivery") or the billing
 * form, always with the company name the customer typed. The delivery address's own `companyName` is not carried
 * over — the invoiced company is the one in the company block.
 */
export function companyBillingAddressInput(
	value: B2bCompanyFieldsValue,
	companyName: string,
	shippingInput: AddressInput | null,
): AddressInput | null {
	if (value.billingSameAsShipping && shippingInput) {
		return { ...shippingInput, companyName };
	}
	const entries = Object.entries(value.billingForm).filter(
		([, fieldValue]) => fieldValue && fieldValue.trim(),
	);
	return { ...Object.fromEntries(entries), country: value.billingCountry, companyName } as AddressInput;
}

/** Switching the company purchase off keeps the address and drops the company from the invoice. */
export function billingWithoutCompany(billing: AddressLike | null | undefined): AddressInput | null {
	if (!billing?.companyName?.trim() || !billing.country?.code) return null;
	const entries = ADDRESS_FIELDS.map((field) => [field, billing[field] ?? ""] as const).filter(([, v]) =>
		v.trim(),
	);
	return { ...Object.fromEntries(entries), country: billing.country.code } as AddressInput;
}

/** i18n keys (under `checkout`) for the form's error codes. */
export function companyFieldErrorKey(
	field: keyof B2bFormErrors,
	error: NonNullable<B2bFormErrors[keyof B2bFormErrors]>,
) {
	if (error === "tooLong") return "b2b.errors.tooLong";
	if (error === "required")
		return field === "companyName" ? "b2b.errors.companyNameRequired" : "b2b.errors.registrationIdRequired";
	return `b2b.errors.${error}`;
}
