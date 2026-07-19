"use client";

import { type FC, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Lock, Eye, EyeOff, Info } from "lucide-react";
import { Label } from "@/ui/components/ui/label";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Input } from "@/ui/components/ui/input";
import { cn } from "@/lib/utils";

// Re-export for backward compatibility
export { FormInput, FieldError } from "@/checkout/views/saleor-checkout/address-form-fields";

export interface GuestContactProps {
	/** Current email value */
	email: string;
	/** Called when email changes */
	onEmailChange: (email: string) => void;
	/** Called when email field loses focus (for validation) */
	onEmailBlur?: () => void;
	/** Email validation error */
	emailError?: string;
	/** Called when user wants to sign in */
	onSignInClick: () => void;
	/** Whether "create account" is checked */
	createAccount: boolean;
	/** Called when create account checkbox changes */
	onCreateAccountChange: (checked: boolean) => void;
	/** Password value (only used when createAccount is true) */
	password: string;
	/** Called when password changes */
	onPasswordChange: (password: string) => void;
	/** Password validation error */
	passwordError?: string;
}

/**
 * Guest checkout contact section.
 *
 * Features:
 * - Email input with icon
 * - "Have an account? Log in" link
 * - Optional "Create account" checkbox
 * - Password field (shown when create account is checked)
 */
export const GuestContact: FC<GuestContactProps> = ({
	email,
	onEmailChange,
	onEmailBlur,
	emailError,
	onSignInClick,
	createAccount,
	onCreateAccountChange,
	password,
	onPasswordChange,
	passwordError,
}) => {
	const [showPassword, setShowPassword] = useState(false);
	const t = useTranslations("checkout.contactSection");

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">{t("title")}</h2>
				<p className="text-muted-foreground text-sm">
					{t("haveAccount")}{" "}
					<button
						type="button"
						onClick={onSignInClick}
						className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
					>
						{t("signIn")}
					</button>
				</p>
			</div>

			<div className="space-y-1.5">
				<div className="relative">
					<Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						type="email"
						placeholder={t("emailPlaceholder")}
						value={email}
						onChange={(e) => onEmailChange(e.target.value)}
						onBlur={onEmailBlur}
						autoComplete="email"
						className={cn("h-12 pl-10", emailError && "border-destructive")}
						aria-invalid={!!emailError}
						aria-describedby={emailError ? "email-error" : undefined}
					/>
				</div>
				{emailError && (
					<p id="email-error" role="alert" className="text-destructive text-sm">
						{emailError}
					</p>
				)}
			</div>

			<div className="flex items-center gap-3">
				<Checkbox
					id="createAccount"
					checked={createAccount}
					onCheckedChange={(checked) => onCreateAccountChange(checked === true)}
				/>
				<Label htmlFor="createAccount" className="text-muted-foreground cursor-pointer text-sm">
					{t("createAccountLabel")}
				</Label>
			</div>

			{createAccount && (
				<div className="space-y-3">
					<div className="space-y-1.5">
						<div className="relative">
							<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
							<Input
								type={showPassword ? "text" : "password"}
								placeholder={t("createAccountPasswordPlaceholder")}
								value={password}
								onChange={(e) => onPasswordChange(e.target.value)}
								autoComplete="new-password"
								className={cn("h-12 pr-10 pl-10", passwordError && "border-destructive")}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
							>
								{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						</div>
						{passwordError && <p className="text-destructive text-sm">{passwordError}</p>}
					</div>
					{/* Account activation notice */}
					<div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md p-3 text-sm">
						<Info className="mt-0.5 h-4 w-4 shrink-0" />
						<p>{t("activationNotice")}</p>
					</div>
				</div>
			)}
		</section>
	);
};
