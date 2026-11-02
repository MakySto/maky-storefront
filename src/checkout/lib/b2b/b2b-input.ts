import { B2B_INPUT_METADATA_KEY, type B2bInputV1 } from "./contract";
import {
	isValidSlovakRegistrationId,
	isValidSlovakTaxId,
	normalizeRegistrationId,
	normalizeTaxId,
	normalizeVatId,
} from "./vat-id";

/**
 * The customer's company input: what the form holds, what goes into `maky.b2b.input.v1`, and back.
 *
 * The company name is NOT in here. It has one source of truth, `checkout.billingAddress.companyName`, next to the
 * rest of the invoiced address. A non-empty legacy "Firma" field never switches B2B on by itself.
 */

export const COMPANY_NAME_MAX_LENGTH = 256;
export const REGISTRATION_ID_MAX_LENGTH = 16;
export const TAX_ID_MAX_LENGTH = 16;
/** The JSON value is small; anything bigger is not ours. */
const INPUT_VALUE_MAX_LENGTH = 1024;

export const EMPTY_B2B_INPUT: B2bInputV1 = {
	schema: 1,
	isBusiness: false,
	registrationId: "",
	taxId: "",
	vatId: "",
};

function isShortString(value: unknown, max: number): value is string {
	return typeof value === "string" && value.length <= max;
}

/**
 * Strict read of the metadata value. Anything that is not exactly the v1 shape is treated as absent — a
 * `"isBusiness": "true"` string is not `true`, and a number is not a VAT ID.
 */
export function parseB2bInput(value: string | null | undefined): B2bInputV1 | null {
	if (typeof value !== "string" || value.length === 0 || value.length > INPUT_VALUE_MAX_LENGTH) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	const record = parsed as Record<string, unknown>;
	if (record.schema !== 1 || typeof record.isBusiness !== "boolean") return null;
	if (
		!isShortString(record.registrationId, REGISTRATION_ID_MAX_LENGTH) ||
		!isShortString(record.taxId, TAX_ID_MAX_LENGTH) ||
		!isShortString(record.vatId, 32)
	) {
		return null;
	}
	return {
		schema: 1,
		isBusiness: record.isBusiness,
		registrationId: record.registrationId,
		taxId: record.taxId,
		vatId: record.vatId,
	};
}

/** Fixed key order, so the same input always serializes to the same string. */
export function serializeB2bInput(input: B2bInputV1): string {
	return JSON.stringify({
		schema: 1,
		isBusiness: input.isBusiness,
		registrationId: input.registrationId,
		taxId: input.taxId,
		vatId: input.vatId,
	});
}

export function b2bInputMetadataEntry(input: B2bInputV1): { key: string; value: string } {
	return { key: B2B_INPUT_METADATA_KEY, value: serializeB2bInput(input) };
}

/** What the company block of the form holds while the customer types. */
export type B2bFormValues = {
	isBusiness: boolean;
	companyName: string;
	registrationId: string;
	taxId: string;
	vatId: string;
};

export type B2bFormErrors = Partial<
	Record<"companyName" | "registrationId" | "taxId" | "vatId", B2bFormError>
>;

export type B2bFormError = "required" | "tooLong" | "registrationIdFormat" | "taxIdFormat" | "vatIdFormat";

export type B2bFormResult =
	| { ok: true; input: B2bInputV1; companyName: string }
	| { ok: false; errors: B2bFormErrors };

/**
 * Validate the company block against the invoiced company's country (`billingCountry`).
 *
 * - company name: required;
 * - Slovak invoiced company: IČO required, DIČ optional (format-checked when given);
 * - VAT ID: optional; when given it must have a VAT shape — a matching shape is still not a VIES answer;
 * - not a company: stores `isBusiness: false` and nothing else, so switching it off revokes the exemption;
 * - an export market (`euMarket: false`, US/CA): the company and its address only — no IČO, DIČ or VAT ID is asked
 *   for or stored there, whatever country the invoice names.
 */
export function validateB2bForm(
	values: B2bFormValues,
	billingCountry: string,
	options: { euMarket?: boolean } = {},
): B2bFormResult {
	const euMarket = options.euMarket ?? true;
	if (!values.isBusiness) {
		return { ok: true, input: { ...EMPTY_B2B_INPUT }, companyName: "" };
	}

	const errors: B2bFormErrors = {};
	const companyName = values.companyName.trim();
	if (!companyName) errors.companyName = "required";
	else if (companyName.length > COMPANY_NAME_MAX_LENGTH) errors.companyName = "tooLong";

	const isSlovak = euMarket && billingCountry.toUpperCase() === "SK";
	// The Slovak registry numbers are asked for (and kept) only for a Slovak invoiced company on an EU market: a
	// hidden field must not carry a number the customer can no longer see.
	const registrationId = isSlovak ? normalizeRegistrationId(values.registrationId) : "";
	const taxId = isSlovak ? normalizeTaxId(values.taxId) : "";

	if (isSlovak) {
		if (!registrationId) errors.registrationId = "required";
		else if (!isValidSlovakRegistrationId(registrationId)) errors.registrationId = "registrationIdFormat";
		if (taxId && !isValidSlovakTaxId(taxId)) errors.taxId = "taxIdFormat";
	}

	let vatId = "";
	if (euMarket && values.vatId.trim()) {
		const normalized = normalizeVatId(values.vatId, billingCountry);
		if (normalized.ok) vatId = normalized.vatId;
		else errors.vatId = "vatIdFormat";
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	return {
		ok: true,
		companyName,
		input: {
			schema: 1,
			isBusiness: true,
			// Non-Slovak companies have no national registry fields here; nothing invents them.
			registrationId,
			taxId,
			vatId,
		},
	};
}

/** The form's starting values from what the checkout already holds (reload, Back from Payment). */
export function b2bFormValuesFrom(
	input: B2bInputV1 | null,
	billingCompanyName: string | null | undefined,
): B2bFormValues {
	return {
		isBusiness: input?.isBusiness ?? false,
		companyName: input?.isBusiness ? billingCompanyName ?? "" : "",
		registrationId: input?.registrationId ?? "",
		taxId: input?.taxId ?? "",
		vatId: input?.vatId ?? "",
	};
}
