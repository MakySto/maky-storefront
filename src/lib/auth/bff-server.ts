import "server-only";

import { saleorWriteDecision } from "@/lib/saleor/write-policy";
import { mapSaleorAuthErrors } from "./auth-api-utils";
import type { AuthApiError } from "./auth-api-types";
import { getServerAuthClient } from "./server";

export type { AuthApiError };

/**
 * The write guard does not reach this file on its own.
 *
 * `@saleor/auth-sdk` builds its own requests on `globalThis.fetch`, so
 * `signIn` (`tokenCreate`) and `resetPassword` (`setPassword`) never pass through
 * `executeGraphQL` or `executeRawGraphQL` where the guard sits. `setPassword`
 * changes a real customer's password, so a development session pointed at
 * production must not be able to reach it. Checked here instead, at the two entry
 * points that perform an account mutation.
 *
 * Token REFRESH is deliberately not blocked: it is how an already-authenticated
 * read stays readable, refusing it would break ordinary read-only work against
 * production data, and it writes nothing a customer would notice.
 */
function writesRefused(): AuthApiError[] | null {
	const decision = saleorWriteDecision();
	if (decision.allowed) return null;
	console.warn(`[auth] refused an account mutation: ${decision.reason}`);
	return [{ message: "This action is not available in this environment." }];
}

/** Sign in via Saleor and persist tokens in request cookies (BFF). */
export async function signInWithPassword(
	email: string,
	password: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	const refused = writesRefused();
	if (refused) return { ok: false, errors: refused };

	const authClient = await getServerAuthClient();
	const result = await authClient.signIn({ email, password });
	const tokenCreate = result.data?.tokenCreate;

	if (tokenCreate?.errors?.length) {
		return { ok: false, errors: mapSaleorAuthErrors(tokenCreate.errors, "Sign in failed") };
	}

	if (tokenCreate?.token) {
		return { ok: true };
	}

	return { ok: false, errors: [{ message: "Sign in failed" }] };
}

/** Complete password reset and establish a session (BFF). */
export async function resetPasswordWithToken(
	email: string,
	token: string,
	password: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	const refused = writesRefused();
	if (refused) return { ok: false, errors: refused };

	const authClient = await getServerAuthClient();
	const result = await authClient.resetPassword({ email, token, password });
	const setPassword = result.data?.setPassword;

	if (setPassword?.errors?.length) {
		return { ok: false, errors: mapSaleorAuthErrors(setPassword.errors, "Failed to reset password") };
	}

	if (setPassword?.token) {
		return { ok: true };
	}

	return { ok: false, errors: [{ message: "Failed to reset password" }] };
}

/** Clear Saleor auth cookies for the current session. */
export async function signOutSession(): Promise<void> {
	(await getServerAuthClient()).signOut();
}
