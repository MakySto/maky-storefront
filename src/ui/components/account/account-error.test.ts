import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accountErrorKey, type AccountAction } from "./account-error";

const ACTIONS: AccountAction[] = [
	"signIn",
	"signUp",
	"forgotPassword",
	"setPassword",
	"passwordChange",
	"profile",
	"address",
	"addressDelete",
	"deletion",
];

const CODES = [
	null,
	"INVALID_CREDENTIALS",
	"INVALID_PASSWORD",
	"LOGIN_ATTEMPT_DELAYED",
	"RATE_LIMITED",
	"ACCOUNT_NOT_CONFIRMED",
	"INACTIVE",
	"UNIQUE",
	"INVALID",
	"INVALID_TOKEN",
	"PASSWORD_TOO_SHORT",
	"PASSWORD_TOO_COMMON",
	"PASSWORD_ENTIRELY_NUMERIC",
	"PASSWORD_TOO_SIMILAR",
	"PASSWORD_MISMATCH",
	"SOMETHING_SALEOR_ADDS_LATER",
];

const LOCALES = fs
	.readdirSync(path.join(process.cwd(), "src/i18n/messages"))
	.filter((f) => f.endsWith(".json"))
	.map((f) => f.replace(/\.json$/, ""));

function lookup(locale: string, key: string): unknown {
	const messages: unknown = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), "src/i18n/messages", `${locale}.json`), "utf8"),
	);
	return key
		.split(".")
		.reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
}

describe("accountErrorKey", () => {
	it("tells a wrong password at sign-in apart from a wrong CURRENT password", () => {
		expect(accountErrorKey("signIn", "INVALID_PASSWORD")).toBe("checkout.contactSection.invalidCredentials");
		expect(accountErrorKey("passwordChange", "INVALID_PASSWORD")).toBe("account.errors.wrongCurrentPassword");
	});

	it("reads a used or expired reset link as such, and only on the reset form", () => {
		expect(accountErrorKey("setPassword", "INVALID")).toBe(
			"checkout.contactSection.resetPassword.linkInvalid",
		);
		expect(accountErrorKey("address", "INVALID")).toBe("account.errors.addressSaveFailed");
	});

	it("never falls through to Saleor's own message: an unknown code gets the form's text", () => {
		expect(accountErrorKey("signUp", "SOMETHING_SALEOR_ADDS_LATER")).toBe("account.errors.signUpFailed");
		expect(accountErrorKey("signIn", null)).toBe("checkout.contactSection.signInFailed");
	});

	// next-intl is not type-augmented here: a key that is missing in one language fails
	// silently at runtime and prints the key path to the customer.
	it.each(LOCALES)("every key it can return is a text in %s", (locale) => {
		const missing = ACTIONS.flatMap((action) => CODES.map((code) => accountErrorKey(action, code))).filter(
			(key) => typeof lookup(locale, key) !== "string",
		);
		expect(missing).toEqual([]);
	});
});
