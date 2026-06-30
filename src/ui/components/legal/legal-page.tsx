import { type ReactNode } from "react";

/**
 * Shared wrapper for the static legal/content pages (Kontakt, VOP, GDPR, …).
 * Renders a constrained, readable prose column. Page bodies are inline Slovak
 * (SK-only); the page itself handles the SK-channel gate + SEO metadata.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
			<div className="prose mt-6 max-w-none">{children}</div>
		</div>
	);
}
