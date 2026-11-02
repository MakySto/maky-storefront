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

/** An address as the form sends it, in the shape of a stored one (`country: { code }`), for comparisons. */
function storedShapeOf(input: AddressInput): AddressLike {
	const { country, ...rest } = input as AddressInput & Record<string, unknown>;
	return { ...(rest as AddressLike), country: country ? { code: String(country) } : null };
}

/**
 * A billing address that was only a COPY of the delivery address follows it.
 *
 * The case: a payment attempt copies the delivery address into billing ("same as delivery"); it fails; the customer
 * changes the delivery address in the Information step. Without this the Payment step found a billing address that
 * no longer matches the delivery one, unticked "same as delivery" and kept the old copy for the invoice. So when the
 * stored billing address IS the stored delivery address (company included) and the delivery address changes, the
 * new delivery address is written as billing too. A billing address that differs is the customer's own and is never
 * touched; neither is anything when the delivery address did not change. Holds with the company purchase off too.
 */
export function billingToFollowShipping(
	stored: { billingAddress?: AddressLike | null; shippingAddress?: AddressLike | null },
	nextShipping: AddressInput | null,
): AddressInput | null {
	const { billingAddress, shippingAddress } = stored;
	if (!nextShipping || !billingAddress || !shippingAddress) return null;
	if (!isSameAddress(billingAddress, shippingAddress, { includeCompany: true })) return null;
	if (isSameAddress(storedShapeOf(nextShipping), shippingAddress, { includeCompany: true })) return null;
	return nextShipping;
}

/**
 * The billing address written when the company purchase is switched OFF. With "same as delivery" it is the delivery
 * address being saved (so it follows a delivery change made in the same step, as an ordinary purchase would);
 * otherwise the stored billing address without the company.
 */
export function billingWhenCompanyOff(
	value: Pick<B2bCompanyFieldsValue, "billingSameAsShipping">,
	options: { sameAsShippingOffered: boolean; storedBilling: AddressLike | null | undefined },
	shippingInput: AddressInput | null,
): AddressInput | null {
	if (options.sameAsShippingOffered && value.billingSameAsShipping && shippingInput) return shippingInput;
	return billingWithoutCompany(options.storedBilling);
}

/**
 * Where a Saleor error of the billing write is shown. "Same as delivery" copies the delivery address, so its field
 * errors belong to the delivery form; a separate billing address has its own fields in the company block. An error
 * without a field, or on a field that is not on screen (a saved address picked from the list), is said on the form
 * instead of being put on an input nobody sees.
 */
export type BillingErrorPlacement = {
	/** Keys as `B2bCompanyFields` renders them: `companyName`, `billing.<field>`. */
	company: Record<string, string>;
	/** Keys as the delivery address form renders them. */
	shipping: Record<string, string>;
	form: string[];
};

export function placeBillingErrors(
	errors: ReadonlyArray<{ field?: string | null; message?: string | null }>,
	where: { sameAsShipping: boolean; billingFields: readonly string[]; shippingFields: readonly string[] },
	fallbackMessage: string,
): BillingErrorPlacement {
	const placed: BillingErrorPlacement = { company: {}, shipping: {}, form: [] };
	for (const error of errors) {
		const message = error.message || fallbackMessage;
		const field = error.field ?? "";
		if (field === "companyName") placed.company.companyName = message;
		else if (!field) placed.form.push(message);
		else if (where.sameAsShipping && where.shippingFields.includes(field)) placed.shipping[field] = message;
		else if (!where.sameAsShipping && where.billingFields.includes(field))
			placed.company[`billing.${field}`] = message;
		else placed.form.push(message);
	}
	placed.form = [...new Set(placed.form)];
	return placed;
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
