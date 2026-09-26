/**
 * Which of our own texts explains a failed account action.
 *
 * Saleor answers every account mutation with an English `message` and a stable `code`
 * (`AccountErrorCode`). The message is never shown: on a Slovak page it is English, and the
 * wording is Saleor's, not ours. Until 2026-09-26 the sign-in form printed "Invalid email or
 * password. Please try again." in every market. The code picks a translated text instead, and a
 * code this table does not know falls back to the form's own "that did not work" text, never to
 * Saleor's message.
 *
 * The keys are full paths from the message root, because the checkout had already translated
 * the sign-in and password-reset texts into all twelve languages. Those are reused, not
 * translated a second time.
 */
export type AccountAction =
	| "signIn"
	| "signUp"
	| "forgotPassword"
	| "setPassword"
	| "passwordChange"
	| "profile"
	| "address"
	| "addressDelete"
	| "deletion";

const FALLBACK: Readonly<Record<AccountAction, string>> = {
	signIn: "checkout.contactSection.signInFailed",
	signUp: "account.errors.signUpFailed",
	forgotPassword: "checkout.contactSection.resetLinkSendFailed",
	setPassword: "checkout.contactSection.resetPassword.failed",
	passwordChange: "account.errors.passwordChangeFailed",
	profile: "account.errors.profileSaveFailed",
	address: "account.errors.addressSaveFailed",
	addressDelete: "account.errors.addressDeleteFailed",
	deletion: "account.errors.deletionFailed",
};

/** Codes that mean the same thing whichever form sent them. */
const BY_CODE: Readonly<Record<string, string>> = {
	LOGIN_ATTEMPT_DELAYED: "account.errors.tooManyAttempts",
	RATE_LIMITED: "account.errors.tooManyAttempts",
	ACCOUNT_NOT_CONFIRMED: "account.errors.accountNotConfirmed",
	INACTIVE: "account.errors.accountInactive",
	PASSWORD_TOO_SHORT: "checkout.contactSection.resetPassword.passwordTooShort",
	PASSWORD_TOO_COMMON: "account.errors.passwordTooCommon",
	PASSWORD_ENTIRELY_NUMERIC: "account.errors.passwordNumeric",
	PASSWORD_TOO_SIMILAR: "account.errors.passwordTooSimilar",
	// Ours, not Saleor's: the server action checks the confirmation before it asks Saleor.
	PASSWORD_MISMATCH: "account.passwordsDoNotMatch",
};

/** Codes whose meaning depends on the form: a wrong password at sign-in is not a wrong CURRENT password. */
function byAction(action: AccountAction, code: string): string | undefined {
	switch (code) {
		case "INVALID_CREDENTIALS":
			return action === "signIn" ? "checkout.contactSection.invalidCredentials" : undefined;
		case "INVALID_PASSWORD":
			if (action === "signIn") return "checkout.contactSection.invalidCredentials";
			if (action === "passwordChange") return "account.errors.wrongCurrentPassword";
			return undefined;
		case "UNIQUE":
			return action === "signUp" ? "account.errors.emailTaken" : undefined;
		case "INVALID":
		case "INVALID_TOKEN":
		case "JWT_INVALID_TOKEN":
		case "JWT_SIGNATURE_EXPIRED":
			// Saleor rejects a used or expired reset link as INVALID on the `token` field.
			return action === "setPassword" ? "checkout.contactSection.resetPassword.linkInvalid" : undefined;
		default:
			return undefined;
	}
}

export function accountErrorKey(action: AccountAction, code: string | null | undefined): string {
	if (code) {
		const key = byAction(action, code) ?? BY_CODE[code];
		if (key) return key;
	}
	return FALLBACK[action];
}
