"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { useSaleorAuthContext } from "@saleor/auth-sdk/react";

export interface SignedInUserProps {
	/** User email or basic info */
	user: { email: string };
	/** Called after sign-out */
	onSignOut: () => void;
}

/**
 * Displays signed-in user info with sign-out option.
 *
 * Shows:
 * - User avatar (first letter of email)
 * - Email address
 * - "Signed in" status
 * - Sign out button
 */
export const SignedInUser: FC<SignedInUserProps> = ({ user, onSignOut }) => {
	const t = useTranslations("checkout.contactSection");
	const { signOut } = useSaleorAuthContext();

	const handleSignOut = () => {
		signOut();
		onSignOut();
	};

	return (
		<div className="bg-muted/30 border-border flex items-center justify-between gap-3 rounded-lg border p-4">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div className="bg-foreground text-background flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
					{user.email.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium break-words">{user.email}</p>
					<p className="text-muted-foreground text-sm">{t("signedInStatus")}</p>
				</div>
			</div>
			<button
				type="button"
				onClick={handleSignOut}
				className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-2 hover:no-underline"
			>
				{t("signOut")}
			</button>
		</div>
	);
};
