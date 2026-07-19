"use client";

import { type FC } from "react";
import { SignedInUser, GuestContact } from "@/checkout/components/contact";

// User type matching what useUser() returns
type User = {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
};

// =============================================================================
// Types
// =============================================================================

interface ContactSectionProps {
	// Auth state
	isSignedIn: boolean;
	user: User | null | undefined;
	onSignOut: () => void;
	onSignInClick: () => void;

	// Email state (guests)
	email: string;
	onEmailChange: (value: string) => void;
	onEmailBlur: () => void;
	emailError?: string;

	// Create account state (guests)
	createAccount: boolean;
	onCreateAccountChange: (value: boolean) => void;
	password: string;
	onPasswordChange: (value: string) => void;
	passwordError?: string;
}

// =============================================================================
// Component
// =============================================================================

export const ContactSection: FC<ContactSectionProps> = ({
	isSignedIn,
	user,
	onSignOut,
	onSignInClick,
	email,
	onEmailChange,
	onEmailBlur,
	emailError,
	createAccount,
	onCreateAccountChange,
	password,
	onPasswordChange,
	passwordError,
}) => {
	return (
		<section className="space-y-4">
			{isSignedIn && user ? (
				<>
					<h2 className="text-xl font-semibold">Kontakt</h2>
					<SignedInUser user={user} onSignOut={onSignOut} />
				</>
			) : (
				<>
					<GuestContact
						email={email}
						onEmailChange={onEmailChange}
						onEmailBlur={onEmailBlur}
						emailError={emailError}
						onSignInClick={onSignInClick}
						createAccount={createAccount}
						onCreateAccountChange={onCreateAccountChange}
						password={password}
						onPasswordChange={onPasswordChange}
						passwordError={passwordError}
					/>
				</>
			)}
		</section>
	);
};
