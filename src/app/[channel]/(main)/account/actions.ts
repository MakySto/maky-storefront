"use server";

import { revalidatePath } from "next/cache";
import {
	AccountUpdateDocument,
	PasswordChangeDocument,
	AccountAddressCreateDocument,
	AccountAddressUpdateDocument,
	AccountAddressDeleteDocument,
	AccountSetDefaultAddressDocument,
	AccountRequestDeletionDocument,
	type AddressInput,
	type CountryCode,
	AddressTypeEnum,
} from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { getFormString, getFormStringOptional } from "@/ui/components/account/form-utils";

/**
 * `error` is Saleor's (English) message and is for logs only. The form shows its own translated
 * text, picked by `code` — Saleor's `AccountErrorCode`, or one of ours — and `field` where
 * Saleor names the field it rejected (see `account-error.ts`).
 */
type ActionResult = { success: true } | { success: false; error: string; code?: string; field?: string };

type SaleorError = { message?: string | null; code?: string | null; field?: string | null };

function failed(error: SaleorError | undefined, fallback: string): ActionResult {
	return {
		success: false,
		error: error?.message || fallback,
		code: error?.code ?? undefined,
		field: error?.field ?? undefined,
	};
}

/** A request that failed before Saleor could judge it — the validation errors, if it did. */
function requestFailed(error: {
	message: string;
	validationErrors?: ReadonlyArray<{ field?: string | null; message: string; code?: string | null }>;
}): ActionResult {
	return failed(error.validationErrors?.[0] ?? { message: error.message }, error.message);
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
	const firstName = getFormString(formData, "firstName");
	const lastName = getFormString(formData, "lastName");

	const result = await executeAuthenticatedGraphQL(AccountUpdateDocument, {
		variables: { input: { firstName, lastName } },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountUpdate?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to update profile");
	}

	revalidatePath("/account", "layout");
	return { success: true };
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
	const oldPassword = getFormString(formData, "oldPassword");
	const newPassword = getFormString(formData, "newPassword");
	const confirmPassword = getFormString(formData, "confirmPassword");

	if (newPassword.length < 8) {
		return {
			success: false,
			error: "New password must be at least 8 characters",
			code: "PASSWORD_TOO_SHORT",
		};
	}

	if (newPassword !== confirmPassword) {
		return { success: false, error: "Passwords do not match", code: "PASSWORD_MISMATCH" };
	}

	const result = await executeAuthenticatedGraphQL(PasswordChangeDocument, {
		variables: { oldPassword, newPassword },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.passwordChange?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to change password");
	}

	return { success: true };
}

export async function createAddress(formData: FormData): Promise<ActionResult> {
	const input = extractAddressInput(formData);

	const result = await executeAuthenticatedGraphQL(AccountAddressCreateDocument, {
		variables: { input },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountAddressCreate?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to create address");
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function updateAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");
	const input = extractAddressInput(formData);

	const result = await executeAuthenticatedGraphQL(AccountAddressUpdateDocument, {
		variables: { id, input },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountAddressUpdate?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to update address");
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function deleteAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");

	const result = await executeAuthenticatedGraphQL(AccountAddressDeleteDocument, {
		variables: { id },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountAddressDelete?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to delete address");
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function setDefaultAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");
	const type = getFormString(formData, "type");

	const addressType = type === "BILLING" ? AddressTypeEnum.Billing : AddressTypeEnum.Shipping;

	const result = await executeAuthenticatedGraphQL(AccountSetDefaultAddressDocument, {
		variables: { id, type: addressType },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountSetDefaultAddress?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to set default address");
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function requestAccountDeletion(formData: FormData): Promise<ActionResult> {
	const redirectUrl = getFormString(formData, "redirectUrl");
	const channel = getFormStringOptional(formData, "channel");

	const result = await executeAuthenticatedGraphQL(AccountRequestDeletionDocument, {
		variables: { redirectUrl, channel },
		cache: "no-cache",
	});

	if (!result.ok) {
		return requestFailed(result.error);
	}

	const errors = result.data.accountRequestDeletion?.errors;
	if (errors?.length) {
		return failed(errors[0], "Failed to request account deletion");
	}

	return { success: true };
}

function extractAddressInput(formData: FormData): AddressInput {
	return {
		firstName: getFormStringOptional(formData, "firstName"),
		lastName: getFormStringOptional(formData, "lastName"),
		companyName: getFormStringOptional(formData, "companyName"),
		streetAddress1: getFormStringOptional(formData, "streetAddress1"),
		streetAddress2: getFormStringOptional(formData, "streetAddress2"),
		city: getFormStringOptional(formData, "city"),
		postalCode: getFormStringOptional(formData, "postalCode"),
		countryArea: getFormStringOptional(formData, "countryArea"),
		country: getFormStringOptional(formData, "country") as CountryCode | undefined,
		phone: getFormStringOptional(formData, "phone"),
	};
}
