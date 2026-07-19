"use client";

import { type FC, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginWithBff } from "@/lib/auth/bff-client";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { requestPasswordResetAction } from "@/checkout/lib/actions";

export interface SignInFormProps {
	/** Pre-filled email address */
	initialEmail?: string;
	/** Saleor channel slug for password reset */
	channelSlug: string;
	/** Called when sign-in is successful (may be async — form waits before clearing loading state) */
	onSuccess: () => void | Promise<void>;
	/** Called when user wants to checkout as guest */
	onGuestCheckout: () => void;
}

/**
 * Sign-in form with email, password, and forgot password functionality.
 *
 * Features:
 * - Email/password authentication via the BFF login endpoint (B.4.5 — HttpOnly
 *   session cookies set server-side; replaces the client auth-sdk signIn)
 * - Password visibility toggle
 * - Forgot password flow with rate limit messaging
 * - "Guest checkout" option
 */
export const SignInForm: FC<SignInFormProps> = ({
	initialEmail = "",
	channelSlug,
	onSuccess,
	onGuestCheckout,
}) => {
	const [email, setEmail] = useState(initialEmail);
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [passwordResetSent, setPasswordResetSent] = useState(false);

	const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccessMessage("");
		setIsSubmitting(true);

		try {
			const result = await loginWithBff(email, password);
			if (result.errors?.length) {
				const err = result.errors[0];
				const isInvalidCredentials =
					err.code === "INVALID_CREDENTIALS" ||
					err.code === "INVALID_PASSWORD" ||
					err.message?.toLowerCase().includes("invalid") ||
					err.message?.toLowerCase().includes("credentials");
				setError(
					isInvalidCredentials ? "Nesprávny e-mail alebo heslo" : "Prihlásenie zlyhalo. Skúste to znova.",
				);
			} else if (result.ok || result.success) {
				await onSuccess();
			} else {
				setError("Prihlásenie zlyhalo. Skúste to znova.");
			}
		} catch {
			setError("Nastala chyba. Skúste to znova.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleForgotPassword = async () => {
		setError("");
		setSuccessMessage("");

		if (!email) {
			setError("Najprv zadajte svoju e-mailovú adresu");
			return;
		}

		if (!validateEmail(email)) {
			setError("Zadajte platnú e-mailovú adresu");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await requestPasswordResetAction({
				email,
				channel: channelSlug,
				redirectUrl: window.location.href,
			});

			if (result.error) {
				setError(result.error.message || "Nepodarilo sa odoslať odkaz na obnovenie hesla");
				return;
			}

			if (result.data?.requestPasswordReset?.errors?.length) {
				const err = result.data.requestPasswordReset.errors[0];
				setError(err.message || "Nepodarilo sa odoslať odkaz na obnovenie hesla");
			} else {
				setPasswordResetSent(true);
				setSuccessMessage(
					`Ak pre adresu ${email} existuje účet, poslali sme na ňu odkaz na obnovenie hesla. ` +
						`Upozornenie: nový odkaz je možné vyžiadať najskôr o 15 minút.`,
				);
			}
		} catch {
			setError("Nastala chyba. Skúste to znova.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">Prihlásenie</h2>
				<p className="text-muted-foreground text-sm">
					Nový zákazník?{" "}
					<button
						type="button"
						onClick={onGuestCheckout}
						className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
					>
						Pokračovať bez registrácie
					</button>
				</p>
			</div>

			{error && <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>}

			{successMessage && (
				<div className="rounded-md bg-green-100 p-3 text-sm text-green-800">{successMessage}</div>
			)}

			<div className="space-y-1.5">
				<div className="relative">
					<Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						type="email"
						placeholder="E-mailová adresa"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							setPasswordResetSent(false);
						}}
						autoComplete="email"
						className="h-12 pl-10"
						required
					/>
				</div>
			</div>

			<div className="space-y-1.5">
				<div className="relative">
					<Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						type={showPassword ? "text" : "password"}
						placeholder="Heslo"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
						className="h-12 pr-10 pl-10"
						required
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

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={handleForgotPassword}
					disabled={isSubmitting}
					className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2 hover:no-underline disabled:opacity-50"
				>
					{passwordResetSent ? "Poslať odkaz znova?" : "Zabudli ste heslo?"}
				</button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Spracovávam…" : "Prihlásiť sa"}
				</Button>
			</div>
		</form>
	);
};
