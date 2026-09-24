"use client";

const FOOTER_CLASS = "text-text-inverse/55 hover:text-text-inverse cursor-pointer text-xs transition-colors";

/**
 * Reopens the consent dialog.
 *
 * The `maky:open-consent` event is the only public entry point into `CookieConsent`;
 * the banner listens for it whether or not a choice has already been stored, which is
 * what makes withdrawing consent as easy as giving it (GDPR Art. 7(3)).
 *
 * `className` defaults to the footer's own styling so the existing call site is
 * unchanged. The Cookies page passes its own, because a control that a legal text tells
 * the reader to use has to look like a control in running prose, not like footer chrome.
 */
export function PrivacySettingsLink({ label, className }: { label: string; className?: string }) {
	return (
		<button
			type="button"
			onClick={() => window.dispatchEvent(new Event("maky:open-consent"))}
			className={className ?? FOOTER_CLASS}
		>
			{label}
		</button>
	);
}
