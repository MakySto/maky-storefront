import { NextRequest, NextResponse } from "next/server";
import { httpStatusForAuthErrors } from "@/lib/auth/auth-api-utils";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { resetPasswordWithToken } from "@/lib/auth/bff-server";

interface SetPasswordRequest {
	email: string;
	token: string;
	password: string;
}

/**
 * Complete a password reset.
 *
 * Uses the BFF `resetPasswordWithToken`, which runs the reset through
 * `getServerAuthClient()` so the real Saleor session cookies (the ones the auth SDK reads)
 * are set server-side. The response carries NO token and this route sets NO cookies of its
 * own — fixing the previous leak (raw token in the JSON body + dead `token`/`refreshToken`
 * cookies that nothing read, so the user was never actually signed in after a reset).
 */
export async function POST(request: NextRequest) {
	const rateLimited = rejectIfRateLimited(request, "set-password");
	if (rateLimited) {
		return rateLimited;
	}

	let body: SetPasswordRequest;
	try {
		body = (await request.json()) as SetPasswordRequest;
	} catch {
		return NextResponse.json(
			{ errors: [{ message: "Invalid request body", code: "INVALID_JSON" }] },
			{ status: 400 },
		);
	}

	const { email, token, password } = body;

	if (!email || !token || !password) {
		return NextResponse.json(
			{ errors: [{ message: "Email, token, and password are required", code: "REQUIRED" }] },
			{ status: 400 },
		);
	}

	if (password.length < 8) {
		return NextResponse.json(
			{ errors: [{ message: "Password must be at least 8 characters", code: "PASSWORD_TOO_SHORT" }] },
			{ status: 400 },
		);
	}

	const result = await resetPasswordWithToken(email, token, password);

	if (!result.ok) {
		return NextResponse.json({ errors: result.errors }, { status: httpStatusForAuthErrors(result.errors) });
	}

	return NextResponse.json({
		success: true,
		message: "Password updated successfully",
	});
}
