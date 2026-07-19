"use client";

import { type FC, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useSaleorAuthContext } from "@saleor/auth-sdk/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/ui/components/ui/button";
import { Label } from "@/ui/components/ui/label";
import { Input } from "@/ui/components/ui/input";
import { getQueryParams, createQueryString } from "@/checkout/lib/utils/url";

export interface ResetPasswordFormProps {
	/** Called when password reset is successful */
	onSuccess: () => void;
	/** Called when user wants to go back to sign in */
	onBackToSignIn: () => void;
}

/**
 * Form for setting a new password after clicking a reset link.
 *
 * Expects URL query params:
 * - passwordResetToken: The token from the reset email
 * - passwordResetEmail: The user's email address
 *
 * Features:
 * - Password confirmation
 * - Minimum length validation (8 chars)
 * - Password visibility toggle
 * - Clears URL params after success
 */
export const ResetPasswordForm: FC<ResetPasswordFormProps> = ({ onSuccess, onBackToSignIn }) => {
	const t = useTranslations("checkout.contactSection.resetPassword");
	const tCommon = useTranslations("checkout.common");
	const tErrors = useTranslations("checkout.errors");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { resetPassword } = useSaleorAuthContext();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (password.length < 8) {
			setError(t("passwordTooShort"));
			return;
		}

		if (password !== confirmPassword) {
			setError(t("passwordsMismatch"));
			return;
		}

		const { passwordResetToken, passwordResetEmail } = getQueryParams(searchParams);

		if (!passwordResetToken) {
			setError(t("linkInvalid"));
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await resetPassword({
				password,
				email: passwordResetEmail || "",
				token: passwordResetToken,
			});

			if (result.data?.setPassword?.errors?.length) {
				const err = result.data.setPassword.errors[0];
				setError(err.message || t("failed"));
			} else if (result.data?.setPassword?.token) {
				// Clear the URL params
				const newQuery = createQueryString(searchParams, {
					passwordResetToken: null,
					passwordResetEmail: null,
				});
				router.replace(`?${newQuery}`, { scroll: false });
				onSuccess();
			} else {
				setError(t("failedMaybeExpired"));
			}
		} catch {
			setError(tErrors("generic"));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<h2 className="text-xl font-semibold">{t("title")}</h2>
				<p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
			</div>

			{error && <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>}

			<div className="space-y-1.5">
				<Label htmlFor="new-password" className="text-sm font-medium">
					{t("newPasswordLabel")}
				</Label>
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						id="new-password"
						type={showPassword ? "text" : "password"}
						placeholder={t("newPasswordPlaceholder")}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="new-password"
						className="h-12 pr-10 pl-10"
						required
						minLength={8}
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
					>
						{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
					</button>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="confirm-password" className="text-sm font-medium">
					{t("confirmPasswordLabel")}
				</Label>
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						id="confirm-password"
						type={showPassword ? "text" : "password"}
						placeholder={t("confirmPasswordPlaceholder")}
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						autoComplete="new-password"
						className="h-12 pl-10"
						required
					/>
				</div>
			</div>

			<div className="flex items-center justify-between pt-2">
				<button
					type="button"
					onClick={onBackToSignIn}
					className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2 hover:no-underline"
				>
					{t("backToSignIn")}
				</button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? tCommon("saving") : t("submit")}
				</Button>
			</div>
		</form>
	);
};
