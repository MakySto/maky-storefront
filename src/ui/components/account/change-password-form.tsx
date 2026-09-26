"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { changePassword } from "@/app/[channel]/(main)/account/actions";
import { accountErrorKey } from "@/ui/components/account/account-error";

export function ChangePasswordForm() {
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [showOld, setShowOld] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const t = useTranslations("account");
	const tCommon = useTranslations("common");
	const tCheckout = useTranslations("checkout");
	const tr = useTranslations();

	const handleSubmit = useCallback(
		(formData: FormData) => {
			setError("");
			setSuccess(false);

			startTransition(async () => {
				const result = await changePassword(formData);
				if (!result.success) {
					setError(tr(accountErrorKey("passwordChange", result.code)));
				} else {
					setSuccess(true);
					setIsOpen(false);
					formRef.current?.reset();
				}
			});
		},
		[startTransition, tr],
	);

	if (!isOpen) {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="text-muted-foreground text-sm">{tCheckout("contactSection.passwordPlaceholder")}</p>
					<p className="font-medium">••••••••</p>
				</div>
				<div className="flex items-center gap-2">
					{success && (
						<span aria-live="polite" className="text-sm text-green-600">
							{t("profile.updated")}
						</span>
					)}
					<Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
						{tCheckout("common.change")}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<form ref={formRef} action={handleSubmit} className="space-y-4">
			<p className="text-muted-foreground text-sm">{tCheckout("contactSection.passwordPlaceholder")}</p>
			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}

			<div className="space-y-1.5">
				<Label htmlFor="oldPassword">{t("profile.currentPassword")}</Label>
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						id="oldPassword"
						name="oldPassword"
						type={showOld ? "text" : "password"}
						autoComplete="current-password"
						className="pr-10 pl-10"
						required
					/>
					<button
						type="button"
						onClick={() => setShowOld(!showOld)}
						aria-label={showOld ? t("form.hidePassword") : t("form.showPassword")}
						className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
					>
						{showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
					</button>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="newPassword">{tCheckout("contactSection.resetPassword.newPasswordLabel")}</Label>
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						id="newPassword"
						name="newPassword"
						type={showNew ? "text" : "password"}
						autoComplete="new-password"
						placeholder={t("minEightChars")}
						className="pr-10 pl-10"
						minLength={8}
						required
					/>
					<button
						type="button"
						onClick={() => setShowNew(!showNew)}
						aria-label={showNew ? t("form.hidePassword") : t("form.showPassword")}
						className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
					>
						{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
					</button>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="confirmPassword">{t("profile.confirmNewPassword")}</Label>
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						className="pl-10"
						minLength={8}
						required
					/>
				</div>
			</div>

			<div className="flex gap-2">
				<Button type="submit" size="sm" disabled={isPending}>
					{isPending ? tCheckout("contactSection.processing") : t("profile.changePassword")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => {
						setIsOpen(false);
						setError("");
						formRef.current?.reset();
					}}
				>
					{tCommon("cancel")}
				</Button>
			</div>
		</form>
	);
}
