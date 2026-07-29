"use client";

export function PrivacySettingsLink({ label }: { label: string }) {
	return (
		<button
			type="button"
			onClick={() => window.dispatchEvent(new Event("maky:open-consent"))}
			className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-gray-300"
		>
			{label}
		</button>
	);
}
