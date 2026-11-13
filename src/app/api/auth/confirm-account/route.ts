import { NextRequest, NextResponse } from "next/server";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { executeRawGraphQL, getUserMessage } from "@/lib/graphql";

const CONFIRM_ACCOUNT_MUTATION = `
  mutation ConfirmAccount($email: String!, $token: String!) {
    confirmAccount(email: $email, token: $token) {
      user {
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
		user?: { isConfirmed: boolean } | null;
		errors?: Array<{ field?: string | null; message: string; code?: string | null }>;
	} | null;
}

/**
 * Activate an account from the link in the registration e-mail.
 *
 * Saleor sends that link to the `redirectUrl` of `accountRegister` with `?email=…&token=…`
 * appended (it replaces any query the URL had). Until 2026-11-08 the sign-up form pointed it
 * at /login, which reads `email` + `token` as a password reset, so a new customer was asked to
 * set a new password and the account stayed unconfirmed. The link now opens /login/confirm,
 * whose page posts here.
 *
 * Signs nobody in and sets no cookies: the customer signs in with the password they chose.
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

	const { email, token } = body;

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
		console.error("Confirm account error:", result.error.type);
		return NextResponse.json(
			{ errors: [{ message: getUserMessage(result.error), code: result.error.type.toUpperCase() }] },
			{ status: result.error.type === "network" ? 503 : 400 },
		);
	}

	const errors = result.data.confirmAccount?.errors ?? [];

	if (errors.length) {
		return NextResponse.json(
			{ errors: errors.map((e) => ({ message: e.message, code: e.code ?? null })) },
			{ status: 400 },
		);
	}

	if (!result.data.confirmAccount?.user?.isConfirmed) {
		return NextResponse.json(
			{ errors: [{ message: "Account not confirmed", code: "INVALID" }] },
			{ status: 400 },
		);
	}

	return NextResponse.json({ success: true });
}
