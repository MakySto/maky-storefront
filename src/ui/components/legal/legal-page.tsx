import { type ReactNode } from "react";

/**
 * Shared wrapper for the static legal/content pages (Kontakt, VOP, GDPR, …).
 * Renders a constrained, readable prose column. Bodies live in
 * `src/ui/content/legal/`, one export per approved language; the route handles the
 * market gate and the SEO metadata.
 *
 * `break-words` on the title AND on the prose column is for German. Compounds like
 * *Datenschutzeinstellungen* (h1) and *Datenschutzaufsichtsbehörde* (an h2 inside the
 * prose) are longer than any Slovak or Czech word on these pages, and each one on its
 * own pushed the document 13-17px past the viewport at 360px — the whole page scrolled
 * sideways to accommodate a single word.
 *
 * It has to be on both: fixing only the h1 left the h2 overflowing, which is how the
 * second one was found. `overflow-wrap: break-word` engages only for a word that would
 * otherwise overflow, so Slovak and Czech rendering is untouched.
 *
 * Breaking the word is the fix. Hiding or truncating it is not, and neither is shrinking
 * the type — these pages are statutory disclosures and have to stay readable.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-semibold tracking-tight break-words">{title}</h1>
			<div className="prose mt-6 max-w-none break-words">{children}</div>
		</div>
	);
}
