import { NextRequest, NextResponse } from "next/server";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { executeRawGraphQL, getUserMessage } from "@/lib/graphql";

const CONFIRM_ACCOUNT_MUTATION = `
  mutation ConfirmAccount($email: String!, $token: String!) {
    confirmAccount(email: $email, token: $token) {
      user {
        isActive
        isConfirmed
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

interface ConfirmAccountRequest {
	email?: string;
	token?: string;
}

interface ConfirmAccountResult {
	confirmAccount?: {
		user?: { isActive: boolean; isConfirmed: boolean } | null;
		errors?: Array<{ field?: string | null; message: string; code?: string | null }>;
	};
}

/**
 * Activate an account from the link in the ACCOUNT_CONFIRMATION e-mail.
 *
 * Sign-up used to send Saleor `/{market}/login` as the redirect URL, the same one the
 * password reset uses, so the activation link opened "Set new password" and nothing ever
 * called `confirmAccount`. Every account registered with e-mail confirmation on stayed
 * unconfirmed and could not sign in (reported on production 2026-11-08).
 *
 * Saleor's message is never returned: the page shows its own translated text by code.
 */
export async function POST(request: NextRequest) {
	const rateLimited = rejectIfRateLimited(request, "confirm-account");
	if (rateLimited) {
		return rateLimited;
	}

	let body: ConfirmAccountRequest;
	try {
		body = (await request.json()) as ConfirmAccountRequest;
	} catch {
		return NextResponse.json(
			{ errors: [{ message: "Invalid request body", code: "INVALID_JSON" }] },
			{ status: 400 },
		);
	}

	const email = typeof body.email === "string" ? body.email.trim() : "";
	const token = typeof body.token === "string" ? body.token.trim() : "";

	if (!email || !token) {
		return NextResponse.json(
			{ errors: [{ message: "Email and token are required", code: "REQUIRED" }] },
			{ status: 400 },
		);
	}

	const result = await executeRawGraphQL<ConfirmAccountResult>({
		query: CONFIRM_ACCOUNT_MUTATION,
		variables: { email, token },
	});

	if (!result.ok) {
		console.error("Account confirmation error:", result.error.type);
		return NextResponse.json(
			{ errors: [{ message: getUserMessage(result.error), code: result.error.type.toUpperCase() }] },
			{ status: result.error.type === "network" ? 503 : 400 },
		);
	}

	const confirmAccount = result.data.confirmAccount;

	if (confirmAccount?.errors?.length) {
		return NextResponse.json(
			{
				errors: confirmAccount.errors.map((error) => ({
					message: "Confirmation failed",
					code: error.code ?? null,
				})),
			},
			{ status: 400 },
		);
	}

	if (!confirmAccount?.user?.isConfirmed) {
		return NextResponse.json({ errors: [{ message: "Confirmation failed", code: null }] }, { status: 400 });
	}

	return NextResponse.json({ success: true });
}
